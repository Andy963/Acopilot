<script setup lang="ts">
import { computed, ref } from 'vue'
import { IconButton, Tooltip } from '../common'
import { useChatStore } from '../../stores'
import { copyToClipboard } from '../../utils/format'
import { sendToExtension, showNotification } from '../../utils/vscode'
import { useI18n } from '../../i18n'

const props = defineProps<{
  task: any
}>()

const { t } = useI18n()
const chatStore = useChatStore()

const expanded = ref(true)

const issueRef = computed(() => {
  const repo = String(props.task?.repo || '').trim()
  const number = props.task?.number
  if (repo && number) return `${repo}#${number}`
  return ''
})

const issueUrl = computed(() => String(props.task?.issueUrl || '').trim())
const intentSummary = computed(() => String(props.task?.intentSummary || '').trim())
const prompt = computed(() => String(props.task?.prompt || '').trim())

async function handleCopyPrompt() {
  if (!prompt.value) return
  const ok = await copyToClipboard(prompt.value)
  if (ok) {
    await showNotification(t('common.copy') + ' ' + t('common.success'), 'info')
  }
}

async function handleInsertToChat() {
  if (!prompt.value) return
  chatStore.setInputValue(prompt.value)
  await showNotification(t('common.paste') + ' ' + t('common.success'), 'info')
}

async function handleStart() {
  if (!prompt.value) return
  try {
    if (chatStore.hasPendingToolConfirmation) {
      await chatStore.rejectPendingToolsWithAnnotation(prompt.value)
      return
    }
    await chatStore.sendMessage(prompt.value)
  } catch (err) {
    console.error('Failed to start from task card:', err)
  }
}

async function handleOpenIssue() {
  if (!issueUrl.value) return
  try {
    await sendToExtension('issue.open', { url: issueUrl.value })
  } catch (err) {
    console.warn('Failed to open issue url:', err)
  }
}
</script>

<template>
  <div class="task-card">
    <div class="task-header" @click="expanded = !expanded">
      <i class="codicon" :class="expanded ? 'codicon-chevron-down' : 'codicon-chevron-right'"></i>
      <i class="codicon codicon-checklist task-icon"></i>
      <span class="task-title">Task</span>
      <span v-if="issueRef" class="task-subtitle">{{ issueRef }}</span>
      <div class="task-header-actions" @click.stop>
        <Tooltip content="Open issue" placement="bottom">
          <IconButton icon="codicon-link-external" size="small" :disabled="!issueUrl" @click="handleOpenIssue" />
        </Tooltip>
      </div>
    </div>

    <div v-if="expanded" class="task-body">
      <div class="task-row">
        <span class="task-label">Issue</span>
        <button class="task-link" :disabled="!issueUrl" @click="handleOpenIssue">
          {{ issueUrl || '-' }}
        </button>
      </div>

      <div class="task-section">
        <div class="task-section-title">Intent Summary</div>
        <div class="task-section-content">{{ intentSummary || '-' }}</div>
      </div>

      <div class="task-section">
        <div class="task-section-title">Suggested prompt</div>
        <pre class="task-prompt">{{ prompt || '-' }}</pre>
      </div>

      <div class="task-actions">
        <button class="task-btn" :disabled="!prompt" @click="handleCopyPrompt">{{ t('common.copy') }}</button>
        <button class="task-btn" :disabled="!prompt" @click="handleInsertToChat">Insert to chat</button>
        <button class="task-btn primary" :disabled="!prompt" @click="handleStart">
          <i class="codicon codicon-play"></i>
          {{ t('common.start') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-card {
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  background: rgba(127, 127, 127, 0.04);
  overflow: hidden;
}

.task-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  user-select: none;
}

.task-header:hover {
  background: var(--vscode-list-hoverBackground);
}

.task-icon {
  color: var(--vscode-textLink-foreground);
}

.task-title {
  font-weight: 600;
  font-size: 13px;
  color: var(--vscode-foreground);
}

.task-subtitle {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
  margin-left: 6px;
}

.task-header-actions {
  margin-left: auto;
  display: inline-flex;
  gap: 6px;
}

.task-body {
  padding: 12px;
  border-top: 1px solid var(--vscode-panel-border);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.task-label {
  width: 46px;
  flex-shrink: 0;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.task-link {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--vscode-panel-border);
  background: transparent;
  color: var(--vscode-textLink-foreground);
  font-size: 12px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-link:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.task-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.task-section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--vscode-foreground);
}

.task-section-content {
  font-size: 12px;
  color: var(--vscode-foreground);
  line-height: 1.4;
}

.task-prompt {
  margin: 0;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--vscode-panel-border);
  background: var(--vscode-textBlockQuote-background, rgba(127, 127, 127, 0.08));
  font-size: 12px;
  line-height: 1.4;
  color: var(--vscode-foreground);
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace);
}

.task-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.task-btn {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--vscode-panel-border);
  background: transparent;
  color: var(--vscode-foreground);
  font-size: 12px;
  cursor: pointer;
}

.task-btn:hover:not(:disabled) {
  background: var(--vscode-toolbar-hoverBackground);
}

.task-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.task-btn.primary {
  border: none;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.task-btn.primary:hover:not(:disabled) {
  background: var(--vscode-button-hoverBackground);
}
</style>

