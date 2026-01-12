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
import { sendToExtension } from '../../../utils/vscode'

const { t } = useI18n()

const props = defineProps<{
  args: Record<string, unknown>
  result?: Record<string, unknown>
  error?: string
  status?: 'pending' | 'running' | 'success' | 'error'
  toolId?: string
}>()

const emit = defineEmits<{
  (e: 'update-result', result: Record<string, unknown>): void
}>()

// 终端 store
const terminalStore = useTerminalStore()

// 杀掉终端的加载状态
const killing = ref(false)

const outputScrollRef = ref<InstanceType<typeof CustomScrollbar> | null>(null)

// 获取命令参数
const command = computed(() => props.args.command as string || '')
const cwd = computed(() => props.args.cwd as string || '')
const shell = computed(() => props.args.shell as string || 'default')

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

// 格式化持续时间
function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return ''
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

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
  if (shell.value && shell.value !== 'default') lines.push(`Shell: ${shell.value}`)
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

// ========== 错误定位（打开报错文件/跳转到行列）==========

interface FileLocation {
  path: string
  line: number
  column: number
}

function stripAnsi(input: string): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/\u001b\[[0-9;]*m/g, '')
}

function normalizePathToken(p: string): string {
  return p.trim().replace(/^[`"'(]+/, '').replace(/[`"'),;]+$/, '')
}

function looksLikeFilePath(p: string): boolean {
  if (!p) return false
  if (p.includes('://')) return false
  return p.includes('/') || p.includes('\\') || p.includes('.')
}

function parseFirstFileLocation(text: string): FileLocation | null {
  if (!text) return null
  const lines = stripAnsi(text).split(/\r?\n/)

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    // tsc: path(line,col)
    let m = line.match(/(.+?)\((\d+),(\d+)\)/)
    if (m) {
      const p = normalizePathToken(m[1])
      if (looksLikeFilePath(p)) return { path: p, line: Number(m[2]), column: Number(m[3]) }
    }

    // Windows: C:\path\to\file:line:col
    m = line.match(/([A-Za-z]:\\.+?):(\d+):(\d+)/)
    if (m) {
      const p = normalizePathToken(m[1])
      if (looksLikeFilePath(p)) return { path: p, line: Number(m[2]), column: Number(m[3]) }
    }

    // Common: path:line:col
    m = line.match(/([^\s:()]+):(\d+):(\d+)/)
    if (m) {
      const p = normalizePathToken(m[1])
      if (looksLikeFilePath(p)) return { path: p, line: Number(m[2]), column: Number(m[3]) }
    }
  }

  return null
}

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

const canOpenFirstError = computed(() =>
  hasFailure.value && !isRunning.value && !!firstErrorLocation.value
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

const expanded = ref(false)
const userToggled = ref(false)

function toggleExpanded() {
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

// 复制输出
const copied = ref(false)
async function copyOutput() {
  if (!output.value) return
  
  try {
    await navigator.clipboard.writeText(output.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 1000)
  } catch (err) {
    console.error('复制失败:', err)
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
  expanded.value = defaultExpanded.value
}, { immediate: true })

watch(defaultExpanded, (next) => {
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
  <div class="execute-command-panel" :class="[statusClass, { running: isRunning, expanded }]">
    <!-- 头部信息栏 -->
    <div
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

        <button
          v-if="output"
          class="icon-btn"
          :class="{ success: copied }"
          :title="copied ? t('components.tools.terminal.executeCommandPanel.copied') : t('components.tools.terminal.executeCommandPanel.copyOutput')"
          @click.stop="copyOutput"
        >
          <span :class="['codicon', copied ? 'codicon-check' : 'codicon-copy']"></span>
        </button>

        <button
          class="icon-btn"
          :title="expanded ? t('common.collapse') : t('common.expand')"
          @click.stop="toggleExpanded"
        >
          <span :class="['codicon', expanded ? 'codicon-chevron-down' : 'codicon-chevron-right']"></span>
        </button>
      </div>
    </div>

    <!-- 终端输出块 -->
    <div v-if="expanded" class="panel-body">
      <div v-if="error || resultData.error" class="output-content error">
        <pre class="output-code"><code>{{ error || resultData.error }}</code></pre>
      </div>

      <div v-else-if="output || isRunning" class="output-content">
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

<style scoped>
.execute-command-panel {
  border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
  border-radius: 8px;
  overflow: hidden;
  background: var(--vscode-editor-background);
}

/* 头部信息栏 */
.panel-header {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--vscode-editor-inactiveSelectionBackground);
  cursor: pointer;
  user-select: none;
  min-width: 0;
}

.panel-header:hover {
  background: var(--vscode-list-hoverBackground);
}

.execute-command-panel.running .panel-header::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--vscode-charts-blue) 30%,
    transparent 60%
  );
  background-size: 200% 100%;
  animation: running-bar 1.2s linear infinite;
  opacity: 0.7;
}

@keyframes running-bar {
  from {
    background-position: 0% 0%;
  }
  to {
    background-position: 200% 0%;
  }
}

.status-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.status-icon.success {
  color: var(--vscode-testing-iconPassed);
}

.status-icon.error {
  color: var(--vscode-testing-iconFailed);
}

.status-icon.terminated {
  color: var(--vscode-descriptionForeground);
}

.status-icon.running {
  color: var(--vscode-charts-blue);
}

.status-icon.pending {
  color: var(--vscode-descriptionForeground);
}

.prompt {
  color: var(--vscode-terminal-ansiGreen);
  font-family: var(--vscode-editor-font-family);
  font-weight: 700;
  flex-shrink: 0;
}

.command-text {
  flex: 1;
  min-width: 0;
  font-family: var(--vscode-editor-font-family);
  font-size: 12px;
  font-weight: 600;
  color: var(--vscode-foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.truncated-indicator {
  font-size: 14px;
  color: var(--vscode-descriptionForeground);
  flex-shrink: 0;
  opacity: 0.8;
}

.duration {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  flex-shrink: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  opacity: 0.75;
  transition: opacity var(--transition-fast, 0.1s);
}

.execute-command-panel:hover .header-actions {
  opacity: 1;
}

.icon-btn {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: var(--vscode-descriptionForeground);
  cursor: pointer;
  transition: background var(--transition-fast, 0.1s),
    color var(--transition-fast, 0.1s),
    opacity var(--transition-fast, 0.1s);
}

.icon-btn:hover {
  background: var(--vscode-toolbar-hoverBackground);
  color: var(--vscode-foreground);
}

.icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.icon-btn.success {
  color: var(--vscode-testing-iconPassed);
}

.icon-btn.danger {
  color: var(--vscode-testing-iconFailed);
}

.icon-btn.danger:hover {
  background: var(--vscode-inputValidation-errorBackground);
  border-color: var(--vscode-inputValidation-errorBorder);
  color: var(--vscode-inputValidation-errorForeground);
}

/* 输出块 */
.panel-body {
  border-top: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
}

.output-content {
  background: var(--vscode-terminal-background, var(--vscode-editor-background));
}

.output-content.error {
  background: var(--vscode-inputValidation-errorBackground);
}

.output-content :deep(.scroll-container) {
  background: transparent;
}

.output-code {
  margin: 0;
  padding: 8px 12px;
  font-size: 12px;
  font-family: var(--vscode-editor-font-family);
  color: var(--vscode-terminal-foreground, var(--vscode-foreground));
  line-height: 1.4;
  white-space: pre;
}

.output-code code {
  font-family: inherit;
}

.output-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 12px;
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
}
</style>
