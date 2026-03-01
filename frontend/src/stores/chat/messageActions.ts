/**
 * Chat Store 消息操作
 * 
 * 包含消息发送、重试、编辑、删除等操作
 */

import type { Message, Attachment, ChatMode, ContextInjectionOverrides } from '../../types'
import type { ChatStoreState, ChatStoreComputed } from './types'
import { sendToExtension } from '../../utils/vscode'
import { generateId } from '../../utils/format'
import { createAndPersistConversation } from './conversationActions'
import { clearCheckpointsFromIndex } from './checkpointActions'
import { persistPinnedPromptForConversation } from './pinnedPromptActions'
import { persistChatMode } from './chatModeActions'
import { toAttachmentData } from './messageActions/attachmentData'

/**
 * 取消流式的回调类型
 */
export type CancelStreamCallback = () => Promise<void>

export interface SendMessageOptions {
  taskContext?: string
  chatMode?: ChatMode
  contextOverrides?: ContextInjectionOverrides
  /**
   * Hide this user message from the UI (kept in allMessages to preserve indexing).
   * Intended for system-generated control prompts like "continue".
   */
  internalUserMessage?: boolean
  /** Avoid updating conversation preview for internal/control messages. */
  skipConversationPreview?: boolean
}

/**
 * 发送消息
 */
export async function sendMessage(
  state: ChatStoreState,
  computed: ChatStoreComputed,
  messageText: string,
  attachments?: Attachment[],
  options?: SendMessageOptions
): Promise<void> {
  const originalText = String(messageText || '')
  const effectiveMessageText = originalText

  if (!effectiveMessageText.trim() && (!attachments || attachments.length === 0)) return

  state.error.value = null
  if (state.isWaitingForResponse.value) return

  // 新一轮对话开始前，隐藏“改动后校验”提示（上一轮的提示不应阻塞后续对话）
  state.postEditValidationPending.value = false

  state.isLoading.value = true
  state.isStreaming.value = true
  state.isWaitingForResponse.value = true

  try {
    if (!state.currentConversationId.value) {
      const newId = await createAndPersistConversation(state, messageText)
      if (!newId) {
        throw new Error('Failed to create conversation')
      }

      // 对话创建后，将当前选择的固定提示词/技能持久化（用于首条消息生效）
      await persistPinnedPromptForConversation(state, newId)

      // Persist per-conversation chat mode so reloads/restores keep the same behavior.
      await persistChatMode(state, newId)

      // 对话创建后，若存在 Plan Runner 草稿，也一并持久化（用于重启后恢复）
      if (state.planRunner.value) {
        try {
          await sendToExtension('conversation.setCustomMetadata', {
            conversationId: newId,
            key: 'planRunner',
            value: JSON.parse(JSON.stringify(state.planRunner.value))
          })
        } catch (err) {
          console.warn('Failed to persist plan runner state:', err)
        }
      }
    }

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: effectiveMessageText,
      timestamp: Date.now(),
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
      metadata: options?.internalUserMessage ? { internal: true } : undefined
    }
    state.allMessages.value.push(userMessage)

    const assistantMessageId = generateId()
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      streaming: true,
      metadata: {
        modelVersion: computed.currentModelName.value
      }
    }
    state.allMessages.value.push(assistantMessage)
    state.streamingMessageId.value = assistantMessageId

    const conv = state.conversations.value.find(c => c.id === state.currentConversationId.value)
    if (conv) {
      conv.updatedAt = Date.now()
      conv.messageCount = state.allMessages.value.length
      if (!options?.skipConversationPreview) {
        conv.preview = messageText.slice(0, 50)
      }
    }

    state.toolCallBuffer.value = ''
    state.inToolCall.value = null

    const attachmentData = toAttachmentData(attachments)

    const selectionReferences = state.selectionReferences.value
    const hasSelectionReferences = Array.isArray(selectionReferences) && selectionReferences.length > 0

    const selectionReferencesPayload = hasSelectionReferences
      ? selectionReferences.map((r) => ({ ...r }))
      : undefined
    const contextOverridesPayload =
      options?.contextOverrides && Object.keys(options.contextOverrides).length > 0 ? { ...options.contextOverrides } : undefined
    const taskContextPayload = options?.taskContext?.trim() ? String(options.taskContext) : undefined
    const chatModePayload = options?.chatMode || state.chatMode.value || 'chat'

    await sendToExtension('chatStream', {
      conversationId: state.currentConversationId.value,
      configId: state.configId.value,
      message: effectiveMessageText,
      chatMode: chatModePayload,
      attachments: attachmentData,
      selectionReferences: selectionReferencesPayload,
      contextOverrides: contextOverridesPayload,
      taskContext: taskContextPayload
    })

    state.selectionReferences.value = []

  } catch (err: any) {
    if (state.isStreaming.value) {
      state.error.value = {
        code: err.code || 'SEND_ERROR',
        message: err.message || 'Failed to send message'
      }
      state.streamingMessageId.value = null
      state.isStreaming.value = false
      state.isWaitingForResponse.value = false
    }
  } finally {
    state.isLoading.value = false
  }
}

/**
 * 重试最后一条消息
 */
export async function retryLastMessage(
  state: ChatStoreState,
  computed: ChatStoreComputed,
  cancelStream: CancelStreamCallback
): Promise<void> {
  if (state.allMessages.value.length === 0) return
  let lastAssistantIndex = -1
  for (let i = state.allMessages.value.length - 1; i >= 0; i--) {
    if (state.allMessages.value[i].role === 'assistant') {
      lastAssistantIndex = i
      break
    }
  }
  if (lastAssistantIndex !== -1) {
    await retryFromMessage(state, computed, lastAssistantIndex, cancelStream)
  }
}

/**
 * 从指定消息重试
 */
export async function retryFromMessage(
  state: ChatStoreState,
  computed: ChatStoreComputed,
  messageIndex: number,
  cancelStream: CancelStreamCallback
): Promise<void> {
  if (!state.currentConversationId.value || state.allMessages.value.length === 0) return
  if (messageIndex < 0 || messageIndex >= state.allMessages.value.length) return

  if (state.isStreaming.value) {
    await cancelStream()
  }

  state.error.value = null
  state.isLoading.value = true
  state.isStreaming.value = true
  state.isWaitingForResponse.value = true

  state.allMessages.value = state.allMessages.value.slice(0, messageIndex)
  clearCheckpointsFromIndex(state, messageIndex)

  try {
    await sendToExtension('deleteMessage', {
      conversationId: state.currentConversationId.value,
      targetIndex: messageIndex
    })
  } catch (err) {
    console.error('Failed to delete messages from backend:', err)
  }

  state.toolCallBuffer.value = ''
  state.inToolCall.value = null

  const assistantMessageId = generateId()
  const assistantMessage: Message = {
    id: assistantMessageId,
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    streaming: true,
    metadata: {
      modelVersion: computed.currentModelName.value
    }
  }
  state.allMessages.value.push(assistantMessage)
  state.streamingMessageId.value = assistantMessageId

  try {
    await sendToExtension('retryStream', {
      conversationId: state.currentConversationId.value,
      configId: state.configId.value
    })
  } catch (err: any) {
    if (state.isStreaming.value) {
      state.error.value = {
        code: err.code || 'RETRY_ERROR',
        message: err.message || 'Retry failed'
      }
      state.streamingMessageId.value = null
      state.isStreaming.value = false
      state.isWaitingForResponse.value = false
    }
  } finally {
    state.isLoading.value = false
  }
}

/**
 * 错误后重试
 */
export async function retryAfterError(
  state: ChatStoreState,
  computed: ChatStoreComputed
): Promise<void> {
  if (!state.currentConversationId.value) return
  if (state.isLoading.value || state.isStreaming.value) return

  state.error.value = null
  state.isLoading.value = true
  state.isStreaming.value = true
  state.isWaitingForResponse.value = true

  state.toolCallBuffer.value = ''
  state.inToolCall.value = null

  const assistantMessageId = generateId()
  const assistantMessage: Message = {
    id: assistantMessageId,
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    streaming: true,
    metadata: {
      modelVersion: computed.currentModelName.value
    }
  }
  state.allMessages.value.push(assistantMessage)
  state.streamingMessageId.value = assistantMessageId

  try {
    await sendToExtension('retryStream', {
      conversationId: state.currentConversationId.value,
      configId: state.configId.value
    })
  } catch (err: any) {
    if (state.isStreaming.value) {
      state.error.value = {
        code: err.code || 'RETRY_ERROR',
        message: err.message || 'Retry failed'
      }
      state.streamingMessageId.value = null
      state.isStreaming.value = false
      state.isWaitingForResponse.value = false
    }
  } finally {
    state.isLoading.value = false
  }
}

/**
 * 工具执行后继续（避免重复执行工具）
 *
 * 当上一轮对话以 functionResponse 结束时，直接 retryStream 可能会导致模型重复发起工具调用，
 * 造成“继续 → 又跑工具 → 又需要继续”的死循环。
 *
 * 这里通过发送一条“继续完成回复”的用户消息，并强制 includeTools=false，
 * 让模型只基于已有工具结果补全回复，不再发起新工具调用。
 */
export async function continueAfterToolExecution(
  state: ChatStoreState,
  computed: ChatStoreComputed,
  prompt?: string
): Promise<void> {
  if (!state.currentConversationId.value) return
  if (state.isWaitingForResponse.value || state.isStreaming.value || state.isLoading.value) return

  const continuePrompt = (prompt && prompt.trim())
    ? prompt.trim()
    : '继续完成上一条回复。不要重复执行任何工具/命令；仅基于已经产生的工具结果继续回答。'

  const previousSelectionRefs = Array.isArray(state.selectionReferences.value)
    ? state.selectionReferences.value.map((r) => ({ ...r }))
    : []

  // 强制禁用工具，避免重复执行
  state.selectionReferences.value = []

  try {
    await sendMessage(state, computed, continuePrompt, undefined, {
      internalUserMessage: true,
      skipConversationPreview: true,
      contextOverrides: { includeTools: false },
    })
  } finally {
    state.selectionReferences.value = previousSelectionRefs
  }
}

/**
 * 编辑并重发消息
 */
export async function editAndRetry(
  state: ChatStoreState,
  computed: ChatStoreComputed,
  messageIndex: number,
  newMessage: string,
  attachments: Attachment[] | undefined,
  cancelStream: CancelStreamCallback
): Promise<void> {
  if ((!newMessage.trim() && (!attachments || attachments.length === 0)) || !state.currentConversationId.value) return
  if (messageIndex < 0 || messageIndex >= state.allMessages.value.length) return

  if (state.isStreaming.value) {
    await cancelStream()
  }

  state.error.value = null
  state.isLoading.value = true
  state.isStreaming.value = true
  state.isWaitingForResponse.value = true

  const targetMessage = state.allMessages.value[messageIndex]
  targetMessage.content = newMessage
  targetMessage.parts = [{ text: newMessage }]
  targetMessage.attachments = attachments && attachments.length > 0 ? attachments : undefined

  state.allMessages.value = state.allMessages.value.slice(0, messageIndex + 1)
  clearCheckpointsFromIndex(state, messageIndex)

  state.toolCallBuffer.value = ''
  state.inToolCall.value = null

  const assistantMessageId = generateId()
  const assistantMessage: Message = {
    id: assistantMessageId,
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    streaming: true,
    metadata: {
      modelVersion: computed.currentModelName.value
    }
  }
  state.allMessages.value.push(assistantMessage)
  state.streamingMessageId.value = assistantMessageId

  const attachmentData = toAttachmentData(attachments)

  try {
    await sendToExtension('editAndRetryStream', {
      conversationId: state.currentConversationId.value,
      messageIndex,
      newMessage,
      attachments: attachmentData,
      configId: state.configId.value
    })
  } catch (err: any) {
    if (state.isStreaming.value) {
      state.error.value = {
        code: err.code || 'EDIT_RETRY_ERROR',
        message: err.message || 'Edit and retry failed'
      }
      state.streamingMessageId.value = null
      state.isStreaming.value = false
      state.isWaitingForResponse.value = false
    }
  } finally {
    state.isLoading.value = false
  }
}

/**
 * 删除消息
 */
export async function deleteMessage(
  state: ChatStoreState,
  targetIndex: number,
  cancelStream: CancelStreamCallback
): Promise<void> {
  if (!state.currentConversationId.value) return
  if (targetIndex < 0 || targetIndex >= state.allMessages.value.length) return

  if (state.isStreaming.value) {
    await cancelStream()
  }

  try {
    const response = await sendToExtension<{ success: boolean; deletedCount: number }>('deleteMessage', {
      conversationId: state.currentConversationId.value,
      targetIndex
    })

    if (response.success) {
      state.allMessages.value = state.allMessages.value.slice(0, targetIndex)
      clearCheckpointsFromIndex(state, targetIndex)
    }
  } catch (err: any) {
    state.error.value = {
      code: err.code || 'DELETE_ERROR',
      message: err.message || 'Delete failed'
    }
  }
}

/**
 * 删除单条消息（不删除后续消息）
 */
export async function deleteSingleMessage(
  state: ChatStoreState,
  targetIndex: number,
  cancelStream: CancelStreamCallback
): Promise<void> {
  if (!state.currentConversationId.value) return
  if (targetIndex < 0 || targetIndex >= state.allMessages.value.length) return

  if (state.isStreaming.value) {
    await cancelStream()
  }

  try {
    const response = await sendToExtension<{ success: boolean }>('deleteSingleMessage', {
      conversationId: state.currentConversationId.value,
      targetIndex
    })

    if (response.success) {
      state.allMessages.value = [
        ...state.allMessages.value.slice(0, targetIndex),
        ...state.allMessages.value.slice(targetIndex + 1)
      ]
    }
  } catch (err: any) {
    state.error.value = {
      code: err.code || 'DELETE_ERROR',
      message: err.message || 'Delete failed'
    }
  }
}

/**
 * 清空当前对话的消息
 */
export function clearMessages(state: ChatStoreState): void {
  state.allMessages.value = []
  state.error.value = null
  state.streamingMessageId.value = null
  state.isWaitingForResponse.value = false
}
