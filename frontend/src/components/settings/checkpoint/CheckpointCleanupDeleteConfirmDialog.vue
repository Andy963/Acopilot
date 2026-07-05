<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/i18n'
import type { ConversationWithCheckpoints } from './types'
import { useCheckpointCleanupFormatting } from './useCheckpointCleanupFormatting'

const { t } = useI18n()
const { formatSize } = useCheckpointCleanupFormatting()

const props = defineProps<{
  showDeleteConfirm: boolean
  deleteConfirmTargets: ConversationWithCheckpoints[]
}>()

const emit = defineEmits<{
  cancelDelete: []
  confirmDelete: []
}>()

const deleteConfirmTotalCheckpoints = computed(() =>
  props.deleteConfirmTargets.reduce((sum, conversation) => sum + (conversation.checkpointCount || 0), 0)
)

const deleteConfirmTotalSize = computed(() =>
  props.deleteConfirmTargets.reduce((sum, conversation) => sum + (conversation.totalSize || 0), 0)
)

const deleteConfirmMessage = computed(() => {
  if (props.deleteConfirmTargets.length === 1) {
    const title = props.deleteConfirmTargets[0]?.title || ''
    return t('components.settings.checkpoint.sections.cleanup.confirmDelete.messageSingle', { title })
  }

  return t('components.settings.checkpoint.sections.cleanup.confirmDelete.messageSelected', {
    count: props.deleteConfirmTargets.length
  })
})
</script>

<template>
  <div v-if="showDeleteConfirm" class="delete-confirm-overlay" @click.self="emit('cancelDelete')">
    <div class="delete-confirm-dialog">
      <div class="dialog-header">
        <i class="codicon codicon-warning"></i>
        <span>{{ t('components.settings.checkpoint.sections.cleanup.confirmDelete.title') }}</span>
      </div>

      <div class="dialog-body">
        <p>{{ deleteConfirmMessage }}</p>
        <p class="delete-stats">
          {{ t('components.settings.checkpoint.sections.cleanup.confirmDelete.stats', {
            count: deleteConfirmTotalCheckpoints,
            size: formatSize(deleteConfirmTotalSize)
          }) }}
        </p>
        <p class="warning-text">{{ t('components.settings.checkpoint.sections.cleanup.confirmDelete.warning') }}</p>
      </div>
      <div class="dialog-footer">
        <button class="btn-cancel" @click="emit('cancelDelete')">{{ t('components.settings.checkpoint.sections.cleanup.confirmDelete.cancel') }}</button>
        <button class="btn-delete" @click="emit('confirmDelete')">{{ t('components.settings.checkpoint.sections.cleanup.confirmDelete.delete') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.delete-confirm-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  z-index: 1000;
}

.delete-confirm-dialog {
  width: min(480px, calc(100vw - 32px));
  padding: 16px;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  background: var(--vscode-editor-background);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.3);
}

.dialog-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
}

.dialog-body {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 12px;
}

.delete-stats,
.warning-text {
  margin: 0;
  color: var(--vscode-descriptionForeground);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.btn-cancel,
.btn-delete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 4px;
  border: 1px solid var(--vscode-panel-border);
  font-size: 12px;
  cursor: pointer;
}

.btn-cancel {
  background: transparent;
  color: var(--vscode-foreground);
}

.btn-delete {
  border-color: rgba(241, 76, 76, 0.35);
  background: rgba(241, 76, 76, 0.12);
  color: var(--vscode-errorForeground, #f14c4c);
}

.btn-cancel:hover,
.btn-delete:hover {
  background: var(--vscode-list-hoverBackground);
}
</style>
