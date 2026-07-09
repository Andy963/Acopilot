import type {
  ActivePinnedPromptMode,
  ChatStoreState,
  PinnedPromptItem,
  PinnedPromptMode,
  PinnedPromptState,
  PinnedPromptWorkspaceDefault
} from './types'
import { sendToExtension } from '../../utils/vscode'

export function createDefaultPinnedPrompt(): PinnedPromptState {
  return { mode: 'none' }
}

export function createDefaultPinnedPrompts(): PinnedPromptItem[] {
  return []
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
  pinnedPrompts: PinnedPromptItem[]
  fromWorkspaceDefault: boolean
}> {
  const workspaceDefault = await getWorkspacePinnedPromptDefault()

  if (workspaceDefault) {
    if (workspaceDefault.mode === 'preset') {
      const pinnedPrompt: PinnedPromptState = { mode: 'preset', presetId: workspaceDefault.presetId }
      return {
        pinnedPrompt,
        pinnedPrompts: createPinnedPromptsFromSingle(pinnedPrompt),
        fromWorkspaceDefault: true
      }
    }

    const pinnedPrompt: PinnedPromptState = { mode: 'skill', skillId: workspaceDefault.skillId }
    return {
      pinnedPrompt,
      pinnedPrompts: createPinnedPromptsFromSingle(pinnedPrompt),
      fromWorkspaceDefault: true
    }
  }

  return {
    pinnedPrompt: createDefaultPinnedPrompt(),
    pinnedPrompts: createDefaultPinnedPrompts(),
    fromWorkspaceDefault: false
  }
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

function normalizeActiveMode(mode: unknown): ActivePinnedPromptMode | null {
  return mode === 'skill' || mode === 'custom' || mode === 'preset' ? mode : null
}

function createStablePromptId(prompt: Pick<PinnedPromptItem, 'mode' | 'skillId' | 'presetId'>, index: number): string {
  if (prompt.mode === 'skill' && prompt.skillId?.trim()) return `skill:${prompt.skillId.trim()}`
  if (prompt.mode === 'preset' && prompt.presetId?.trim()) return `preset:${prompt.presetId.trim()}`
  return `custom:${index + 1}`
}

function uniquePromptId(baseId: string, usedIds: Set<string>): string {
  let candidate = baseId
  let suffix = 2
  while (usedIds.has(candidate)) {
    candidate = `${baseId}:${suffix}`
    suffix += 1
  }
  usedIds.add(candidate)
  return candidate
}

function normalizePinnedPromptItem(value: unknown, index: number, usedIds: Set<string>): PinnedPromptItem | null {
  if (!value || typeof value !== 'object') return null

  const obj = value as any
  const mode = normalizeActiveMode(obj.mode)
  if (!mode) return null

  const draft: PinnedPromptItem = {
    id: '',
    mode,
    skillId: normalizeString(obj.skillId).trim(),
    presetId: normalizeString(obj.presetId).trim(),
    customPrompt: normalizeString(obj.customPrompt),
    name: normalizeString(obj.name).trim(),
    enabled: obj.enabled !== false,
    order: typeof obj.order === 'number' && Number.isFinite(obj.order) ? obj.order : index
  }

  if (!shouldPersistPinnedPrompt(draft)) return null

  const rawId = normalizeString(obj.id).trim()
  draft.id = uniquePromptId(rawId || createStablePromptId(draft, index), usedIds)
  return draft
}

export function normalizePinnedPrompts(value: unknown, legacyValue?: unknown): PinnedPromptItem[] {
  const usedIds = new Set<string>()

  if (Array.isArray(value)) {
    return value
      .map((item, index) => normalizePinnedPromptItem(item, index, usedIds))
      .filter((item): item is PinnedPromptItem => Boolean(item && item.enabled !== false))
      .sort((a, b) => a.order - b.order)
      .map((item, index) => ({ ...item, order: index }))
  }

  const legacy = normalizePinnedPrompt(legacyValue)
  return createPinnedPromptsFromSingle(legacy)
}

export function pinnedPromptFromItems(items: PinnedPromptItem[]): PinnedPromptState {
  const first = items.find(item => item.enabled !== false)
  if (!first) return createDefaultPinnedPrompt()
  return {
    mode: first.mode,
    skillId: first.skillId,
    presetId: first.presetId,
    customPrompt: first.customPrompt
  }
}

export function createPinnedPromptsFromSingle(pinnedPrompt: PinnedPromptState): PinnedPromptItem[] {
  const mode = normalizeActiveMode(pinnedPrompt.mode)
  if (!mode) return []

  const usedIds = new Set<string>()
  const item = normalizePinnedPromptItem({ ...pinnedPrompt, mode, order: 0 }, 0, usedIds)
  return item ? [item] : []
}

function syncPinnedPromptState(state: ChatStoreState, pinnedPrompts: PinnedPromptItem[]): void {
  const normalized = normalizePinnedPrompts(pinnedPrompts)
  state.pinnedPrompts.value = normalized
  state.pinnedPrompt.value = pinnedPromptFromItems(normalized)
}

export function dismissPinnedPromptWorkspaceDefaultNotice(state: ChatStoreState): void {
  state.pinnedPromptFromWorkspaceDefault.value = false
}

export async function loadPinnedPrompt(state: ChatStoreState, conversationId: string): Promise<void> {
  try {
    const metadata = await sendToExtension<any>('conversation.getConversationMetadata', { conversationId })
    const pinnedPrompts = normalizePinnedPrompts(metadata?.custom?.pinnedPrompts, metadata?.custom?.pinnedPrompt)
    syncPinnedPromptState(state, pinnedPrompts)
  } catch (error) {
    console.error('Failed to load pinned prompt:', error)
    syncPinnedPromptState(state, createDefaultPinnedPrompts())
  }
}

async function syncWorkspacePinnedPromptDefault(pinnedPrompts: PinnedPromptItem[]): Promise<void> {
  const reusable = [...pinnedPrompts]
    .reverse()
    .find(item => item.mode === 'skill' || item.mode === 'preset')

  if (!reusable) {
    if (pinnedPrompts.length === 0) await setWorkspacePinnedPromptDefault(null)
    return
  }

  if (reusable.mode === 'skill' && reusable.skillId?.trim()) {
    await setWorkspacePinnedPromptDefault({ mode: 'skill', skillId: reusable.skillId.trim() })
  } else if (reusable.mode === 'preset' && reusable.presetId?.trim()) {
    await setWorkspacePinnedPromptDefault({ mode: 'preset', presetId: reusable.presetId.trim() })
  }
}

async function persistPinnedPrompts(conversationId: string, pinnedPrompts: PinnedPromptItem[]): Promise<void> {
  const normalized = normalizePinnedPrompts(pinnedPrompts)
  const first = pinnedPromptFromItems(normalized)

  await sendToExtension('conversation.setCustomMetadata', {
    conversationId,
    key: 'pinnedPrompts',
    value: normalized
  })
  await sendToExtension('conversation.setCustomMetadata', {
    conversationId,
    key: 'pinnedPrompt',
    value: { ...first }
  })
}

export async function setPinnedPrompts(state: ChatStoreState, pinnedPrompts: PinnedPromptItem[]): Promise<void> {
  const normalized = normalizePinnedPrompts(pinnedPrompts)
  syncPinnedPromptState(state, normalized)
  state.pinnedPromptFromWorkspaceDefault.value = false

  await syncWorkspacePinnedPromptDefault(normalized)

  const conversationId = state.currentConversationId.value
  if (!conversationId) return

  try {
    await persistPinnedPrompts(conversationId, normalized)
  } catch (error) {
    console.error('Failed to persist pinned prompt:', error)
  }
}

export async function setPinnedPrompt(state: ChatStoreState, pinnedPrompt: PinnedPromptState): Promise<void> {
  await setPinnedPrompts(state, createPinnedPromptsFromSingle(pinnedPrompt))
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
  const pinnedPrompts = normalizePinnedPrompts(state.pinnedPrompts.value, state.pinnedPrompt.value)
  if (pinnedPrompts.length === 0) return

  try {
    await persistPinnedPrompts(conversationId, pinnedPrompts)
  } catch (error) {
    console.error('Failed to persist pinned prompt:', error)
  }
}
