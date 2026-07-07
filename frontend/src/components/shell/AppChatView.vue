<script setup lang="ts">
import { IconButton, Tooltip } from '../common'
import ContextInspectorModal from '../common/ContextInspectorModal.vue'
import { WelcomePanel } from '../home'
import { InputArea } from '../input'
import { MessageList } from '../message'
import { useChatStore, useSettingsStore } from '../../stores'
import { useI18n } from '../../i18n'
import type { Attachment } from '../../types'
import RetryStatusPanel from './RetryStatusPanel.vue'

defineProps<{
  conversationTitle: string
  attachments: Attachment[]
  uploading: boolean
}>()

defineEmits<{
  send: [content: string, attachments: Attachment[]]
  cancel: []
  edit: [messageId: string, newContent: string, attachments: Attachment[]]
  delete: [messageId: string]
  retry: [messageId: string]
  copy: [content: string]
  'attach-file': []
  'remove-attachment': [id: string]
  'paste-files': [files: File[]]
  'show-history': []
}>()

const { t } = useI18n()
const chatStore = useChatStore()
const settingsStore = useSettingsStore()

function openContextSettings() {
  chatStore.closeContextInspector()
  settingsStore.showSettings('context')
}
</script>

<template>
  <div class="chat-view">
    <div v-if="chatStore.currentConversationId" class="conversation-header">
      <Tooltip :content="t('components.header.history')" placement="bottom">
        <IconButton icon="codicon-arrow-left" size="medium" @click="$emit('show-history')" />
      </Tooltip>
      <div class="conversation-title" :title="conversationTitle">{{ conversationTitle }}</div>
    </div>

    <div class="chat-area">
      <WelcomePanel v-if="chatStore.showEmptyState" />

      <MessageList
        v-show="!chatStore.showEmptyState"
        :messages="chatStore.messages"
        @edit="(messageId, newContent, attachments) => $emit('edit', messageId, newContent, attachments)"
        @delete="(messageId) => $emit('delete', messageId)"
        @retry="(messageId) => $emit('retry', messageId)"
        @copy="(content) => $emit('copy', content)"
      />

      <RetryStatusPanel @cancel="$emit('cancel')" />
    </div>

    <InputArea
      :attachments="attachments"
      :uploading="uploading"
      @send="(content, nextAttachments) => $emit('send', content, nextAttachments)"
      @cancel="$emit('cancel')"
      @attach-file="$emit('attach-file')"
      @remove-attachment="(id) => $emit('remove-attachment', id)"
      @paste-files="(files) => $emit('paste-files', files)"
    />

    <ContextInspectorModal
      :model-value="chatStore.contextInspectorVisible"
      :loading="chatStore.contextInspectorLoading"
      :error="chatStore.contextInspectorError"
      :data="chatStore.contextInspectorData"
      :source="chatStore.contextInspectorSource"
      @update:model-value="(visible) => { if (!visible) chatStore.closeContextInspector() }"
      @refresh="chatStore.openContextInspectorPreview"
      @open-settings="openContextSettings"
    />
  </div>
</template>

<style scoped>
.chat-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.chat-area {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative;
}

.conversation-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--vscode-panel-border);
  background: var(--vscode-editor-background);
  flex-shrink: 0;
}

.conversation-title {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--vscode-foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
