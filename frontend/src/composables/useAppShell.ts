import { computed } from 'vue'
import { useAttachments } from './useAttachments'
import { useI18n } from './useI18n'
import { useChatStore, useSettingsStore } from '../stores'
import { copyToClipboard } from '../utils'
import { generateConversationTitleFromMessages } from '../utils/conversationTitle'
import type { Attachment, Message } from '../types'

export function useAppShell() {
  const { t } = useI18n()
  const chatStore = useChatStore()
  const settingsStore = useSettingsStore()

  const {
    attachments,
    uploading,
    addAttachments,
    removeAttachment,
    clearAttachments,
  } = useAttachments()

  const conversationTitle = computed(() => {
    const title = chatStore.currentConversation?.title?.trim()
    if (title) return title

    const fallbackTitle = generateConversationTitleFromMessages(chatStore.messages)
    if (fallbackTitle) return fallbackTitle

    return t('components.history.noTitle')
  })

  function findMessageIndex(messageId: string): number {
    return chatStore.allMessages.findIndex((message: Message) => message.id === messageId)
  }

  async function addAttachmentBatch(files: File[], source: string) {
    if (files.length === 0) return

    try {
      await addAttachments(files)
    } catch (error) {
      console.error(`${source} failed:`, error)
    }
  }

  function handleNewChat() {
    chatStore.createNewConversation()
    settingsStore.showChat()
  }

  async function handleSend(content: string, messageAttachments: Attachment[]) {
    if (!content.trim() && messageAttachments.length === 0) return

    clearAttachments()

    try {
      if (chatStore.hasPendingToolConfirmation) {
        await chatStore.rejectPendingToolsWithAnnotation(content)
        return
      }

      await chatStore.sendMessage(content, messageAttachments)
    } catch (error) {
      console.error('Send failed:', error)
    }
  }

  async function handleCancel() {
    try {
      await chatStore.cancelStream()
    } catch (error) {
      console.error('Cancel failed:', error)
    }
  }

  async function handleEdit(messageId: string, newContent: string, editAttachments: Attachment[]) {
    const index = findMessageIndex(messageId)
    if (index === -1) return

    try {
      await chatStore.editAndRetry(index, newContent, editAttachments)
    } catch (error) {
      console.error('Edit failed:', error)
    }
  }

  async function handleDelete(messageId: string) {
    const index = findMessageIndex(messageId)
    if (index === -1) return

    try {
      await chatStore.deleteMessage(index)
    } catch (error) {
      console.error('Delete failed:', error)
    }
  }

  async function handleRetry(messageId: string) {
    const index = findMessageIndex(messageId)
    if (index === -1) return

    try {
      await chatStore.retryFromMessage(index)
    } catch (error) {
      console.error('Retry failed:', error)
    }
  }

  async function handleCopy(content: string) {
    const success = await copyToClipboard(content)
    if (success) {
      console.log('Copied to clipboard')
    }
  }

  function handleAttachFile() {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.txt'

    input.onchange = (event) => {
      const files = Array.from((event.target as HTMLInputElement).files || [])
      void addAttachmentBatch(files, 'Attachment upload')
    }

    input.click()
  }

  function handleRemoveAttachment(id: string) {
    removeAttachment(id)
  }

  async function handlePasteFiles(files: File[]) {
    await addAttachmentBatch(files, 'Attachment paste')
  }

  function handleShowSettings() {
    settingsStore.showSettings()
  }

  function handleShowHistory() {
    settingsStore.showHistory()
  }

  return {
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
  }
}
