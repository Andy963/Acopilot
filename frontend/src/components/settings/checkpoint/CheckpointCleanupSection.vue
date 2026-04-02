<script setup lang="ts">
import { CustomCheckbox } from '@/components/common'
import { useI18n } from '@/i18n'
import type { ConversationWithCheckpoints } from './types'
import CheckpointCleanupDeleteConfirmDialog from './CheckpointCleanupDeleteConfirmDialog.vue'
import CheckpointCleanupList from './CheckpointCleanupList.vue'

const { t } = useI18n()

defineProps<{
  autoCleanup: boolean
  searchQuery: string
  conversations: ConversationWithCheckpoints[]
  isCleanupLoading: boolean
  isDeletingAny: boolean
  selectedConversationIds: Set<string>
  deletingConversationIds: Set<string>
  showDeleteConfirm: boolean
  deleteConfirmTargets: ConversationWithCheckpoints[]
}>()

const emit = defineEmits<{
  'update:autoCleanup': [value: boolean]
  'update:searchQuery': [value: string]
  toggleSelectAllFiltered: [selected: boolean]
  clearSelection: []
  toggleConversationSelected: [payload: { conversationId: string; selected: boolean }]
  requestDeleteConversation: [conversation: ConversationWithCheckpoints]
  requestDeleteSelected: []
  refresh: []
  cancelDelete: []
  confirmDelete: []
}>()
</script>

<template>
  <div class="setting-group">
    <h4 class="group-title">
      <i class="codicon codicon-trash"></i>
      {{ t('components.settings.checkpoint.sections.cleanup.title') }}
    </h4>
    <p class="setting-description">
      {{ t('components.settings.checkpoint.sections.cleanup.description') }}
    </p>

    <div class="form-row">
      <CustomCheckbox
        :modelValue="autoCleanup"
        :label="t('components.settings.checkpoint.sections.other.autoCleanup.label')"
        :hint="t('components.settings.checkpoint.sections.other.autoCleanup.hint')"
        @update:modelValue="emit('update:autoCleanup', $event)"
      />
    </div>

    <CheckpointCleanupList
      :search-query="searchQuery"
      :conversations="conversations"
      :is-cleanup-loading="isCleanupLoading"
      :is-deleting-any="isDeletingAny"
      :selected-conversation-ids="selectedConversationIds"
      :deleting-conversation-ids="deletingConversationIds"
      @update:search-query="emit('update:searchQuery', $event)"
      @toggle-select-all-filtered="emit('toggleSelectAllFiltered', $event)"
      @clear-selection="emit('clearSelection')"
      @toggle-conversation-selected="emit('toggleConversationSelected', $event)"
      @request-delete-conversation="emit('requestDeleteConversation', $event)"
      @request-delete-selected="emit('requestDeleteSelected')"
      @refresh="emit('refresh')"
    />
  </div>

  <CheckpointCleanupDeleteConfirmDialog
    :show-delete-confirm="showDeleteConfirm"
    :delete-confirm-targets="deleteConfirmTargets"
    @cancel-delete="emit('cancelDelete')"
    @confirm-delete="emit('confirmDelete')"
  />
</template>

<style scoped>
.setting-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.group-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 13px;
  font-weight: 500;
}

.group-title .codicon {
  font-size: 14px;
  color: var(--vscode-foreground);
}

.setting-description {
  margin: 0;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
