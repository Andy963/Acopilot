<script setup lang="ts">
import { CustomScrollbar } from '../common'
import { useI18n } from '../../i18n'
import { formatErrorDetails } from '../../utils'
import { useChatStore } from '../../stores'

defineEmits<{
  cancel: []
}>()

const { t } = useI18n()
const chatStore = useChatStore()
</script>

<template>
  <div
    v-if="chatStore.retryStatus && chatStore.retryStatus.isRetrying"
    class="retry-panel"
  >
    <div class="retry-header">
      <i class="codicon codicon-warning warning-icon"></i>
      <span class="retry-title">{{ t('app.retryPanel.title') }}</span>
      <div class="retry-progress-inline">
        <i class="codicon codicon-sync spin"></i>
        <span>{{ chatStore.retryStatus.attempt }}/{{ chatStore.retryStatus.maxAttempts }}</span>
        <span v-if="chatStore.retryStatus.nextRetryIn" class="retry-countdown">
          ({{ Math.ceil((chatStore.retryStatus.nextRetryIn || 0) / 1000) }}s)
        </span>
      </div>
      <button class="retry-cancel-btn" @click="$emit('cancel')" :title="t('app.retryPanel.cancelTooltip')">
        <i class="codicon codicon-close"></i>
      </button>
    </div>
    <div class="retry-body">
      <CustomScrollbar :max-height="120" :width="4">
        <pre class="retry-error-json">{{ chatStore.retryStatus.error || t('app.retryPanel.defaultError') }}{{ chatStore.retryStatus.errorDetails ? '\n\n' + formatErrorDetails(chatStore.retryStatus.errorDetails) : '' }}</pre>
      </CustomScrollbar>
    </div>
  </div>
</template>

<style scoped>
.retry-panel {
  position: absolute;
  bottom: 12px;
  left: 12px;
  right: 12px;
  z-index: 100;
  background: var(--vscode-textBlockQuote-background, rgba(127, 127, 127, 0.1));
  border: 1px solid var(--vscode-panel-border, rgba(127, 127, 127, 0.3));
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  max-height: 200px;
}

.retry-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.1);
  border-bottom: 1px solid var(--vscode-panel-border, rgba(127, 127, 127, 0.2));
}

.warning-icon {
  font-size: 16px;
  color: var(--vscode-charts-yellow, #f0c674);
}

.retry-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--vscode-foreground);
}

.retry-progress-inline {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
  margin-left: auto;
  margin-right: 8px;
}

.retry-progress-inline .codicon {
  font-size: 12px;
  color: var(--vscode-charts-yellow, #f0c674);
}

.retry-cancel-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--vscode-foreground);
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.15s, background 0.15s;
}

.retry-cancel-btn:hover {
  opacity: 1;
  background: var(--vscode-toolbar-hoverBackground);
}

.retry-body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.retry-error-json {
  font-size: 11px;
  color: var(--vscode-foreground);
  line-height: 1.4;
  word-break: break-word;
  white-space: pre-wrap;
  font-family: var(--vscode-editor-font-family, monospace);
  background: rgba(0, 0, 0, 0.15);
  padding: 8px;
  border-radius: 4px;
  margin: 0;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.retry-countdown {
  color: var(--vscode-descriptionForeground);
}
</style>
