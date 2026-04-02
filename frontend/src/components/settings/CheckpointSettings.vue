<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { CustomCheckbox } from '../common'
import { useChatStore } from '@/stores'
import { t } from '@/i18n'
import { sendToExtension } from '@/utils/vscode'
import CheckpointCleanupSection from './checkpoint/CheckpointCleanupSection.vue'
import CheckpointMessageSettingsSection from './checkpoint/CheckpointMessageSettingsSection.vue'
import CheckpointToolSettingsSection from './checkpoint/CheckpointToolSettingsSection.vue'
import { useCheckpointSettingsConfig } from './checkpoint/useCheckpointSettingsConfig'
import type {
  ConversationWithCheckpoints,
} from './checkpoint/types'

const chatStore = useChatStore()

const {
  messageTypes,
  config,
  allTools,
  isLoading,
  loadConfig,
  updateConfigField,
  toggleMessageBefore,
  toggleMessageAfter,
  toggleModelOuterLayerOnly,
  toggleMergeUnchangedCheckpoints,
  toggleAllMessageBefore,
  toggleAllMessageAfter,
  toggleToolBefore,
  toggleToolAfter,
  toggleAllBefore,
  toggleAllAfter
} = useCheckpointSettingsConfig()

const conversationsWithCheckpoints = ref<ConversationWithCheckpoints[]>([])
const searchQuery = ref('')
const isCleanupLoading = ref(false)
const deletingConversationIds = ref<Set<string>>(new Set())
const selectedConversationIds = ref<Set<string>>(new Set())
const deleteConfirmTargets = ref<ConversationWithCheckpoints[]>([])
const showDeleteConfirm = ref(false)
const isBatchDeleting = ref(false)

const isDeletingAny = computed(() => deletingConversationIds.value.size > 0 || isBatchDeleting.value)

async function loadConversationsWithCheckpoints() {
  isCleanupLoading.value = true
  try {
    const response = await sendToExtension<{ conversations: ConversationWithCheckpoints[] }>(
      'checkpoint.getAllConversationsWithCheckpoints',
      {}
    )

    if (response?.conversations) {
      conversationsWithCheckpoints.value = response.conversations

      const existingIds = new Set(conversationsWithCheckpoints.value.map(conversation => conversation.conversationId))
      selectedConversationIds.value = new Set(
        [...selectedConversationIds.value].filter(id => existingIds.has(id))
      )
      deletingConversationIds.value = new Set(
        [...deletingConversationIds.value].filter(id => existingIds.has(id))
      )
    }
  } catch (error) {
    console.error('Failed to load conversations with checkpoints:', error)
  } finally {
    isCleanupLoading.value = false
  }
}

function setConversationSelected(conversationId: string, selected: boolean) {
  const next = new Set(selectedConversationIds.value)
  if (selected) next.add(conversationId)
  else next.delete(conversationId)
  selectedConversationIds.value = next
}

function toggleSelectAllFiltered(selected: boolean) {
  const next = new Set(selectedConversationIds.value)
  const filteredConversations = !searchQuery.value.trim()
    ? conversationsWithCheckpoints.value
    : conversationsWithCheckpoints.value.filter(conversation =>
      conversation.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      conversation.conversationId.toLowerCase().includes(searchQuery.value.toLowerCase())
    )

  for (const conversation of filteredConversations) {
    if (selected) next.add(conversation.conversationId)
    else next.delete(conversation.conversationId)
  }

  selectedConversationIds.value = next
}

function clearSelection() {
  selectedConversationIds.value = new Set()
}

function showDeleteConfirmDialog(conversation: ConversationWithCheckpoints) {
  deleteConfirmTargets.value = [conversation]
  showDeleteConfirm.value = true
}

function showDeleteSelectedConfirmDialog() {
  const targets = conversationsWithCheckpoints.value.filter(conversation =>
    selectedConversationIds.value.has(conversation.conversationId)
  )
  if (targets.length === 0) return
  deleteConfirmTargets.value = targets
  showDeleteConfirm.value = true
}

function cancelDelete() {
  showDeleteConfirm.value = false
  deleteConfirmTargets.value = []
}

async function confirmDeleteCheckpoints() {
  if (deleteConfirmTargets.value.length === 0) return

  const idsToDelete = deleteConfirmTargets.value.map(conversation => conversation.conversationId)
  showDeleteConfirm.value = false
  isBatchDeleting.value = idsToDelete.length > 1

  try {
    for (const conversationId of idsToDelete) {
      deletingConversationIds.value = new Set([...deletingConversationIds.value, conversationId])

      try {
        const response = await sendToExtension<{ success: boolean; deletedCount: number }>(
          'checkpoint.deleteAll',
          { conversationId }
        )

        if (response?.success) {
          conversationsWithCheckpoints.value = conversationsWithCheckpoints.value.filter(
            conversation => conversation.conversationId !== conversationId
          )
          setConversationSelected(conversationId, false)
        }
      } catch (error) {
        console.error('Failed to delete checkpoints:', error)
      } finally {
        const nextDeleting = new Set(deletingConversationIds.value)
        nextDeleting.delete(conversationId)
        deletingConversationIds.value = nextDeleting
      }
    }

    const currentId = chatStore.currentConversationId
    if (currentId && idsToDelete.includes(currentId)) {
      await chatStore.loadCheckpoints()
    }
  } finally {
    isBatchDeleting.value = false
    deleteConfirmTargets.value = []
  }
}

onMounted(() => {
  void loadConfig()
  void loadConversationsWithCheckpoints()
})
</script>

<template>
  <div class="checkpoint-settings">
    <div v-if="isLoading" class="loading-state">
      <i class="codicon codicon-loading codicon-modifier-spin"></i>
      <span>{{ t('components.settings.checkpoint.loading') }}</span>
    </div>

    <template v-else>
      <div class="setting-group">
        <div class="setting-header">
          <CustomCheckbox
            :modelValue="config.enabled"
            :label="t('components.settings.checkpoint.sections.enable.label')"
            @update:modelValue="(value: boolean) => updateConfigField('enabled', value)"
          />
        </div>
        <p class="setting-description">
          {{ t('components.settings.checkpoint.sections.enable.description') }}
        </p>
      </div>

      <div class="divider"></div>

      <CheckpointMessageSettingsSection
        :enabled="config.enabled"
        :message-types="messageTypes"
        :message-checkpoint="config.messageCheckpoint"
        @toggle-all-before="toggleAllMessageBefore"
        @toggle-all-after="toggleAllMessageAfter"
        @toggle-before="toggleMessageBefore($event.messageType, $event.enabled)"
        @toggle-after="toggleMessageAfter($event.messageType, $event.enabled)"
        @toggle-model-outer-layer-only="toggleModelOuterLayerOnly"
        @toggle-merge-unchanged-checkpoints="toggleMergeUnchangedCheckpoints"
      />

      <div class="divider"></div>

      <CheckpointToolSettingsSection
        :enabled="config.enabled"
        :tools="allTools"
        :before-tools="config.beforeTools"
        :after-tools="config.afterTools"
        @toggle-all-before="toggleAllBefore"
        @toggle-all-after="toggleAllAfter"
        @toggle-before="toggleToolBefore($event.toolName, $event.enabled)"
        @toggle-after="toggleToolAfter($event.toolName, $event.enabled)"
      />

      <div class="divider"></div>

      <div class="setting-group" :class="{ disabled: !config.enabled }">
        <h4 class="group-title">
          <i class="codicon codicon-settings-gear"></i>
          {{ t('components.settings.checkpoint.sections.other.title') }}
        </h4>

        <div class="form-row">
          <label>{{ t('components.settings.checkpoint.sections.other.maxCheckpoints.label') }}</label>
          <input
            type="text"
            :value="config.maxCheckpoints"
            :disabled="!config.enabled"
            class="number-input"
            placeholder="-1"
            @input="(event: Event) => { const value = parseInt((event.target as HTMLInputElement).value); updateConfigField('maxCheckpoints', isNaN(value) ? -1 : value) }"
          />
          <span class="hint">{{ t('components.settings.checkpoint.sections.other.maxCheckpoints.hint') }}</span>
        </div>
      </div>

      <div class="divider"></div>

      <CheckpointCleanupSection
        :auto-cleanup="config.cleanupExpiredConversationsOnStartup ?? false"
        :search-query="searchQuery"
        :conversations="conversationsWithCheckpoints"
        :is-cleanup-loading="isCleanupLoading"
        :is-deleting-any="isDeletingAny"
        :selected-conversation-ids="selectedConversationIds"
        :deleting-conversation-ids="deletingConversationIds"
        :show-delete-confirm="showDeleteConfirm"
        :delete-confirm-targets="deleteConfirmTargets"
        @update:auto-cleanup="updateConfigField('cleanupExpiredConversationsOnStartup', $event)"
        @update:search-query="searchQuery = $event"
        @toggle-select-all-filtered="toggleSelectAllFiltered"
        @clear-selection="clearSelection"
        @toggle-conversation-selected="setConversationSelected($event.conversationId, $event.selected)"
        @request-delete-conversation="showDeleteConfirmDialog"
        @request-delete-selected="showDeleteSelectedConfirmDialog"
        @refresh="loadConversationsWithCheckpoints"
        @cancel-delete="cancelDelete"
        @confirm-delete="confirmDeleteCheckpoints"
      />
    </template>
  </div>
</template>

<style scoped>
.checkpoint-settings {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px;
  color: var(--vscode-descriptionForeground);
}

.loading-state .codicon {
  font-size: 24px;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: opacity 0.2s;
}

.setting-group.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.setting-header {
  display: flex;
  align-items: center;
}

.setting-description {
  margin: 0;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
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

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-row label {
  font-size: 12px;
  font-weight: 500;
}

.number-input {
  width: 100px;
  padding: 6px 10px;
  font-size: 13px;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border);
  border-radius: 4px;
  outline: none;
}

.number-input:focus {
  border-color: var(--vscode-focusBorder);
}

.number-input:disabled {
  opacity: 0.6;
}

.hint {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}

.divider {
  height: 1px;
  background: var(--vscode-panel-border);
}

.codicon-modifier-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
