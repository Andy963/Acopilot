import type { ChatStoreState, PinnedPromptMode, PinnedPromptState, PinnedPromptWorkspaceDefault } from './types'
import { sendToExtension } from '../../utils/vscode'

export function createDefaultPinnedPrompt(): PinnedPromptState {
  return { mode: 'none' }
}

function normalizeWorkspaceDefault(value: unknown): PinnedPromptWorkspaceDefault | null {
  if (!value || typeof value !== 'object') return null

  const obj = value as any
  if (obj.mode === 'skill') {
    const skillId = normalizeString(obj.skillId).trim()
    if (!skillId) return null
    return { mode: 'skill', skillId }
  }

  if (obj.mode === 'preset') {
    const presetId = normalizeString(obj.presetId).trim()
    if (!presetId) return null
    return { mode: 'preset', presetId }
  }

  return null
}

async function getWorkspacePinnedPromptDefault(): Promise<PinnedPromptWorkspaceDefault | null> {
  try {
    const result = await sendToExtension<{ default: unknown }>('getPinnedPromptWorkspaceDefault', {})
    return normalizeWorkspaceDefault(result?.default)
  } catch (error) {
    console.error('Failed to load workspace pinned prompt default:', error)
    return null
  }
}

async function setWorkspacePinnedPromptDefault(value: PinnedPromptWorkspaceDefault | null): Promise<void> {
  try {
    await sendToExtension('setPinnedPromptWorkspaceDefault', { value })
  } catch (error) {
    console.error('Failed to persist workspace pinned prompt default:', error)
  }
}

/**
 * Resolves the pinned prompt for a brand-new (not-yet-persisted) conversation.
 *
 * Applies the workspace's remembered reusable prompt selection, if any, so switching
 * conversations within the same project restores the last used pinned
 * prompt instead of starting empty every time.
 */
export async function resolveDefaultPinnedPromptForNewConversation(): Promise<{
  pinnedPrompt: PinnedPromptState
  fromWorkspaceDefault: boolean
}> {
  const workspaceDefault = await getWorkspacePinnedPromptDefault()

  if (workspaceDefault) {
    if (workspaceDefault.mode === 'preset') {
      return {
        pinnedPrompt: { mode: 'preset', presetId: workspaceDefault.presetId },
        fromWorkspaceDefault: true
      }
    }

    return {
      pinnedPrompt: { mode: 'skill', skillId: workspaceDefault.skillId },
      fromWorkspaceDefault: true
    }
  }

  return { pinnedPrompt: createDefaultPinnedPrompt(), fromWorkspaceDefault: false }
}

function normalizeMode(mode: unknown): PinnedPromptMode {
  if (mode === 'skill' || mode === 'custom' || mode === 'preset' || mode === 'none') return mode
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
    presetId: normalizeString(obj.presetId),
    customPrompt: normalizeString(obj.customPrompt)
  }
}

export function dismissPinnedPromptWorkspaceDefaultNotice(state: ChatStoreState): void {
  state.pinnedPromptFromWorkspaceDefault.value = false
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
  state.pinnedPromptFromWorkspaceDefault.value = false

  if (pinnedPrompt.mode === 'skill' && pinnedPrompt.skillId?.trim()) {
    await setWorkspacePinnedPromptDefault({ mode: 'skill', skillId: pinnedPrompt.skillId.trim() })
  } else if (pinnedPrompt.mode === 'preset' && pinnedPrompt.presetId?.trim()) {
    await setWorkspacePinnedPromptDefault({ mode: 'preset', presetId: pinnedPrompt.presetId.trim() })
  } else if (pinnedPrompt.mode === 'none') {
    await setWorkspacePinnedPromptDefault(null)
  }

  const conversationId = state.currentConversationId.value
  if (!conversationId) return

  try {
    await sendToExtension('conversation.setCustomMetadata', {
      conversationId,
      key: 'pinnedPrompt',
      value: { ...pinnedPrompt }
    })
  } catch (error) {
    console.error('Failed to persist pinned prompt:', error)
  }
}

export function shouldPersistPinnedPrompt(pinnedPrompt: PinnedPromptState): boolean {
  if (pinnedPrompt.mode === 'skill') {
    return Boolean(pinnedPrompt.skillId && pinnedPrompt.skillId.trim())
  }
  if (pinnedPrompt.mode === 'preset') {
    return Boolean(pinnedPrompt.presetId && pinnedPrompt.presetId.trim())
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
      value: { ...state.pinnedPrompt.value }
    })
  } catch (error) {
    console.error('Failed to persist pinned prompt:', error)
  }
}
