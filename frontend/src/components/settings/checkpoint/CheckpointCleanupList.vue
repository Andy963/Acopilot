<script setup lang="ts">
import { computed } from 'vue'
import { CustomCheckbox, CustomScrollbar } from '@/components/common'
import { useI18n } from '@/i18n'
import type { ConversationWithCheckpoints } from './types'
import { useCheckpointCleanupFormatting } from './useCheckpointCleanupFormatting'

const { t } = useI18n()
const { formatCheckpointCount, formatRelativeTime, formatSize } = useCheckpointCleanupFormatting()

const props = defineProps<{
  searchQuery: string
  conversations: ConversationWithCheckpoints[]
  isCleanupLoading: boolean
  isDeletingAny: boolean
  selectedConversationIds: Set<string>
  deletingConversationIds: Set<string>
}>()

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  toggleSelectAllFiltered: [selected: boolean]
  clearSelection: []
  toggleConversationSelected: [payload: { conversationId: string; selected: boolean }]
  requestDeleteConversation: [conversation: ConversationWithCheckpoints]
  requestDeleteSelected: []
  refresh: []
}>()

const filteredConversations = computed(() => {
  if (!props.searchQuery.trim()) return props.conversations

  const query = props.searchQuery.toLowerCase()
  return props.conversations.filter(conversation =>
    conversation.title.toLowerCase().includes(query) ||
    conversation.conversationId.toLowerCase().includes(query)
  )
})

const selectedCount = computed(() => props.selectedConversationIds.size)

const isAllFilteredSelected = computed(() => {
  const conversations = filteredConversations.value
  return conversations.length > 0 && conversations.every(conversation => props.selectedConversationIds.has(conversation.conversationId))
})

function isConversationSelected(conversationId: string): boolean {
  return props.selectedConversationIds.has(conversationId)
}
</script>

<template>
  <div class="search-box">
    <i class="codicon codicon-search"></i>
    <input
      :value="searchQuery"
      type="text"
      :placeholder="t('components.settings.checkpoint.sections.cleanup.searchPlaceholder')"
      class="search-input"
      :disabled="isDeletingAny"
      @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
    />
    <button
      v-if="searchQuery"
      class="clear-search"
      :disabled="isDeletingAny"
      @click="emit('update:searchQuery', '')"
    >
      <i class="codicon codicon-close"></i>
    </button>
  </div>

  <div class="conversations-list-wrapper">
    <CustomScrollbar>
      <div class="conversations-list">
        <div v-if="isCleanupLoading" class="list-loading">
          <i class="codicon codicon-loading codicon-modifier-spin"></i>
          <span>{{ t('components.settings.checkpoint.sections.cleanup.loading') }}</span>
        </div>

        <div v-else-if="filteredConversations.length === 0" class="list-empty">
          <i class="codicon codicon-inbox"></i>
          <span v-if="searchQuery">{{ t('components.settings.checkpoint.sections.cleanup.noMatch') }}</span>
          <span v-else>{{ t('components.settings.checkpoint.sections.cleanup.noCheckpoints') }}</span>
        </div>

        <template v-else>
          <div class="cleanup-toolbar">
            <CustomCheckbox
              :modelValue="isAllFilteredSelected"
              :label="t('components.settings.checkpoint.sections.cleanup.selectAll')"
              :disabled="isDeletingAny"
              @update:modelValue="emit('toggleSelectAllFiltered', $event)"
            />

            <div class="cleanup-toolbar-actions">
              <span class="selection-info">
                {{ t('components.settings.checkpoint.sections.cleanup.selectedCount', { count: selectedCount }) }}
              </span>

              <button
                class="btn-batch-delete"
                :disabled="selectedCount === 0 || isDeletingAny"
                @click="emit('requestDeleteSelected')"
              >
                <i v-if="isDeletingAny" class="codicon codicon-loading codicon-modifier-spin"></i>
                <i v-else class="codicon codicon-trash"></i>
                {{ t('components.settings.checkpoint.sections.cleanup.deleteSelected') }}
              </button>

              <button
                class="btn-clear-selection"
                :disabled="selectedCount === 0 || isDeletingAny"
                @click="emit('clearSelection')"
              >
                {{ t('components.settings.checkpoint.sections.cleanup.clearSelection') }}
              </button>
            </div>
          </div>

          <div
            v-for="conversation in filteredConversations"
            :key="conversation.conversationId"
            class="conversation-item"
          >
            <div class="conversation-select">
              <CustomCheckbox
                :modelValue="isConversationSelected(conversation.conversationId)"
                :disabled="isDeletingAny"
                @update:modelValue="emit('toggleConversationSelected', { conversationId: conversation.conversationId, selected: $event })"
              />
            </div>

            <div class="conversation-info">
              <div class="conversation-title">{{ conversation.title }}</div>
              <div class="conversation-meta">
                <span class="checkpoint-count">
                  <i class="codicon codicon-archive"></i>
                  {{ formatCheckpointCount(conversation.checkpointCount) }}
                </span>
                <span class="size-info">
                  <i class="codicon codicon-database"></i>
                  {{ formatSize(conversation.totalSize) }}
                </span>
                <span class="update-time">
                  {{ formatRelativeTime(conversation.updatedAt) }}
                </span>
              </div>
            </div>

            <button
              class="delete-btn"
              :disabled="deletingConversationIds.has(conversation.conversationId) || isDeletingAny"
              @click="emit('requestDeleteConversation', conversation)"
            >
              <i v-if="deletingConversationIds.has(conversation.conversationId)" class="codicon codicon-loading codicon-modifier-spin"></i>
              <i v-else class="codicon codicon-trash"></i>
            </button>
          </div>
        </template>
      </div>
    </CustomScrollbar>
  </div>

  <button
    class="refresh-btn"
    :disabled="isCleanupLoading || isDeletingAny"
    @click="emit('refresh')"
  >
    <i class="codicon codicon-refresh" :class="{ 'codicon-modifier-spin': isCleanupLoading }"></i>
    {{ t('components.settings.checkpoint.sections.cleanup.refresh') }}
  </button>
</template>

<style scoped>
.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--vscode-input-background);
  border: 1px solid var(--vscode-input-border);
  border-radius: 6px;
  margin-top: 8px;
}

.search-box .codicon-search {
  color: var(--vscode-descriptionForeground);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--vscode-input-foreground);
  font-size: 13px;
  outline: none;
}

.search-input::placeholder {
  color: var(--vscode-input-placeholderForeground);
}

.clear-search {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--vscode-descriptionForeground);
  cursor: pointer;
  border-radius: 4px;
}

.clear-search:hover:not(:disabled) {
  background: var(--vscode-list-hoverBackground);
  color: var(--vscode-foreground);
}

.conversations-list-wrapper {
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
  background: var(--vscode-editor-background);
  min-height: 240px;
  max-height: 360px;
}

.conversations-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
}

.list-loading,
.list-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 200px;
  color: var(--vscode-descriptionForeground);
  text-align: center;
}

.cleanup-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 4px 10px;
  border-bottom: 1px solid var(--vscode-panel-border);
}

.cleanup-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.selection-info {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.conversation-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
  background: var(--vscode-sideBar-background);
}

.conversation-select {
  flex-shrink: 0;
}

.conversation-info {
  flex: 1;
  min-width: 0;
}

.conversation-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--vscode-foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conversation-meta {
  display: flex;
  gap: 12px;
  margin-top: 4px;
  flex-wrap: wrap;
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}

.checkpoint-count,
.size-info,
.update-time {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.btn-batch-delete,
.btn-clear-selection,
.refresh-btn,
.delete-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 4px;
  cursor: pointer;
}

.btn-batch-delete,
.btn-clear-selection,
.refresh-btn {
  padding: 6px 10px;
  border: 1px solid var(--vscode-panel-border);
  background: transparent;
  color: var(--vscode-foreground);
  font-size: 12px;
}

.btn-batch-delete:hover:not(:disabled),
.btn-clear-selection:hover:not(:disabled),
.refresh-btn:hover:not(:disabled),
.delete-btn:hover:not(:disabled) {
  background: var(--vscode-list-hoverBackground);
}

.delete-btn {
  width: 30px;
  height: 30px;
  border: 1px solid var(--vscode-panel-border);
  background: transparent;
  color: var(--vscode-errorForeground, #f14c4c);
}

.refresh-btn {
  align-self: flex-start;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.codicon-modifier-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
