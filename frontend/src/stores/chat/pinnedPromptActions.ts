import type { ChatStoreState, PinnedPromptMode, PinnedPromptState } from './types'
import { sendToExtension } from '../../utils/vscode'

export function createDefaultPinnedPrompt(): PinnedPromptState {
  return { mode: 'none' }
}

function normalizeMode(mode: unknown): PinnedPromptMode {
  if (mode === 'skill' || mode === 'custom' || mode === 'none') return mode
  return 'none'
}

function normalizeString(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value
}

export function normalizePinnedPrompt(value: unknown): PinnedPromptState {
  if (!value || typeof value !== 'object') return createDefaultPinnedPrompt()

  const obj = value as any
  return {
    mode: normalizeMode(obj.mode),
    skillId: normalizeString(obj.skillId),
    customPrompt: normalizeString(obj.customPrompt)
  }
}

export async function loadPinnedPrompt(state: ChatStoreState, conversationId: string): Promise<void> {
  try {
    const metadata = await sendToExtension<any>('conversation.getConversationMetadata', { conversationId })
    state.pinnedPrompt.value = normalizePinnedPrompt(metadata?.custom?.pinnedPrompt)
  } catch (error) {
    console.error('Failed to load pinned prompt:', error)
    state.pinnedPrompt.value = createDefaultPinnedPrompt()
  }
}

export async function setPinnedPrompt(state: ChatStoreState, pinnedPrompt: PinnedPromptState): Promise<void> {
  state.pinnedPrompt.value = pinnedPrompt

  const conversationId = state.currentConversationId.value
  if (!conversationId) return

  try {
    await sendToExtension('conversation.setCustomMetadata', {
      conversationId,
      key: 'pinnedPrompt',
      value: pinnedPrompt
    })
  } catch (error) {
    console.error('Failed to persist pinned prompt:', error)
  }
}

export function shouldPersistPinnedPrompt(pinnedPrompt: PinnedPromptState): boolean {
  if (pinnedPrompt.mode === 'skill') {
    return Boolean(pinnedPrompt.skillId && pinnedPrompt.skillId.trim())
  }
  if (pinnedPrompt.mode === 'custom') {
    return Boolean(pinnedPrompt.customPrompt && pinnedPrompt.customPrompt.trim())
  }
  return false
}

export async function persistPinnedPromptForConversation(
  state: ChatStoreState,
  conversationId: string
): Promise<void> {
  if (!shouldPersistPinnedPrompt(state.pinnedPrompt.value)) return

  try {
    await sendToExtension('conversation.setCustomMetadata', {
      conversationId,
      key: 'pinnedPrompt',
      value: state.pinnedPrompt.value
    })
  } catch (error) {
    console.error('Failed to persist pinned prompt:', error)
  }
}

