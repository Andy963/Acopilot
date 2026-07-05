<script setup lang="ts">
import { HistoryPage } from './components/history'
import AppChatView from './components/shell/AppChatView.vue'
import { SettingsPanel } from './components/settings'
import { useAppBridge } from './composables/useAppBridge'
import { useAppShell } from './composables/useAppShell'

const {
  chatStore,
  settingsStore,
  attachments,
  uploading,
  conversationTitle,
  handleNewChat,
  handleSend,
  handleCancel,
  handleEdit,
  handleDelete,
  handleRetry,
  handleCopy,
  handleAttachFile,
  handleRemoveAttachment,
  handlePasteFiles,
  handleShowSettings,
  handleShowHistory,
} = useAppShell()

const { languageLoaded } = useAppBridge({
  chatStore,
  settingsStore,
  handleNewChat,
  handleShowHistory,
  handleShowSettings,
})
</script>

<template>
  <div class="app-container">
    <!-- 等待语言加载完成 -->
    <template v-if="!languageLoaded">
      <div class="loading-container">
        <i class="codicon codicon-loading spin"></i>
      </div>
    </template>
    
    <AppChatView
      v-show="languageLoaded && settingsStore.currentView === 'chat'"
      :conversation-title="conversationTitle"
      :attachments="attachments"
      :uploading="uploading"
      @send="handleSend"
      @cancel="handleCancel"
      @edit="handleEdit"
      @delete="handleDelete"
      @retry="handleRetry"
      @copy="handleCopy"
      @attach-file="handleAttachFile"
      @remove-attachment="handleRemoveAttachment"
      @paste-files="handlePasteFiles"
      @show-history="handleShowHistory"
    />

    <!-- 历史页面 -->
    <HistoryPage v-if="languageLoaded && settingsStore.currentView === 'history'" />

    <!-- 设置面板 -->
    <SettingsPanel v-if="languageLoaded && settingsStore.currentView === 'settings'" />
  </div>
</template>

<style scoped>
/* 主容器 - 扁平化设计 */
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--vscode-editor-background);
  color: var(--vscode-foreground);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 加载容器 */
.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  color: var(--vscode-foreground);
}

.loading-container .codicon {
  font-size: 24px;
  opacity: 0.6;
}
</style>
