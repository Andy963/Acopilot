<script setup lang="ts">
/**
 * ConversationList - 对话历史列表组件
 * 扁平化设计，显示所有对话记录
 */

import { computed, nextTick, ref } from 'vue'
import { IconButton } from '../common'
import { useChatStore } from '../../stores'
import { sendToExtension } from '../../utils/vscode'
import type { Conversation } from '../../stores'
import { t } from '../../i18n'
import { getWorkspaceLabel } from './historyUtils'

const props = withDefaults(defineProps<{
  conversations: Conversation[]
  currentId: string | null
  loading?: boolean
  formatTime: (timestamp: number) => string
  showWorkspace?: boolean
  selectable?: boolean
  selectedIds?: string[]
}>(), {
  loading: false,
  showWorkspace: false,
  selectable: false,
  selectedIds: () => []
})

const emit = defineEmits<{
  select: [id: string]
  delete: [id: string]
  toggleSelect: [id: string]
}>()

// 使用 chatStore 检查删除状态
const chatStore = useChatStore()

// 悬停状态
const hoverItemId = ref<string | null>(null)
const editingId = ref<string | null>(null)
const editingTitle = ref('')
const savingId = ref<string | null>(null)
const titleInput = ref<HTMLInputElement | null>(null)
const selectedIdSet = computed(() => new Set(props.selectedIds))

// 处理删除
function handleDelete(id: string) {
  // 如果正在删除，不重复触发
  if (chatStore.isDeletingConversation(id)) {
    return
  }
  emit('delete', id)
}

function handleToggleSelect(id: string) {
  emit('toggleSelect', id)
}

// 处理在文件管理器中显示
async function handleRevealInExplorer(id: string) {
  try {
    await sendToExtension('conversation.revealInExplorer', { conversationId: id })
  } catch (error) {
    console.error('Failed to reveal in explorer:', error)
  }
}

async function handleStartEdit(conversation: Conversation) {
  if (!conversation.isPersisted || chatStore.isDeletingConversation(conversation.id)) return
  editingId.value = conversation.id
  editingTitle.value = conversation.title
  await nextTick()
  titleInput.value?.focus()
  titleInput.value?.select()
}

function handleCancelEdit() {
  editingId.value = null
  editingTitle.value = ''
}

async function handleSaveTitle(conversation: Conversation) {
  if (editingId.value !== conversation.id || savingId.value) return
  savingId.value = conversation.id
  try {
    const saved = await chatStore.renameConversation(conversation.id, editingTitle.value)
    if (saved) handleCancelEdit()
  } finally {
    savingId.value = null
  }
}
</script>

<template>
  <div class="conversation-list">
    <!-- 加载状态 -->
    <div v-if="loading" class="list-loading">
      <i class="codicon codicon-loading codicon-modifier-spin"></i>
    </div>

    <!-- 空状态 -->
    <div v-else-if="conversations.length === 0" class="list-empty">
      <span class="empty-text">{{ t('components.history.empty') }}</span>
    </div>

    <!-- 对话列表 -->
    <div v-else class="list-items">
      <div
        v-for="conversation in conversations"
        :key="conversation.id"
        :class="['conversation-item', { active: conversation.id === currentId, selected: selectedIdSet.has(conversation.id) }]"
        @click="emit('select', conversation.id)"
        @mouseenter="hoverItemId = conversation.id"
        @mouseleave="hoverItemId = null"
      >
        <label v-if="selectable" class="item-checkbox" @click.stop>
          <input
            type="checkbox"
            :checked="selectedIdSet.has(conversation.id)"
            @change="handleToggleSelect(conversation.id)"
          />
        </label>

        <div class="item-content">
          <input
            v-if="editingId === conversation.id"
            ref="titleInput"
            v-model="editingTitle"
            class="item-title-input"
            type="text"
            maxlength="100"
            :aria-label="t('components.history.editTitle')"
            @click.stop
            @keydown.enter.prevent="handleSaveTitle(conversation)"
            @keydown.esc.prevent="handleCancelEdit"
          />
          <div v-else class="item-title">{{ conversation.title }}</div>
          <div v-if="conversation.preview" class="item-preview">{{ conversation.preview }}</div>
          <div class="item-meta">
            <span class="item-time">{{ formatTime(conversation.updatedAt) }}</span>
            <span v-if="showWorkspace" class="item-workspace" :title="conversation.workspaceUri || ''">
              <i class="codicon codicon-root-folder"></i>
              {{ getWorkspaceLabel(conversation.workspaceUri) }}
            </span>
            <span v-if="conversation.messageCount > 0" class="item-count">
              {{ conversation.messageCount }} {{ t('components.history.messages') }}
            </span>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div
          v-show="editingId === conversation.id || hoverItemId === conversation.id || chatStore.isDeletingConversation(conversation.id)"
          class="item-actions"
          @click.stop
        >
          <i
            v-if="chatStore.isDeletingConversation(conversation.id)"
            class="codicon codicon-loading codicon-modifier-spin deleting-indicator"
          ></i>
          <template v-else-if="editingId === conversation.id">
            <IconButton
              icon="codicon-check"
              size="small"
              :loading="savingId === conversation.id"
              :tooltip="t('components.history.saveTitle')"
              :aria-label="t('components.history.saveTitle')"
              @click="handleSaveTitle(conversation)"
            />
            <IconButton
              icon="codicon-close"
              size="small"
              :disabled="savingId === conversation.id"
              :tooltip="t('components.history.cancelEditTitle')"
              :aria-label="t('components.history.cancelEditTitle')"
              @click="handleCancelEdit"
            />
          </template>
          <template v-else>
            <IconButton
              icon="codicon-edit"
              size="small"
              :tooltip="t('components.history.editTitle')"
              :aria-label="t('components.history.editTitle')"
              @click="handleStartEdit(conversation)"
            />
            <IconButton
              icon="codicon-folder-opened"
              size="small"
              :title="t('components.history.revealInExplorer')"
              @click="handleRevealInExplorer(conversation.id)"
            />
            <IconButton
              icon="codicon-trash"
              size="small"
              :title="t('components.history.deleteConversation')"
              @click="handleDelete(conversation.id)"
            />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.conversation-list {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.list-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl, 32px) var(--spacing-md, 16px);
  color: var(--vscode-descriptionForeground);
}

.list-loading .codicon {
  font-size: 18px;
}

.codicon-modifier-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.list-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl, 32px) var(--spacing-md, 16px);
}

.empty-text {
  font-size: 13px;
  color: var(--vscode-descriptionForeground);
}

.list-items {
  display: flex;
  flex-direction: column;
}

.conversation-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
  cursor: pointer;
  transition: background-color var(--transition-fast, 0.1s);
  border-bottom: 1px solid var(--vscode-panel-border);
}

.conversation-item:last-child {
  border-bottom: none;
}

.conversation-item:hover {
  background: var(--vscode-list-hoverBackground);
}

.conversation-item.active {
  background: var(--vscode-list-activeSelectionBackground);
}

.conversation-item.selected:not(.active) {
  background: var(--vscode-list-inactiveSelectionBackground);
}

.item-checkbox {
  display: flex;
  align-items: flex-start;
  padding-top: 1px;
  margin-right: var(--spacing-sm, 8px);
  cursor: pointer;
}

.item-checkbox input {
  margin: 0;
  accent-color: var(--vscode-button-background);
}

.item-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs, 4px);
}

.item-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--vscode-foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-title-input {
  width: 100%;
  min-width: 0;
  padding: 2px 4px;
  border: 1px solid var(--vscode-focusBorder);
  border-radius: var(--radius-sm, 2px);
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  font: inherit;
  line-height: 1.3;
  outline: none;
}

.item-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-sm, 8px);
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}

.item-time {
  opacity: 0.8;
}

.item-count {
  opacity: 0.6;
}

.item-workspace {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  max-width: 180px;
  min-width: 0;
  opacity: 0.75;
}

.item-workspace .codicon {
  font-size: 11px;
  flex-shrink: 0;
}

.item-preview {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  opacity: 0.82;
}

.item-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs, 4px);
  flex-shrink: 0;
  margin-left: var(--spacing-sm, 8px);
}

.deleting-indicator {
  font-size: 14px;
  color: var(--vscode-descriptionForeground);
}

.codicon-modifier-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
