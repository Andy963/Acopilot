<script setup lang="ts">
/**
 * execute_command 工具的内容面板
 *
 * 显示：
 * - 命令执行状态
 * - 终端输出（实时更新）
 * - 杀掉终端按钮
 *
 * 使用 terminalStore 管理实时输出
 */

import { computed, ref, watch, onMounted, nextTick } from 'vue'
import { useTerminalStore } from '../../../stores/terminalStore'
import CustomScrollbar from '../../common/CustomScrollbar.vue'
import { useI18n } from '../../../composables/useI18n'
import { loadDiffContent as loadDiffContentFromBackend, sendToExtension } from '../../../utils/vscode'
import {
  computeDiffLines,
  formatLineNum,
  getDiffLineNumWidth,
  getDiffStats,
  type ChangedFileEntry,
  type ChangesSummary,
  type DiffContent,
  type DiffLine,
  type DiffStats,
  type FileChangeAction
} from './executeCommandDiff'
import {
  buildNextCommandSuggestions,
  createWorkspaceFileExists,
  detectPackageManager,
  formatDuration,
  parseFirstFileLocation,
  type PackageManager
} from './executeCommandDiagnostics'

const { t } = useI18n()

const props = defineProps<{
  args: Record<string, unknown>
  result?: Record<string, unknown>
  error?: string
  status?: 'pending' | 'running' | 'success' | 'error' | 'warning'
  toolId?: string
  embedded?: boolean
}>()

const emit = defineEmits<{
  (e: 'update-result', result: Record<string, unknown>): void
}>()

const isEmbedded = computed(() => props.embedded === true)

// 终端 store
const terminalStore = useTerminalStore()

// 杀掉终端的加载状态
const killing = ref(false)

const outputScrollRef = ref<InstanceType<typeof CustomScrollbar> | null>(null)

// 获取命令参数
const command = computed(() => props.args.command as string || '')
const cwd = computed(() => props.args.cwd as string || '')

// 获取结果数据（来自工具执行结果）
const resultData = computed(() => {
  const result = props.result as Record<string, any> | undefined
  return result?.data || {}
})

// 终端 ID（来自工具执行结果）
const terminalId = computed(() => resultData.value.terminalId as string || '')

// 从 store 获取终端状态
// 优先通过 terminalId 获取，如果没有则尝试通过命令匹配
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

// 输出内容 - 优先使用 store 中的实时输出，否则使用结果中的静态输出
const output = computed(() => {
  // 如果有实时终端状态，使用实时输出
  if (terminalState.value) {
    return terminalState.value.output
  }
  // 否则使用结果中的静态输出（历史记录）
  return resultData.value.output as string || ''
})

// 执行状态
const exitCode = computed(() => {
  // 优先使用实时状态
  if (terminalState.value && terminalState.value.exitCode !== undefined) {
    return terminalState.value.exitCode
  }
  return resultData.value.exitCode as number | undefined
})

const killed = computed(() => {
  // 优先使用实时状态
  if (terminalState.value) {
    return terminalState.value.killed || false
  }
  return resultData.value.killed as boolean || false
})

// 是否被用户取消
const cancelled = computed(() => {
  const result = props.result as Record<string, any> | undefined
  return result?.cancelled as boolean || false
})

const duration = computed(() => {
  // 优先使用实时状态
  if (terminalState.value && terminalState.value.duration !== undefined) {
    return terminalState.value.duration
  }
  return resultData.value.duration as number | undefined
})

const truncated = computed(() => resultData.value.truncated as boolean || false)
const totalLines = computed(() => resultData.value.totalLines as number || 0)
const outputLines = computed(() => resultData.value.outputLines as number || 0)

const changedFiles = computed((): ChangedFileEntry[] => {
  const raw = (resultData.value.changedFiles as unknown) ?? []
  if (!Array.isArray(raw)) return []

  return raw
    .map((r: any) => ({
      path: String(r?.path || '').trim(),
      action: String(r?.action || 'modified') as FileChangeAction,
      fromPath: r?.fromPath ? String(r.fromPath) : undefined,
      diffContentId: r?.diffContentId ?? null,
      skippedReason: r?.skippedReason ?? null
    }))
    .filter((f) => Boolean(f.path))
})

const changesSummary = computed((): ChangesSummary | null => {
  const s = resultData.value.changesSummary as any
  if (!s || typeof s !== 'object') return null
  return {
    totalFiles: Number(s.totalFiles) || 0,
    diffAvailableFiles: Number(s.diffAvailableFiles) || 0,
    skippedFiles: Number(s.skippedFiles) || 0,
    truncatedFiles: s.truncatedFiles !== undefined ? Number(s.truncatedFiles) : undefined,
    unsupportedReason: s.unsupportedReason ? String(s.unsupportedReason) : undefined
  }
})

const hasChangeSection = computed(() => {
  if (isRunning.value) return false

  // Only show the section when we have meaningful info to display:
  // - unsupportedReason: explain why changes can't be collected
  // - actual changes: avoid noisy "no changes" blocks that feel like flicker
  const summary = changesSummary.value
  if (summary?.unsupportedReason) return true
  return changeCount.value > 0
})

const changeCount = computed(() => changesSummary.value?.totalFiles ?? changedFiles.value.length)

const changeHeaderMeta = computed(() => {
  const s = changesSummary.value
  if (!s) return ''

  if (s.unsupportedReason) {
    return t('components.tools.terminal.executeCommandPanel.fileChanges.unsupported')
  }

  const parts: string[] = []
  if (s.diffAvailableFiles > 0) {
    parts.push(t('components.tools.terminal.executeCommandPanel.fileChanges.diffAvailable', { count: s.diffAvailableFiles }))
  }
  if (s.skippedFiles > 0) {
    parts.push(t('components.tools.terminal.executeCommandPanel.fileChanges.skipped', { count: s.skippedFiles }))
  }
  if (s.truncatedFiles && s.truncatedFiles > 0) {
    parts.push(t('components.tools.terminal.executeCommandPanel.fileChanges.truncated', { count: s.truncatedFiles }))
  }
  return parts.join(' · ')
})

const changesExpanded = ref(false)
const changesUserToggled = ref(false)

const headerChangesPreviewLimit = 2

function getPathBasename(p: string): string {
  const normalized = String(p || '').replace(/\\/g, '/')
  const parts = normalized.split('/').filter(Boolean)
  return parts.length > 0 ? parts[parts.length - 1] : normalized
}

const showHeaderChangesPreview = computed(() => {
  if (isRunning.value) return false
  if (expanded.value) return false
  return changedFiles.value.length > 0
})

const headerPreviewFiles = computed(() => changedFiles.value.slice(0, headerChangesPreviewLimit))

const headerMoreCount = computed(() => {
  const total = changeCount.value
  const shown = headerPreviewFiles.value.length
  return Math.max(0, total - shown)
})

const defaultChangesExpanded = computed(() => {
  // 默认保持收起，避免内容跳动/闪烁（更贴近 Copilot Chat 的“按需展开”体验）
  return false
})

function toggleChangesExpanded() {
  changesExpanded.value = !effectiveChangesExpanded.value
  changesUserToggled.value = true
}

const effectiveChangesExpanded = computed(() => {
  if (changesUserToggled.value) return changesExpanded.value
  return defaultChangesExpanded.value
})

watch(
  () => props.toolId,
  () => {
    changesUserToggled.value = false
    changesExpanded.value = false
  },
  { immediate: true }
)

const expandedDiffFiles = ref<Set<string>>(new Set())
const diffContents = ref<Map<string, DiffContent>>(new Map())
const loadingDiffs = ref<Set<string>>(new Set())
const diffLoadErrors = ref<Map<string, string>>(new Map())
const diffLinesByFile = ref<Map<string, DiffLine[]>>(new Map())
const diffStats = ref<Map<string, DiffStats>>(new Map())

const previewDiffLineCount = 20

function isDiffExpanded(filePath: string): boolean {
  return expandedDiffFiles.value.has(filePath)
}

function setDiffExpanded(filePath: string, expanded: boolean) {
  const next = new Set(expandedDiffFiles.value)
  if (expanded) next.add(filePath)
  else next.delete(filePath)
  expandedDiffFiles.value = next
}

function isLoadingDiff(filePath: string): boolean {
  return loadingDiffs.value.has(filePath)
}

function setLoadingDiff(filePath: string, loading: boolean) {
  const next = new Set(loadingDiffs.value)
  if (loading) next.add(filePath)
  else next.delete(filePath)
  loadingDiffs.value = next
}

function getDiffContent(filePath: string): DiffContent | null {
  return diffContents.value.get(filePath) || null
}

function getDiffLines(filePath: string): DiffLine[] | null {
  return diffLinesByFile.value.get(filePath) || null
}

function getDiffError(filePath: string): string | null {
  return diffLoadErrors.value.get(filePath) || null
}

function getDiffStatsForFile(filePath: string): DiffStats | null {
  return diffStats.value.get(filePath) || null
}

async function ensureDiffLoaded(file: ChangedFileEntry) {
  if (!file.diffContentId) return
  if (diffContents.value.has(file.path)) return
  if (loadingDiffs.value.has(file.path)) return

  setLoadingDiff(file.path, true)
  diffLoadErrors.value.delete(file.path)
  try {
    const resp = await loadDiffContentFromBackend(String(file.diffContentId))
    if (!resp) {
      throw new Error('Failed to load diff content')
    }

    diffContents.value.set(file.path, resp as unknown as DiffContent)

    const lines = computeDiffLines(resp.originalContent, resp.newContent)
    diffLinesByFile.value.set(file.path, lines)
    diffStats.value.set(file.path, getDiffStats(lines))
  } catch (err: any) {
    diffLoadErrors.value.set(file.path, err?.message || t('common.failed'))
  } finally {
    setLoadingDiff(file.path, false)
  }
}

async function toggleFileDiff(file: ChangedFileEntry) {
  if (!file.path) return
  const next = !isDiffExpanded(file.path)
  setDiffExpanded(file.path, next)
  if (next) {
    await ensureDiffLoaded(file)
  }
}

async function openFileDiffInVSCode(file: ChangedFileEntry) {
  if (!file.diffContentId) return

  try {
    const serializedArgs = JSON.parse(JSON.stringify(props.args || {}))
    const serializedResult = props.result ? JSON.parse(JSON.stringify(props.result)) : undefined

    await sendToExtension('diff.openPreview', {
      toolId: props.toolId || '',
      toolName: 'execute_command',
      filePaths: [file.path],
      args: serializedArgs,
      result: serializedResult
    })
  } catch (err) {
    console.warn('Failed to open diff preview:', err)
  }
}

async function openChangedFile(file: ChangedFileEntry) {
  if (!file.path) return
  try {
    await sendToExtension('openWorkspaceFile', { path: file.path })
  } catch (err) {
    console.warn('Failed to open file:', err)
  }
}

async function handleHeaderChangeClick(file: ChangedFileEntry) {
  if (!file.path) return

  if (file.diffContentId) {
    await openFileDiffInVSCode(file)
    return
  }

  toggleExpanded()
}

function getActionLabel(action: FileChangeAction): string {
  switch (action) {
    case 'created':
      return t('components.tools.terminal.executeCommandPanel.fileChanges.actions.created')
    case 'deleted':
      return t('components.tools.terminal.executeCommandPanel.fileChanges.actions.deleted')
    case 'renamed':
      return t('components.tools.terminal.executeCommandPanel.fileChanges.actions.renamed')
    case 'modified':
    default:
      return t('components.tools.terminal.executeCommandPanel.fileChanges.actions.modified')
  }
}

function getActionIcon(action: FileChangeAction): string {
  switch (action) {
    case 'created':
      return 'codicon-new-file'
    case 'deleted':
      return 'codicon-trash'
    case 'renamed':
      return 'codicon-arrow-right'
    case 'modified':
    default:
      return 'codicon-edit'
  }
}

function needsDiffExpand(lines: DiffLine[]): boolean {
  return lines.length > previewDiffLineCount
}

function getDisplayDiffLines(lines: DiffLine[], filePath: string): DiffLine[] {
  if (!needsDiffExpand(lines)) return lines
  if (expandedFiles.value.has(filePath + '_diff')) return lines
  return lines.slice(0, previewDiffLineCount)
}

function toggleDiffExpand(filePath: string) {
  const key = filePath + '_diff'
  if (expandedFiles.value.has(key)) {
    expandedFiles.value.delete(key)
  } else {
    expandedFiles.value.add(key)
  }
}

function isDiffFullyExpanded(filePath: string): boolean {
  return expandedFiles.value.has(filePath + '_diff')
}

// 是否正在运行
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

// 执行状态标签
const statusLabel = computed(() => {
  // 检查结果中的 error 字段
  const result = props.result as Record<string, any> | undefined
  const resultError = result?.error as string | undefined
  
  // 优先检测取消状态（用户点击了取消按钮）
  if (cancelled.value || killed.value) {
    return t('components.tools.terminal.executeCommandPanel.status.terminated')
  }
  if (props.error || resultError) return t('components.tools.terminal.executeCommandPanel.status.failed')
  if (exitCode.value === 0) return t('components.tools.terminal.executeCommandPanel.status.success')
  if (exitCode.value !== undefined) return t('components.tools.terminal.executeCommandPanel.status.exitCode', { code: exitCode.value })
  if (isRunning.value) return t('components.tools.terminal.executeCommandPanel.status.running')
  return t('components.tools.terminal.executeCommandPanel.status.pending')
})

// 状态颜色类
const statusClass = computed(() => {
  // 检查结果中的 error 字段
  const result = props.result as Record<string, any> | undefined
  const resultError = result?.error as string | undefined
  
  // 优先检测取消状态（用户点击了取消按钮）
  if (cancelled.value || killed.value) return 'terminated'
  if (props.error || resultError) return 'error'
  if (exitCode.value !== undefined && exitCode.value !== 0) return 'error'
  if (exitCode.value === 0) return 'success'
  if (isRunning.value) return 'running'
  return 'pending'
})

const statusIcon = computed(() => {
  // 检查结果中的 error 字段
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
  // 运行中 / 失败 / 退出码非 0 / 被终止：默认展开
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

// ========== 建议下一条命令（基于错误类型）==========

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
    console.error('复制建议命令失败:', err)
  }
}

const canOpenFirstError = computed(() =>
  hasFailure.value && !isRunning.value && !!firstErrorLocation.value
)

const showEmbeddedActions = computed(() =>
  isEmbedded.value && (
    (truncated.value && !isRunning.value) ||
    isRunning.value ||
    canOpenFirstError.value
  )
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
const expandedFiles = ref<Set<string>>(new Set())

function toggleExpanded() {
  if (isEmbedded.value) return
  expanded.value = !expanded.value
  userToggled.value = true
}

// 实际的终端标识（用于注册和杀死）
// 优先使用 result 中的 terminalId，其次通过命令匹配
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

// 杀掉终端
async function handleKillTerminal() {
  if (!effectiveTerminalId.value || killing.value) {
    return
  }
  
  killing.value = true
  
  try {
    const result = await terminalStore.killTerminal(effectiveTerminalId.value)
    
    if (result.success) {
      // 更新结果显示被杀掉
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
    console.error('杀掉终端失败:', err)
  } finally {
    killing.value = false
  }
}

// 组件挂载时，如果正在运行，注册到 store
onMounted(() => {
  if (isRunning.value && effectiveTerminalId.value) {
    terminalStore.registerTerminal(effectiveTerminalId.value)
  }
})

// 初始化/同步默认展开状态（成功默认收起）
watch(() => props.toolId, () => {
  userToggled.value = false
  expanded.value = isEmbedded.value ? true : defaultExpanded.value
}, { immediate: true })

watch(defaultExpanded, (next) => {
  if (isEmbedded.value) return
  if (!userToggled.value && next) {
    expanded.value = true
  }
})

// 展开时，默认滚动到最底部（更像终端）
watch(expanded, (isExpanded) => {
  if (!isExpanded) return
  nextTick(() => {
    outputScrollRef.value?.scrollToBottom()
  })
})

// 监听终端 ID 变化
watch(effectiveTerminalId, (newId) => {
  if (newId && isRunning.value) {
    terminalStore.registerTerminal(newId)
  }
})

// 监听运行状态变化
watch(isRunning, (running) => {
  if (running && effectiveTerminalId.value) {
    terminalStore.registerTerminal(effectiveTerminalId.value)
  }
})
</script>

<template>
  <div class="execute-command-panel" :class="[statusClass, { running: isRunning, expanded, embedded: isEmbedded }]">
    <!-- 头部信息栏 -->
    <div
      v-if="!isEmbedded"
      class="panel-header"
      role="button"
      tabindex="0"
      :title="commandTooltip"
      @click="toggleExpanded"
      @keydown.enter.prevent="toggleExpanded"
      @keydown.space.prevent="toggleExpanded"
    >
      <span
        class="status-icon codicon"
        :class="[statusIcon, statusClass, { 'codicon-modifier-spin': isRunning }]"
        :title="statusLabel"
      ></span>
      <span class="prompt">$</span>
      <code class="command-text" :title="commandTooltip">{{ command }}</code>

      <span
        v-if="truncated && !isRunning"
        class="truncated-indicator codicon codicon-warning"
        :title="t('components.tools.terminal.executeCommandPanel.truncatedInfo', { outputLines, totalLines })"
      ></span>

      <span v-if="duration !== undefined" class="duration">
        {{ formatDuration(duration) }}
      </span>

      <div
        v-if="showHeaderChangesPreview"
        class="changes-preview-header"
        @click.stop
      >
        <i
          class="codicon codicon-diff"
          :title="t('components.tools.terminal.executeCommandPanel.fileChanges.title')"
        ></i>

        <button
          v-for="f in headerPreviewFiles"
          :key="f.path"
          class="change-chip"
          :class="{ disabled: !f.diffContentId }"
          :title="f.diffContentId ? `${t('components.tools.terminal.executeCommandPanel.fileChanges.viewInVSCode')}: ${f.path}` : (f.skippedReason ? String(f.skippedReason) : t('components.tools.terminal.executeCommandPanel.fileChanges.diffUnavailable'))"
          @click.stop="handleHeaderChangeClick(f)"
        >
          {{ getPathBasename(f.path) }}
        </button>

        <button
          v-if="headerMoreCount > 0"
          class="change-chip more"
          :title="t('common.expand')"
          @click.stop="toggleExpanded"
        >
          +{{ headerMoreCount }}
        </button>
      </div>

      <div class="header-actions" @click.stop>
        <button
          v-if="isRunning"
          class="icon-btn danger"
          :disabled="killing"
          :title="t('components.tools.terminal.executeCommandPanel.terminateTooltip')"
          @click.stop="handleKillTerminal"
        >
          <span class="codicon codicon-debug-stop"></span>
        </button>

        <button
          v-if="canOpenFirstError"
          class="icon-btn"
          :disabled="opening"
          :title="openFirstErrorTitle"
          @click.stop="openFirstError"
        >
          <span class="codicon codicon-go-to-file"></span>
        </button>

        <!-- 交互操作已精简：点击整行即可展开/收起 -->
      </div>
    </div>

    <!-- 终端输出块 -->
    <div v-if="expanded || isEmbedded" class="panel-body">
      <div v-if="showEmbeddedActions" class="embedded-actions" @click.stop>
        <span
          v-if="truncated && !isRunning"
          class="embedded-truncated codicon codicon-warning"
          :title="t('components.tools.terminal.executeCommandPanel.truncatedInfo', { outputLines, totalLines })"
        ></span>

        <button
          v-if="isRunning"
          class="icon-btn danger"
          :disabled="killing"
          :title="t('components.tools.terminal.executeCommandPanel.terminateTooltip')"
          @click.stop="handleKillTerminal"
        >
          <span class="codicon codicon-debug-stop"></span>
        </button>

        <button
          v-if="canOpenFirstError"
          class="icon-btn"
          :disabled="opening"
          :title="openFirstErrorTitle"
          @click.stop="openFirstError"
        >
          <span class="codicon codicon-go-to-file"></span>
        </button>

      </div>

      <div v-if="hasChangeSection" class="changes-card">
        <div class="changes-header" @click="toggleChangesExpanded">
          <i class="codicon" :class="changesExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'"></i>
          <i class="codicon codicon-diff"></i>
          <span class="changes-title">{{ t('components.tools.terminal.executeCommandPanel.fileChanges.title') }}</span>
          <span v-if="changeCount > 0" class="changes-count">({{ changeCount }})</span>
          <span v-if="changeHeaderMeta" class="changes-meta">{{ changeHeaderMeta }}</span>
        </div>

        <div v-if="changesExpanded" class="changes-body">
          <div v-if="changesSummary?.unsupportedReason" class="changes-empty warning">
            <i class="codicon codicon-info"></i>
            <span>{{ t('components.tools.terminal.executeCommandPanel.fileChanges.notSupported') }}</span>
          </div>

          <div v-else-if="changedFiles.length === 0" class="changes-empty">
            <i class="codicon codicon-check"></i>
            <span>{{ t('components.tools.terminal.executeCommandPanel.fileChanges.noChanges') }}</span>
          </div>

          <div v-else class="changes-list">
            <div v-for="f in changedFiles" :key="f.path" class="change-item">
              <div class="change-row">
                <i class="codicon change-icon" :class="getActionIcon(f.action)"></i>
                <code class="change-path" :title="f.fromPath ? `${f.fromPath} → ${f.path}` : f.path">
                  {{ f.fromPath ? `${f.fromPath} → ${f.path}` : f.path }}
                </code>
                <span class="change-action" :class="`action-${f.action}`">{{ getActionLabel(f.action) }}</span>

                <span v-if="getDiffStatsForFile(f.path)" class="change-stats">
                  +{{ getDiffStatsForFile(f.path)!.added }} / -{{ getDiffStatsForFile(f.path)!.deleted }}
                </span>
                <span v-else-if="f.diffContentId" class="change-stats placeholder">+— / -—</span>

                <span v-if="f.skippedReason" class="change-skipped" :title="String(f.skippedReason)">
                  {{ t('components.tools.terminal.executeCommandPanel.fileChanges.diffUnavailable') }}
                </span>

                <div class="change-actions" @click.stop>
                  <button
                    class="small-btn"
                    :disabled="!f.diffContentId"
                    :title="f.diffContentId ? t('components.tools.terminal.executeCommandPanel.fileChanges.expandDiff') : (f.skippedReason || t('components.tools.terminal.executeCommandPanel.fileChanges.diffUnavailable'))"
                    @click.stop="toggleFileDiff(f)"
                  >
                    <i class="codicon" :class="isDiffExpanded(f.path) ? 'codicon-chevron-up' : 'codicon-chevron-down'"></i>
                    <span class="btn-text">{{ t('components.tools.terminal.executeCommandPanel.fileChanges.expandDiff') }}</span>
                  </button>
                  <button
                    class="small-btn compact"
                    :disabled="!f.diffContentId"
                    :title="t('components.tools.terminal.executeCommandPanel.fileChanges.viewInVSCode')"
                    @click.stop="openFileDiffInVSCode(f)"
                  >
                    <i class="codicon codicon-open-preview"></i>
                    <span class="btn-text">{{ t('components.tools.terminal.executeCommandPanel.fileChanges.viewInVSCode') }}</span>
                  </button>
                  <button class="small-btn" @click.stop="openChangedFile(f)">
                    <i class="codicon codicon-go-to-file"></i>
                    <span class="btn-text">{{ t('components.tools.terminal.executeCommandPanel.fileChanges.openFile') }}</span>
                  </button>
                </div>
              </div>

              <div v-if="isDiffExpanded(f.path)" class="change-diff">
                <div v-if="isLoadingDiff(f.path)" class="diff-loading">
                  <i class="codicon codicon-loading codicon-modifier-spin"></i>
                  <span>{{ t('components.tools.terminal.executeCommandPanel.fileChanges.loadingDiff') }}</span>
                </div>

                <div v-else-if="getDiffError(f.path)" class="diff-loading error">
                  <i class="codicon codicon-error"></i>
                  <span>{{ getDiffError(f.path) }}</span>
                </div>

                <div v-else-if="getDiffContent(f.path)" class="diff-view">
                  <CustomScrollbar :horizontal="true" :max-height="260">
                    <div class="diff-lines">
                      <div
                        v-for="(line, idx) in getDisplayDiffLines(getDiffLines(f.path) || [], f.path)"
                        :key="idx"
                        :class="['diff-line', `line-${line.type}`]"
                      >
                        <span class="line-nums">
                          <span class="old-num">{{ formatLineNum(line.oldLineNum, getDiffLineNumWidth(getDiffContent(f.path)!)) }}</span>
                          <span class="new-num">{{ formatLineNum(line.newLineNum, getDiffLineNumWidth(getDiffContent(f.path)!)) }}</span>
                        </span>
                        <span class="line-marker">
                          <span v-if="line.type === 'deleted'" class="marker deleted">-</span>
                          <span v-else-if="line.type === 'added'" class="marker added">+</span>
                          <span v-else class="marker unchanged">&nbsp;</span>
                        </span>
                        <span class="line-content">{{ line.content || ' ' }}</span>
                      </div>
                    </div>
                  </CustomScrollbar>

                  <div
                    v-if="needsDiffExpand(getDiffLines(f.path) || [])"
                    class="expand-section"
                  >
                    <button class="expand-btn" @click.stop="toggleDiffExpand(f.path)">
                      <i class="codicon" :class="isDiffFullyExpanded(f.path) ? 'codicon-chevron-up' : 'codicon-chevron-down'"></i>
                      {{
                        isDiffFullyExpanded(f.path)
                          ? t('common.collapse')
                          : t('components.tools.terminal.executeCommandPanel.fileChanges.expandRemaining', {
                              count: (getDiffLines(f.path) || []).length - previewDiffLineCount
                            })
                      }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="hasNextSuggestions" class="next-commands">
        <div class="next-commands-title">
          <i class="codicon codicon-lightbulb"></i>
          <span>{{ t('components.tools.terminal.executeCommandPanel.nextCommandsTitle') }}</span>
        </div>
        <div class="next-commands-list">
          <div v-for="c in nextCommandSuggestions" :key="c" class="next-command-row">
            <code class="next-command-code">{{ c }}</code>
            <button
              class="icon-btn"
              :class="{ success: copiedSuggestion === c }"
              :title="copiedSuggestion === c ? t('common.copied') : t('common.copy')"
              @click.stop="copySuggestionCommand(c)"
            >
              <span :class="['codicon', copiedSuggestion === c ? 'codicon-check' : 'codicon-copy']"></span>
            </button>
          </div>
        </div>
      </div>

      <!-- 注意：即使命令失败（exitCode != 0），也应展示 stdout/stderr，便于用户排查 -->
      <div v-if="error || resultData.error" class="output-content error">
        <pre class="output-code"><code>{{ error || resultData.error }}</code></pre>
      </div>

      <div v-if="output || isRunning" class="output-content">
        <CustomScrollbar
          ref="outputScrollRef"
          :horizontal="true"
          :max-height="300"
          :sticky-bottom="isRunning"
        >
          <pre class="output-code"><code>{{ output || t('components.tools.terminal.executeCommandPanel.waitingOutput') }}</code></pre>
        </CustomScrollbar>
      </div>

      <div v-else class="output-empty">
        <span class="codicon codicon-info"></span>
        <span>{{ t('components.tools.terminal.executeCommandPanel.noOutput') }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped src="./execute_command.part1.css"></style>
<style scoped src="./execute_command.part2.css"></style>
