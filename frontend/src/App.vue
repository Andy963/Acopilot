<script setup lang="ts">
import { HistoryPage } from './components/history'
import { IconButton, Tooltip } from './components/common'
import AppChatView from './components/shell/AppChatView.vue'
import { SettingsPanel } from './components/settings'
import { useAppBridge } from './composables/useAppBridge'
import { useAppShell } from './composables/useAppShell'
import { useI18n } from './i18n'

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

const { t } = useI18n()
</script>

<template>
  <div class="app-container">
    <template v-if="!languageLoaded">
      <div class="loading-container">
        <i class="codicon codicon-loading spin"></i>
      </div>
    </template>

    <template v-else>
      <header class="app-toolbar" aria-label="Acopilot actions">
        <div class="app-toolbar-actions">
          <Tooltip :content="t('components.header.newChat')" placement="bottom">
            <IconButton
              icon="codicon-add"
              size="medium"
              :aria-label="t('components.header.newChat')"
              @click="handleNewChat"
            />
          </Tooltip>

          <Tooltip :content="t('components.header.history')" placement="bottom">
            <IconButton
              icon="codicon-history"
              size="medium"
              :aria-label="t('components.header.history')"
              @click="handleShowHistory"
            />
          </Tooltip>

          <Tooltip :content="t('components.header.settings')" placement="bottom">
            <IconButton
              icon="codicon-settings-gear"
              size="medium"
              :aria-label="t('components.header.settings')"
              @click="handleShowSettings"
            />
          </Tooltip>
        </div>
      </header>

      <main class="app-content">
        <AppChatView
          class="app-view"
          v-show="settingsStore.currentView === 'chat'"
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

        <HistoryPage v-if="settingsStore.currentView === 'history'" class="app-view" />

        <SettingsPanel v-if="settingsStore.currentView === 'settings'" class="app-view" />
      </main>
    </template>
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--vscode-editor-background);
  color: var(--vscode-foreground);
}

.app-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-shrink: 0;
  min-height: 36px;
  padding: 4px 10px;
  border-bottom: 1px solid var(--vscode-panel-border);
  background: var(--vscode-editor-background);
}

.app-toolbar-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  min-height: 28px;
}

.app-content {
  position: relative;
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.app-view {
  flex: 1;
  min-width: 0;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

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
