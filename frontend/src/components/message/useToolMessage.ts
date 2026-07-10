import { computed, h, ref, type Component, type ComputedRef } from 'vue'
import type { Message, ToolUsage } from '../../types'
import { useChatStore } from '../../stores'
import { generateId } from '../../utils/format'
import { getToolConfig } from '../../utils/toolRegistry'
import { sendToExtension } from '../../utils/vscode'
import {
  getReadFileHeaderStats,
  getToolDescription,
  mergeConsecutiveExecuteCommandTools,
  mergeConsecutiveReadFileTools,
  parseRiskPrefix,
  type DisplayToolUsage,
  type Translator
} from './toolMessageUtils'
import { useApplyDiffUndo } from './useApplyDiffUndo'
import { useReadFileCopy } from './useReadFileCopy'

export function renderDefaultToolContent(tool: ToolUsage, t: Translator) {
  return h('div', { class: 'tool-content-default' }, [
    tool.args &&
      h('div', { class: 'content-section' }, [
        h('div', { class: 'section-label' }, t('components.message.tool.parameters') + ':'),
        h('pre', { class: 'section-data' }, JSON.stringify(tool.args, null, 2))
      ]),
    tool.result &&
      h('div', { class: 'content-section' }, [
        h('div', { class: 'section-label' }, t('components.message.tool.result') + ':'),
        h('pre', { class: 'section-data' }, JSON.stringify(tool.result, null, 2))
      ]),
    tool.error &&
      h('div', { class: 'content-section error-section' }, [
        h('div', { class: 'section-label' }, t('components.message.tool.error') + ':'),
        h('div', { class: 'error-message' }, tool.error)
      ])
  ])
}

export function useToolMessage(tools: ComputedRef<ToolUsage[]>, options: { t: Translator }) {
  const { t } = options
  const chatStore = useChatStore()

  const processingToolIds = ref<Set<string>>(new Set())

  const enhancedTools = computed<ToolUsage[]>(() => {
    return tools.value.map((tool) => {
      let response: Record<string, unknown> | null | undefined = tool.result
      if (!response && tool.id) {
        response = chatStore.getToolResponseById(tool.id) as Record<string, unknown> | null
      }

      if (response) {
        const error = tool.error || (response as any).error
        const success = (response as any).success !== false && !error

        let status: 'success' | 'error' | 'warning' = success ? 'success' : 'error'
        const data = (response as any).data
        if (success && data && data.appliedCount > 0 && data.failedCount > 0) {
          status = 'warning'
        }

        return {
          ...tool,
          result: response || undefined,
          error,
          status,
          awaitingConfirmation: false
        }
      }

      if (processingToolIds.value.has(tool.id)) {
        return { ...tool, status: 'running' as const, awaitingConfirmation: false }
      }

      const awaitingConfirm = tool.status === 'pending'
      const effectiveStatus = tool.status || 'running'
      return { ...tool, status: effectiveStatus, awaitingConfirmation: awaitingConfirm }
    })
  })

  const userDecisions = ref<Map<string, boolean>>(new Map())

  const pendingToolIds = computed(() => {
    return enhancedTools.value.filter((tool) => tool.awaitingConfirmation).map((tool) => tool.id)
  })

  const allDecisionsMade = computed(() => {
    if (pendingToolIds.value.length === 0) return false
    return pendingToolIds.value.every((id) => userDecisions.value.has(id))
  })

  function confirmToolExecution(toolId: string, _toolName: string) {
    userDecisions.value.set(toolId, true)
    userDecisions.value = new Map(userDecisions.value)
    if (allDecisionsMade.value) void submitAllDecisions()
  }

  function rejectToolExecution(toolId: string, _toolName: string) {
    userDecisions.value.set(toolId, false)
    userDecisions.value = new Map(userDecisions.value)
    if (allDecisionsMade.value) void submitAllDecisions()
  }

  function getToolDecision(toolId: string): boolean | undefined {
    return userDecisions.value.get(toolId)
  }

  function hasUserDecision(toolId: string): boolean {
    return userDecisions.value.has(toolId)
  }

  async function submitAllDecisions() {
    const toolResponses: Array<{ id: string; name: string; confirmed: boolean }> = []

    for (const tool of enhancedTools.value) {
      if (!tool.awaitingConfirmation) continue

      const decision = userDecisions.value.get(tool.id)
      const confirmed = decision === true

      toolResponses.push({
        id: tool.id,
        name: tool.name,
        confirmed
      })

      processingToolIds.value.add(tool.id)
    }

    if (toolResponses.length === 0) return

    const annotation = chatStore.inputValue.trim()
    userDecisions.value.clear()

    if (annotation) {
      chatStore.clearInputValue()

      const userMessage: Message = {
        id: generateId(),
        role: 'user',
        content: annotation,
        timestamp: Date.now(),
        parts: [{ text: annotation }]
      }
      chatStore.allMessages.push(userMessage)
    }

    await sendToolConfirmation(toolResponses, annotation)
  }

  async function sendToolConfirmation(
    toolResponses: Array<{ id: string; name: string; confirmed: boolean }>,
    annotation?: string
  ) {
    try {
      const currentConversationId = chatStore.currentConversationId
      const currentConfig = chatStore.currentConfig

      if (!currentConversationId || !currentConfig?.id) {
        console.error('No conversation or config ID')
        return
      }

      await sendToExtension('toolConfirmation', {
        conversationId: currentConversationId,
        configId: currentConfig.id,
        toolResponses,
        annotation
      })
    } catch (error) {
      console.error('Failed to send tool confirmation:', error)
    }
  }

  const expandedTools = ref<Set<string>>(new Set())

  function toggleExpand(toolId: string) {
    if (expandedTools.value.has(toolId)) {
      expandedTools.value.delete(toolId)
    } else {
      expandedTools.value.add(toolId)
    }
  }

  function isExpanded(toolId: string): boolean {
    return expandedTools.value.has(toolId)
  }

  const displayTools = computed<DisplayToolUsage[]>(() => {
    const base: DisplayToolUsage[] = enhancedTools.value.map((tool) => {
      const description = getToolDescription(tool, t)
      const parsed = parseRiskPrefix(description)
      const readFileHeaderStats = getReadFileHeaderStats(tool)

      return {
        ...tool,
        description,
        descriptionText: parsed ? parsed.text : description,
        riskBadge: parsed?.badge,
        readFileHeaderStats
      }
    })

    const merged = mergeConsecutiveReadFileTools(base)
    return mergeConsecutiveExecuteCommandTools(merged, {
      describe: (tool) => getToolDescription(tool, t),
      parseRiskPrefix
    })
  })

  const { isReadFileCopied, copyReadFileSingleContent } = useReadFileCopy()

  const { canUndoApplyDiff, undoApplyDiffTool, undoingApplyDiffToolId } = useApplyDiffUndo(t)

  const acceptingDiffToolId = ref<string>('')

  function isDiffReviewTool(tool: ToolUsage): boolean {
    return tool.name === 'apply_diff' || tool.name === 'write_file'
  }

  async function acceptPendingDiff(tool: ToolUsage) {
    if (!tool?.id) return
    if (acceptingDiffToolId.value === tool.id) return

    acceptingDiffToolId.value = tool.id
    try {
      await sendToExtension('diff.acceptPending', { toolId: tool.id })
    } catch (err) {
      console.error(t('components.message.tool.acceptDiffFailed'), err)
    } finally {
      if (acceptingDiffToolId.value === tool.id) {
        acceptingDiffToolId.value = ''
      }
    }
  }

  function isExpandable(tool: ToolUsage): boolean {
    const config = getToolConfig(tool.name)
    return config?.expandable !== false
  }

  function hasDiffPreview(tool: ToolUsage): boolean {
    const config = getToolConfig(tool.name)
    return config?.hasDiffPreview === true
  }

  function getDiffFilePaths(tool: ToolUsage): string[] {
    const config = getToolConfig(tool.name)
    if (!config?.getDiffFilePath) return []

    const result = config.getDiffFilePath(tool.args, tool.result as Record<string, unknown> | undefined)
    if (Array.isArray(result)) return result
    return result ? [result] : []
  }

  async function openDiffPreview(tool: ToolUsage) {
    const paths = getDiffFilePaths(tool)
    if (paths.length === 0) return

    try {
      const serializedArgs = JSON.parse(JSON.stringify(tool.args || {}))
      const serializedResult = tool.result ? JSON.parse(JSON.stringify(tool.result)) : undefined

      await sendToExtension('diff.openPreview', {
        toolId: tool.id,
        toolName: tool.name,
        filePaths: paths,
        args: serializedArgs,
        result: serializedResult
      })
    } catch (err) {
      console.error(t('components.message.tool.openDiffFailed'), err)
    }
  }

  function getStatusIcon(status?: string, awaitingConfirmation?: boolean): string {
    if (awaitingConfirmation) {
      return 'codicon-shield'
    }
    switch (status) {
      case 'pending':
        return 'codicon-clock'
      case 'running':
        return 'codicon-loading'
      case 'success':
      case 'warning':
        return 'codicon-check'
      case 'error':
        return 'codicon-error'
      default:
        return ''
    }
  }

  function getStatusClass(status?: string, awaitingConfirmation?: boolean): string {
    if (awaitingConfirmation) {
      return 'status-warning'
    }
    switch (status) {
      case 'success':
        return 'status-success'
      case 'error':
        return 'status-error'
      case 'warning':
        return 'status-warning'
      case 'running':
        return 'status-running'
      case 'pending':
        return 'status-pending'
      default:
        return ''
    }
  }

  function hasActionButtons(tool: ToolUsage): boolean {
    if (tool.awaitingConfirmation) return true
    if (hasDiffPreview(tool) && getDiffFilePaths(tool).length > 0) return true
    if (isDiffReviewTool(tool) && tool.status === 'running') return true
    if (canUndoApplyDiff(tool)) return true
    return false
  }

  function renderToolContent(tool: ToolUsage) {
    const config = getToolConfig(tool.name)

    if (config?.contentComponent) {
      return h(config.contentComponent as Component, {
        args: tool.args,
        result: tool.result,
        error: tool.error,
        status: tool.status,
        toolId: tool.id,
        embedded: tool.name === 'execute_command'
      })
    }

    if (config?.contentFormatter) {
      const content = config.contentFormatter(tool.args, tool.result)
      return h('div', { class: 'tool-content-text' }, content)
    }

    return renderDefaultToolContent(tool, t)
  }

  return {
    displayTools,
    confirmToolExecution,
    rejectToolExecution,
    getToolDecision,
    hasUserDecision,
    toggleExpand,
    isExpanded,
    isExpandable,
    hasActionButtons,
    isReadFileCopied,
    copyReadFileSingleContent,
    canUndoApplyDiff,
    undoApplyDiffTool,
    undoingApplyDiffToolId,
    isDiffReviewTool,
    acceptingDiffToolId,
    acceptPendingDiff,
    hasDiffPreview,
    getDiffFilePaths,
    openDiffPreview,
    getStatusIcon,
    getStatusClass,
    renderToolContent
  }
}
