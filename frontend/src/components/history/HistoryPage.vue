<script setup lang="ts">
/**
 * HistoryPage - 对话历史页面
 * 作为独立页面展示
 */

import { ref, computed } from 'vue'
import { ConfirmDialog, CustomScrollbar, CustomSelect, type SelectOption } from '../common'
import ConversationList from './ConversationList.vue'
import { useChatStore, useSettingsStore } from '@/stores'
import type { WorkspaceFilter } from '@/stores/chatStore'
import { t } from '../../i18n'
import {
  groupConversations,
  matchesConversationSearch,
  sortConversations,
  type HistoryGroup,
  type HistoryGroupBy,
  type HistorySortBy
} from './historyUtils'

const chatStore = useChatStore()
const settingsStore = useSettingsStore()

// 搜索关键词
const searchKeyword = ref('')
const sortBy = ref<HistorySortBy>('updated')
const groupBy = ref<HistoryGroupBy>('date')
const selectionMode = ref(false)
const selectedIds = ref<Set<string>>(new Set())
const pendingDeleteIds = ref<string[]>([])
const pendingDeleteTitle = ref('')
const pendingDeleteMessage = ref('')
const showDeleteConfirm = ref(false)

// 工作区筛选选项（响应式）
const workspaceFilterOptions = computed<SelectOption[]>(() => [
  { value: 'current', label: t('components.history.currentWorkspace') },
  { value: 'all', label: t('components.history.allWorkspaces') }
])

const sortOptions = computed<SelectOption[]>(() => [
  { value: 'updated', label: t('components.history.sortUpdated') },
  { value: 'created', label: t('components.history.sortCreated') },
  { value: 'title', label: t('components.history.sortTitle') },
  { value: 'messages', label: t('components.history.sortMessages') }
])

const groupOptions = computed<SelectOption[]>(() => [
  { value: 'none', label: t('components.history.groupNone') },
  { value: 'date', label: t('components.history.groupDate') },
  { value: 'workspace', label: t('components.history.groupWorkspace') }
])

const filteredConversations = computed(() => {
  let conversations = chatStore.filteredConversations
  if (searchKeyword.value.trim()) {
    conversations = conversations.filter(conversation => matchesConversationSearch(conversation, searchKeyword.value))
  }
  return sortConversations(conversations, sortBy.value)
})

const groupedConversations = computed<HistoryGroup[]>(() => groupConversations(filteredConversations.value, groupBy.value, {
  all: t('components.history.allConversations'),
  today: t('components.history.today'),
  yesterday: t('components.history.yesterday'),
  thisWeek: t('components.history.thisWeek'),
  earlier: t('components.history.earlier')
}))

const selectedCount = computed(() => selectedIds.value.size)
const hasVisibleConversations = computed(() => filteredConversations.value.length > 0)
const visibleIds = computed(() => filteredConversations.value.map(conversation => conversation.id))
const selectedIdsList = computed(() => Array.from(selectedIds.value))

function replaceSelectedIds(ids: Iterable<string>) {
  selectedIds.value = new Set(ids)
}

// 处理筛选变更
function handleFilterChange(value: string) {
  chatStore.setWorkspaceFilter(value as WorkspaceFilter)
  replaceSelectedIds([])
}

// 处理选择对话
async function handleSelect(id: string) {
  if (selectionMode.value) {
    toggleSelect(id)
    return
  }
  await chatStore.switchConversation(id)
  settingsStore.showChat()
}

function toggleSelect(id: string) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  selectedIds.value = next
}

function toggleSelectionMode() {
  selectionMode.value = !selectionMode.value
  if (!selectionMode.value) {
    replaceSelectedIds([])
  }
}

function selectVisible() {
  replaceSelectedIds(visibleIds.value)
  selectionMode.value = true
}

function clearSelection() {
  replaceSelectedIds([])
}

function getDeleteMessage(ids: string[]) {
  if (ids.length === 1) {
    const conversation = chatStore.conversations.find(item => item.id === ids[0])
    const title = conversation?.title || t('components.history.noTitle')
    return t('components.history.deleteConversationConfirmMessage', { title })
  }
  return t('components.history.deleteMultipleConfirmMessage', { count: ids.length })
}

function requestDelete(ids: string[], title = t('components.history.deleteConversation')) {
  const uniqueIds = Array.from(new Set(ids)).filter(id => !chatStore.isDeletingConversation(id))
  if (uniqueIds.length === 0) return

  pendingDeleteIds.value = uniqueIds
  pendingDeleteTitle.value = title
  pendingDeleteMessage.value = getDeleteMessage(uniqueIds)
  showDeleteConfirm.value = true
}

function handleDelete(id: string) {
  requestDelete([id])
}

function requestDeleteSelected() {
  requestDelete(selectedIdsList.value, t('components.history.deleteSelected'))
}

function requestDeleteVisible() {
  requestDelete(visibleIds.value, t('components.history.deleteVisible'))
}

function requestDeleteGroup(group: HistoryGroup) {
  requestDelete(
    group.conversations.map(conversation => conversation.id),
    t('components.history.deleteGroup', { group: group.label })
  )
}

async function confirmDelete() {
  const ids = pendingDeleteIds.value
  pendingDeleteIds.value = []

  for (const id of ids) {
    await chatStore.deleteConversation(id)
  }

  const remainingSelected = new Set(selectedIds.value)
  for (const id of ids) {
    remainingSelected.delete(id)
  }
  selectedIds.value = remainingSelected
}

function handleSortChange(value: string) {
  sortBy.value = value as HistorySortBy
}

function handleGroupChange(value: string) {
  groupBy.value = value as HistoryGroupBy
}
</script>

<template>
  <div class="history-page">
    <!-- 页面标题栏 -->
    <div class="page-header">
      <div class="page-header-left">
        <h3>{{ t('components.history.title') }}</h3>
      </div>

      <div class="page-header-right">
        <!-- 工作区筛选 -->
        <div class="filter-group header-filter">
          <CustomSelect
            :model-value="chatStore.workspaceFilter"
            :options="workspaceFilterOptions"
            compact
            class="filter-select"
            @update:model-value="handleFilterChange"
          />
        </div>

        <button
          class="manage-btn"
          :class="{ active: selectionMode }"
          :title="t('components.history.manageConversations')"
          @click="toggleSelectionMode"
        >
          <i class="codicon codicon-checklist"></i>
          <span>{{ t('components.history.manage') }}</span>
        </button>

        <button class="close-btn" :title="t('components.history.backToChat')" @click="settingsStore.showChat">
          <i class="codicon codicon-close"></i>
        </button>
      </div>
    </div>

    <!-- 搜索 -->
    <div class="controls-bar">
      <div class="search-input-container">
        <i class="codicon codicon-search"></i>
        <input
          v-model="searchKeyword"
          type="text"
          :placeholder="t('components.history.searchPlaceholder')"
          class="search-input"
        />
        <button
          v-if="searchKeyword"
          class="search-clear-btn"
          :title="t('components.history.clearSearch')"
          @click="searchKeyword = ''"
        >
          <i class="codicon codicon-close"></i>
        </button>
      </div>

      <CustomSelect
        :model-value="sortBy"
        :options="sortOptions"
        compact
        class="sort-select"
        @update:model-value="handleSortChange"
      />

      <CustomSelect
        :model-value="groupBy"
        :options="groupOptions"
        compact
        class="group-select"
        @update:model-value="handleGroupChange"
      />
    </div>

    <div v-if="selectionMode" class="bulk-bar">
      <span class="bulk-summary">
        {{ t('components.history.selectedCount', { count: selectedCount }) }}
      </span>
      <div class="bulk-actions">
        <button class="bulk-btn" :disabled="!hasVisibleConversations" @click="selectVisible">
          {{ t('components.history.selectVisible') }}
        </button>
        <button class="bulk-btn" :disabled="selectedCount === 0" @click="clearSelection">
          {{ t('components.history.clearSelection') }}
        </button>
        <button class="bulk-btn danger" :disabled="selectedCount === 0" @click="requestDeleteSelected">
          {{ t('components.history.deleteSelected') }}
        </button>
        <button class="bulk-btn danger" :disabled="!hasVisibleConversations" @click="requestDeleteVisible">
          {{ t('components.history.deleteVisible') }}
        </button>
      </div>
    </div>

    <!-- 对话列表 -->
    <CustomScrollbar class="page-content">
      <ConversationList
        v-if="chatStore.isLoadingConversations"
        :conversations="[]"
        :current-id="chatStore.currentConversationId"
        loading
        :format-time="chatStore.formatTime"
      />

      <!-- 搜索无结果提示 -->
      <div v-else-if="filteredConversations.length === 0" class="no-results">
        <i class="codicon codicon-search"></i>
        <span>{{ searchKeyword ? t('components.history.noSearchResults') : t('components.history.empty') }}</span>
      </div>
      
      <div v-else class="grouped-list">
        <section
          v-for="group in groupedConversations"
          :key="group.key"
          class="history-group"
        >
          <div v-if="groupBy !== 'none'" class="group-header">
            <div class="group-title">
              <span>{{ group.label }}</span>
              <span class="group-count">{{ group.conversations.length }}</span>
            </div>
            <button
              v-if="selectionMode"
              class="group-delete-btn"
              :title="t('components.history.deleteGroup', { group: group.label })"
              @click="requestDeleteGroup(group)"
            >
              <i class="codicon codicon-trash"></i>
            </button>
          </div>
          <ConversationList
            :conversations="group.conversations"
            :current-id="chatStore.currentConversationId"
            :loading="chatStore.isLoadingConversations"
            :format-time="chatStore.formatTime"
            :show-workspace="chatStore.workspaceFilter === 'all' || groupBy !== 'workspace'"
            :selectable="selectionMode"
            :selected-ids="selectedIdsList"
            @select="handleSelect"
            @delete="handleDelete"
            @toggle-select="toggleSelect"
          />
        </section>
      </div>
    </CustomScrollbar>

    <ConfirmDialog
      v-model="showDeleteConfirm"
      :title="pendingDeleteTitle"
      :message="pendingDeleteMessage"
      :confirm-text="t('components.history.confirmDelete')"
      :cancel-text="t('components.history.cancel')"
      is-danger
      @confirm="confirmDelete"
    />
  </div>
</template>

<style scoped>
.history-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--vscode-sideBar-background);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--vscode-panel-border);
}

.page-header-left {
  display: flex;
  align-items: center;
  min-width: 0;
  flex: 0 1 auto;
}

.page-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
}

.page-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.filter-select {
  width: 120px;
}

.header-filter {
  flex-shrink: 0;
}

.controls-bar {
  display: flex;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--vscode-panel-border);
}

.search-input-container {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  padding: 6px 10px;
  border: 1px solid var(--vscode-input-border);
  border-radius: 2px;
  background: var(--vscode-input-background);
}

.search-input-container .codicon-search {
  font-size: 14px;
  color: var(--vscode-descriptionForeground);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  min-width: 0;
  padding: 0;
  background: transparent;
  color: var(--vscode-input-foreground);
  border: none;
  font-size: 12px;
  outline: none;
}

.search-input::placeholder {
  color: var(--vscode-input-placeholderForeground);
}

.search-clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 2px;
  color: var(--vscode-descriptionForeground);
  cursor: pointer;
  flex-shrink: 0;
}

.search-clear-btn:hover {
  color: var(--vscode-foreground);
}

.search-clear-btn .codicon {
  font-size: 12px;
}

.sort-select,
.group-select {
  width: 118px;
  flex-shrink: 0;
}

.manage-btn,
.bulk-btn,
.group-delete-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border-radius: 4px;
  border: 1px solid var(--vscode-panel-border);
  background: transparent;
  color: var(--vscode-foreground);
  cursor: pointer;
}

.manage-btn {
  padding: 4px 8px;
  font-size: 11px;
}

.manage-btn:hover,
.manage-btn.active,
.bulk-btn:hover:not(:disabled),
.group-delete-btn:hover {
  background: var(--vscode-toolbar-hoverBackground);
}

.bulk-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--vscode-panel-border);
  background: var(--vscode-editorWidget-background);
}

.bulk-summary {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
  white-space: nowrap;
}

.bulk-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.bulk-btn {
  padding: 4px 8px;
  font-size: 11px;
}

.bulk-btn:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.bulk-btn.danger:not(:disabled),
.group-delete-btn {
  color: var(--vscode-errorForeground);
}

.grouped-list {
  display: flex;
  flex-direction: column;
}

.history-group {
  display: flex;
  flex-direction: column;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: var(--vscode-sideBarSectionHeader-background);
  border-bottom: 1px solid var(--vscode-panel-border);
  color: var(--vscode-descriptionForeground);
}

.group-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.group-count {
  padding: 1px 5px;
  border-radius: 999px;
  background: var(--vscode-badge-background);
  color: var(--vscode-badge-foreground);
  font-size: 10px;
}

.group-delete-btn {
  width: 24px;
  height: 22px;
}

@media (max-width: 340px) {
  .filter-select {
    width: 110px;
  }

  .controls-bar,
  .bulk-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .sort-select,
  .group-select {
    width: 100%;
  }
}

/* 无结果提示 */
.no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 16px;
  text-align: center;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.no-results .codicon {
  font-size: 24px;
  opacity: 0.5;
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--vscode-foreground);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-btn:hover {
  background: var(--vscode-toolbar-hoverBackground);
}

.page-content {
  flex: 1;
  min-height: 0;
}
</style>
