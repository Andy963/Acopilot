import type { ChatMode } from '../../types'
import type { ChatStoreState } from './types'
import { sendToExtension } from '../../utils/vscode'

const CHAT_MODE_METADATA_KEY = 'chatMode'

export function createDefaultChatMode(): ChatMode {
  return 'chat'
}

function normalizeChatMode(value: unknown): ChatMode {
  if (value === 'chat' || value === 'plan' || value === 'agent') return value
  return 'chat'
}

export async function loadChatMode(state: ChatStoreState, conversationId: string): Promise<void> {
  try {
    const metadata = await sendToExtension<any>('conversation.getConversationMetadata', { conversationId })
    state.chatMode.value = normalizeChatMode(metadata?.custom?.[CHAT_MODE_METADATA_KEY])
  } catch {
    state.chatMode.value = createDefaultChatMode()
  }
}

export async function persistChatMode(state: ChatStoreState, conversationId: string): Promise<void> {
  try {
    await sendToExtension('conversation.setCustomMetadata', {
      conversationId,
      key: CHAT_MODE_METADATA_KEY,
      value: state.chatMode.value
    })
  } catch (error) {
    console.error('Failed to persist chat mode:', error)
  }
}

