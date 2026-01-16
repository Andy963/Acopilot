import type { ChatStoreState, PinnedSelectionState } from './types'
import { sendToExtension } from '../../utils/vscode'
import { generateId } from '../../utils/format'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeString(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value
}

function normalizePositiveInt(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.floor(n)
}

function normalizeBoolean(value: unknown): boolean | undefined {
  if (value === true) return true
  if (value === false) return false
  return undefined
}

export function normalizePinnedSelections(value: unknown): PinnedSelectionState[] {
  if (!Array.isArray(value)) return []

  const items: PinnedSelectionState[] = []
  for (const entry of value) {
    if (!isRecord(entry)) continue

    const path = normalizeString(entry.path).trim()
    const uri = normalizeString(entry.uri).trim()
    const languageId = normalizeString(entry.languageId).trim() || 'plaintext'
    const text = normalizeString(entry.text)
    const startLine = normalizePositiveInt(entry.startLine, 1)
    const endLine = normalizePositiveInt(entry.endLine, startLine)

    if (!path || !uri || !text.trim()) continue

    items.push({
      id: normalizeString(entry.id).trim() || generateId(),
      uri,
      path,
      startLine,
      endLine: Math.max(endLine, startLine),
      languageId,
      text,
      originalCharCount: typeof entry.originalCharCount === 'number' ? entry.originalCharCount : undefined,
      truncated: normalizeBoolean(entry.truncated),
      createdAt: typeof entry.createdAt === 'number' ? entry.createdAt : Date.now()
    })
  }

  return items
}

export async function loadPinnedSelections(state: ChatStoreState, conversationId: string): Promise<void> {
  try {
    const metadata = await sendToExtension<any>('conversation.getConversationMetadata', { conversationId })
    state.pinnedSelections.value = normalizePinnedSelections(metadata?.custom?.pinnedSelections)
  } catch (error) {
    console.error('Failed to load pinned selections:', error)
    state.pinnedSelections.value = []
  }
}

async function persistPinnedSelections(state: ChatStoreState, conversationId: string): Promise<void> {
  try {
    await sendToExtension('conversation.setCustomMetadata', {
      conversationId,
      key: 'pinnedSelections',
      value: state.pinnedSelections.value
    })
  } catch (error) {
    console.error('Failed to persist pinned selections:', error)
  }
}

export async function addPinnedSelection(state: ChatStoreState, input: Partial<PinnedSelectionState>): Promise<void> {
  const path = normalizeString(input.path).trim()
  const uri = normalizeString(input.uri).trim()
  const languageId = normalizeString(input.languageId).trim() || 'plaintext'
  const text = normalizeString(input.text)
  const startLine = normalizePositiveInt(input.startLine, 1)
  const endLine = normalizePositiveInt(input.endLine, startLine)

  if (!path || !uri || !text.trim()) return

  const item: PinnedSelectionState = {
    id: input.id?.trim() || generateId(),
    uri,
    path,
    startLine,
    endLine: Math.max(endLine, startLine),
    languageId,
    text,
    originalCharCount: typeof input.originalCharCount === 'number' ? input.originalCharCount : undefined,
    truncated: normalizeBoolean(input.truncated),
    createdAt: typeof input.createdAt === 'number' ? input.createdAt : Date.now()
  }

  // 去重：同文件同范围内容相同则不重复添加
  const exists = state.pinnedSelections.value.some((s) =>
    s.path === item.path &&
    s.startLine === item.startLine &&
    s.endLine === item.endLine &&
    s.text === item.text
  )
  if (exists) return

  state.pinnedSelections.value = [item, ...state.pinnedSelections.value]

  const conversationId = state.currentConversationId.value
  if (conversationId) {
    await persistPinnedSelections(state, conversationId)
  }
}

export async function removePinnedSelection(state: ChatStoreState, id: string): Promise<void> {
  if (!id) return
  state.pinnedSelections.value = state.pinnedSelections.value.filter((s) => s.id !== id)

  const conversationId = state.currentConversationId.value
  if (conversationId) {
    await persistPinnedSelections(state, conversationId)
  }
}

export async function clearPinnedSelections(state: ChatStoreState): Promise<void> {
  state.pinnedSelections.value = []
  const conversationId = state.currentConversationId.value
  if (conversationId) {
    await persistPinnedSelections(state, conversationId)
  }
}

export async function persistPinnedSelectionsForConversation(
  state: ChatStoreState,
  conversationId: string
): Promise<void> {
  if (!Array.isArray(state.pinnedSelections.value) || state.pinnedSelections.value.length === 0) return
  await persistPinnedSelections(state, conversationId)
}

