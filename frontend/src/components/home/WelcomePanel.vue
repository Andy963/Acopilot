<script setup lang="ts">
/**
 * WelcomePanel - 欢迎面板组件
 *
 * 在聊天视图的初始状态显示，包含：
 * - 欢迎语
 * - 历史对话列表
 *
 * 用户可以在下方输入框输入消息开始新对话
 */

import { computed, ref } from 'vue'
import { ConfirmDialog, CustomScrollbar } from '../common'
import ConversationList from '../history/ConversationList.vue'
import { useChatStore, useSettingsStore } from '@/stores'
import { useI18n } from '@/i18n'

const { t } = useI18n()
const chatStore = useChatStore()
const settingsStore = useSettingsStore()

const needsModelConfig = computed(() => !chatStore.configId || !chatStore.currentConfig)
const pendingDeleteId = ref<string | null>(null)
const showDeleteConfirm = ref(false)
const pendingDeleteMessage = computed(() => {
  const id = pendingDeleteId.value
  const conversation = id ? chatStore.conversations.find(item => item.id === id) : null
  return t('components.history.deleteConversationConfirmMessage', {
    title: conversation?.title || t('components.history.noTitle')
  })
})

function handleConfigureModel() {
  settingsStore.showSettings('channel')
}

function handleOpenHistorySearch() {
  settingsStore.showHistory()
}

// 处理选择对话
async function handleSelect(id: string) {
  await chatStore.switchConversation(id)
}

// 处理删除对话
async function handleDelete(id: string) {
  if (chatStore.isDeletingConversation(id)) return
  pendingDeleteId.value = id
  showDeleteConfirm.value = true
}

async function confirmDelete() {
  const id = pendingDeleteId.value
  pendingDeleteId.value = null
  if (!id) return
  await chatStore.deleteConversation(id)
}
</script>

<template>
  <div class="welcome-panel">
    <!-- 欢迎区域 -->
    <div class="welcome-section">
      <div class="welcome-content">
        <div class="logo">
          <i class="codicon codicon-comment-discussion"></i>
        </div>
        <h1 class="welcome-title">{{ t('components.home.welcome') }}</h1>
        <p class="welcome-subtitle">
          {{ t('components.home.welcomeMessage') }}
        </p>
        <p class="welcome-hint">
          {{ t('components.home.welcomeHint') }}
        </p>
        <div class="welcome-actions">
          <button
            v-if="needsModelConfig"
            class="primary-action-btn"
            @click="handleConfigureModel"
          >
            <i class="codicon codicon-settings-gear"></i>
            {{ t('components.home.configureModel') }}
          </button>
          <button class="secondary-action-btn" @click="handleOpenHistorySearch">
            <i class="codicon codicon-search"></i>
            {{ t('components.home.searchHistory') }}
          </button>
        </div>
      </div>
    </div>
    
    <!-- 历史对话区域 -->
    <div class="history-section" v-if="chatStore.filteredConversations.length > 0 || chatStore.isLoadingConversations">
      <div class="section-header">
        <h2 class="section-title">{{ t('components.home.recentChats') }}</h2>
        <button class="view-all-btn prominent" @click="settingsStore.showHistory" v-if="!chatStore.isLoadingConversations">
          <i class="codicon codicon-history"></i>
          {{ t('components.home.viewAll') }}
          <i class="codicon codicon-chevron-right"></i>
        </button>
      </div>
      
      <CustomScrollbar class="history-list">
        <ConversationList
          :conversations="chatStore.filteredConversations.slice(0, 8)"
          :current-id="chatStore.currentConversationId"
          :loading="chatStore.isLoadingConversations"
          :format-time="chatStore.formatTime"
          show-workspace
          @select="handleSelect"
          @delete="handleDelete"
        />
      </CustomScrollbar>
    </div>
    
    <!-- 无历史时的提示 -->
    <div class="no-history" v-else-if="!chatStore.isLoadingConversations">
      <p class="no-history-text">{{ t('components.home.noRecentChats') }}</p>
    </div>

    <ConfirmDialog
      v-model="showDeleteConfirm"
      :title="t('components.history.deleteConversation')"
      :message="pendingDeleteMessage"
      :confirm-text="t('components.history.confirmDelete')"
      :cancel-text="t('components.history.cancel')"
      is-danger
      @confirm="confirmDelete"
    />
  </div>
</template>

<style scoped>
.welcome-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--vscode-editor-background);
  overflow: hidden;
}

/* 欢迎区域 */
.welcome-section {
  padding: 32px 24px 24px;
  text-align: center;
  flex-shrink: 0;
}

.welcome-content {
  max-width: 400px;
  margin: 0 auto;
}

.logo {
  width: 56px;
  height: 56px;
  margin: 0 auto 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--vscode-editorWidget-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 14px;
}

.logo .codicon {
  font-size: 28px;
  color: var(--vscode-foreground);
  opacity: 0.7;
}

.welcome-title {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 600;
  color: var(--vscode-foreground);
}

.welcome-subtitle {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--vscode-descriptionForeground);
  line-height: 1.4;
}

.welcome-hint {
  margin: 0;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
  opacity: 0.7;
}

.welcome-actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.primary-action-btn,
.secondary-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.primary-action-btn {
  color: var(--vscode-button-foreground);
  background: var(--vscode-button-background);
  border: 1px solid var(--vscode-button-background);
}

.primary-action-btn:hover {
  background: var(--vscode-button-hoverBackground);
}

.secondary-action-btn {
  color: var(--vscode-foreground);
  background: var(--vscode-button-secondaryBackground);
  border: 1px solid var(--vscode-panel-border);
}

.secondary-action-btn:hover {
  background: var(--vscode-button-secondaryHoverBackground);
}

/* 历史对话区域 */
.history-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--vscode-panel-border);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  flex-shrink: 0;
}

.section-title {
  margin: 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--vscode-foreground);
  opacity: 0.8;
}

.view-all-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: transparent;
  color: var(--vscode-textLink-foreground);
  border: none;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: background 0.15s;
}

.view-all-btn.prominent {
  border: 1px solid var(--vscode-panel-border);
}

.view-all-btn:hover {
  background: var(--vscode-toolbar-hoverBackground);
}

.view-all-btn .codicon {
  font-size: 11px;
}

.history-list {
  flex: 1;
  min-height: 0;
}

/* 无历史提示 */
.no-history {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
}

.no-history-text {
  margin: 0;
  font-size: 13px;
  color: var(--vscode-descriptionForeground);
}
</style>