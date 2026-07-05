import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useTerminalStore } from '../../../stores/terminalStore'
import { sendToExtension } from '../../../utils/vscode'
import {
  buildNextCommandSuggestions,
  createWorkspaceFileExists,
  detectPackageManager,
  formatDuration,
  parseFirstFileLocation,
  type PackageManager
} from './executeCommandDiagnostics'
import { useExecuteCommandChanges, type ExecuteCommandPanelProps } from './useExecuteCommandChanges'

export function useExecuteCommandPanel(
  props: ExecuteCommandPanelProps,
  emit: (e: 'update-result', result: Record<string, unknown>) => void,
  options: { t: (key: string, params?: Record<string, unknown>) => string }
) {
  const { t } = options

  const isEmbedded = computed(() => props.embedded === true)

  const terminalStore = useTerminalStore()
  const killing = ref(false)
  const outputScrollRef = ref<{ scrollToBottom?: () => void } | null>(null)

  const command = computed(() => (props.args.command as string) || '')
  const cwd = computed(() => (props.args.cwd as string) || '')

  const resultData = computed(() => {
    const result = props.result as Record<string, any> | undefined
    return result?.data || {}
  })

  const terminalId = computed(() => (resultData.value.terminalId as string) || '')

  const terminalState = computed(() => {
    if (terminalId.value) {
      return terminalStore.getTerminal(terminalId.value)
    }

    if (command.value) {
      const matchedId = terminalStore.findTerminalByCommand(command.value, cwd.value || undefined)
      if (matchedId) {
        return terminalStore.getTerminal(matchedId)
      }
    }

    return null
  })

  const output = computed(() => {
    if (terminalState.value) {
      return terminalState.value.output
    }
    return (resultData.value.output as string) || ''
  })

  const exitCode = computed(() => {
    if (terminalState.value && terminalState.value.exitCode !== undefined) {
      return terminalState.value.exitCode
    }
    return resultData.value.exitCode as number | undefined
  })

  const killed = computed(() => {
    if (terminalState.value) {
      return terminalState.value.killed || false
    }
    return (resultData.value.killed as boolean) || false
  })

  const cancelled = computed(() => {
    const result = props.result as Record<string, any> | undefined
    return (result?.cancelled as boolean) || false
  })

  const duration = computed(() => {
    if (terminalState.value && terminalState.value.duration !== undefined) {
      return terminalState.value.duration
    }
    return resultData.value.duration as number | undefined
  })

  const truncated = computed(() => (resultData.value.truncated as boolean) || false)
  const totalLines = computed(() => (resultData.value.totalLines as number) || 0)
  const outputLines = computed(() => (resultData.value.outputLines as number) || 0)

  const isRunning = computed(() => {
    if (props.error) return false

    const result = props.result as Record<string, any> | undefined
    if (result?.error) return false

    if (props.status === 'running' || props.status === 'pending') {
      return true
    }

    if (terminalState.value) {
      return terminalState.value.running
    }

    if (killed.value) return false
    if (exitCode.value !== undefined) return false
    return !!terminalId.value
  })

  const statusLabel = computed(() => {
    const result = props.result as Record<string, any> | undefined
    const resultError = result?.error as string | undefined

    if (cancelled.value || killed.value) {
      return t('components.tools.terminal.executeCommandPanel.status.terminated')
    }
    if (props.error || resultError) return t('components.tools.terminal.executeCommandPanel.status.failed')
    if (exitCode.value === 0) return t('components.tools.terminal.executeCommandPanel.status.success')
    if (exitCode.value !== undefined) {
      return t('components.tools.terminal.executeCommandPanel.status.exitCode', { code: exitCode.value })
    }
    if (isRunning.value) return t('components.tools.terminal.executeCommandPanel.status.running')
    return t('components.tools.terminal.executeCommandPanel.status.pending')
  })

  const statusClass = computed(() => {
    const result = props.result as Record<string, any> | undefined
    const resultError = result?.error as string | undefined

    if (cancelled.value || killed.value) return 'terminated'
    if (props.error || resultError) return 'error'
    if (exitCode.value !== undefined && exitCode.value !== 0) return 'error'
    if (exitCode.value === 0) return 'success'
    if (isRunning.value) return 'running'
    return 'pending'
  })

  const statusIcon = computed(() => {
    const result = props.result as Record<string, any> | undefined
    const resultError = result?.error as string | undefined

    if (cancelled.value || killed.value) return 'codicon-circle-slash'
    if (props.error || resultError) return 'codicon-error'
    if (exitCode.value !== undefined && exitCode.value !== 0) return 'codicon-error'
    if (exitCode.value === 0) return 'codicon-pass'
    if (isRunning.value) return 'codicon-loading'
    return 'codicon-clock'
  })

  const commandTooltip = computed(() => {
    const lines: string[] = []

    if (command.value) lines.push(command.value)
    if (cwd.value) lines.push(`CWD: ${cwd.value}`)
    if (duration.value !== undefined) lines.push(formatDuration(duration.value))
    if (statusLabel.value) lines.push(statusLabel.value)

    return lines.join('\n')
  })

  const defaultExpanded = computed(() => {
    if (isRunning.value) return true
    if (cancelled.value || killed.value) return true
    if (props.error) return true
    const result = props.result as Record<string, any> | undefined
    if (result?.error) return true
    if (exitCode.value !== undefined && exitCode.value !== 0) return true
    return false
  })

  const hasFailure = computed(() => {
    const result = props.result as Record<string, any> | undefined
    const resultError = result?.error as string | undefined

    if (props.error || resultError) return true
    if (exitCode.value !== undefined && exitCode.value !== 0) return true

    return false
  })

  const diagnosticText = computed(() => {
    if (output.value) return output.value
    if (props.error) return props.error
    const result = props.result as Record<string, any> | undefined
    const resultError = result?.error as string | undefined
    return resultError || ''
  })

  const firstErrorLocation = computed(() => parseFirstFileLocation(diagnosticText.value))

  const workspaceFileExists = createWorkspaceFileExists(sendToExtension)
  const detectedPackageManager = ref<PackageManager | null>(null)
  const detectingPackageManager = ref(false)

  async function refreshPackageManager() {
    if (detectingPackageManager.value) return
    detectingPackageManager.value = true
    try {
      detectedPackageManager.value = await detectPackageManager(command.value, cwd.value, workspaceFileExists)
    } finally {
      detectingPackageManager.value = false
    }
  }

  onMounted(() => {
    refreshPackageManager()
  })

  watch([command, cwd], () => {
    refreshPackageManager()
  })

  const nextCommandSuggestions = computed(() => {
    if (!hasFailure.value || isRunning.value) return []
    return buildNextCommandSuggestions(command.value, diagnosticText.value, detectedPackageManager.value)
  })

  const hasNextSuggestions = computed(() => nextCommandSuggestions.value.length > 0)

  const copiedSuggestion = ref<string>('')
  async function copySuggestionCommand(cmd: string) {
    if (!cmd) return
    try {
      await navigator.clipboard.writeText(cmd)
      copiedSuggestion.value = cmd
      setTimeout(() => {
        if (copiedSuggestion.value === cmd) copiedSuggestion.value = ''
      }, 1000)
    } catch (err) {
      console.error('Failed to copy suggestion command:', err)
    }
  }

  const canOpenFirstError = computed(() => hasFailure.value && !isRunning.value && !!firstErrorLocation.value)

  const showEmbeddedActions = computed(
    () =>
      isEmbedded.value &&
      ((truncated.value && !isRunning.value) || isRunning.value || canOpenFirstError.value)
  )

  const openFirstErrorTitle = computed(() => {
    const loc = firstErrorLocation.value
    if (!loc) return ''
    return t('components.tools.terminal.executeCommandPanel.jumpToErrorTooltip', {
      path: loc.path,
      line: loc.line,
      column: loc.column
    })
  })

  const opening = ref(false)

  async function openFirstError() {
    const loc = firstErrorLocation.value
    if (!loc || opening.value) return

    opening.value = true
    try {
      await sendToExtension('openWorkspaceFileAtLocation', {
        path: loc.path,
        line: loc.line,
        column: loc.column
      })
    } catch (err) {
      console.warn('Failed to open error location:', err)
    } finally {
      opening.value = false
    }
  }

  const expanded = ref(props.embedded ? true : false)
  const userToggled = ref(false)

  function toggleExpanded() {
    if (isEmbedded.value) return
    expanded.value = !expanded.value
    userToggled.value = true
  }

  const effectiveTerminalId = computed(() => {
    if (terminalId.value) {
      return terminalId.value
    }

    if (command.value) {
      const matchedId = terminalStore.findTerminalByCommand(command.value, cwd.value || undefined)
      if (matchedId) {
        return matchedId
      }
    }

    if (terminalState.value) {
      return terminalState.value.id
    }

    return props.toolId || ''
  })

  async function handleKillTerminal() {
    if (!effectiveTerminalId.value || killing.value) {
      return
    }

    killing.value = true

    try {
      const result = await terminalStore.killTerminal(effectiveTerminalId.value)

      if (result.success) {
        emit('update-result', {
          ...props.result,
          data: {
            ...resultData.value,
            killed: true,
            output: result.output || resultData.value.output,
            endTime: Date.now()
          }
        })
      }
    } catch (err) {
      console.error('Failed to kill terminal:', err)
    } finally {
      killing.value = false
    }
  }

  onMounted(() => {
    if (isRunning.value && effectiveTerminalId.value) {
      terminalStore.registerTerminal(effectiveTerminalId.value)
    }
  })

  watch(
    () => props.toolId,
    () => {
      userToggled.value = false
      expanded.value = isEmbedded.value ? true : defaultExpanded.value
    },
    { immediate: true }
  )

  watch(defaultExpanded, (next) => {
    if (isEmbedded.value) return
    if (!userToggled.value && next) {
      expanded.value = true
    }
  })

  watch(expanded, (isExpanded) => {
    if (!isExpanded) return
    nextTick(() => {
      outputScrollRef.value?.scrollToBottom?.()
    })
  })

  watch(effectiveTerminalId, (newId) => {
    if (newId && isRunning.value) {
      terminalStore.registerTerminal(newId)
    }
  })

  watch(isRunning, (running) => {
    if (running && effectiveTerminalId.value) {
      terminalStore.registerTerminal(effectiveTerminalId.value)
    }
  })

  const changes = useExecuteCommandChanges({
    t,
    props,
    resultData,
    isRunning,
    expanded,
    toggleExpanded
  })

  return {
    isEmbedded,
    killing,
    outputScrollRef,
    command,
    resultData,
    output,
    exitCode,
    killed,
    cancelled,
    duration,
    truncated,
    totalLines,
    outputLines,
    isRunning,
    statusLabel,
    statusClass,
    statusIcon,
    commandTooltip,
    expanded,
    toggleExpanded,
    defaultExpanded,
    hasFailure,
    diagnosticText,
    firstErrorLocation,
    nextCommandSuggestions,
    hasNextSuggestions,
    copiedSuggestion,
    copySuggestionCommand,
    canOpenFirstError,
    showEmbeddedActions,
    openFirstErrorTitle,
    opening,
    openFirstError,
    handleKillTerminal,
    ...changes
  }
}

