import type { ChatStoreState, SelectionReference } from './types'
import { generateId } from '../../utils/format'

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

export async function addSelectionReference(state: ChatStoreState, input: Partial<SelectionReference>): Promise<void> {
  const path = normalizeString(input.path).trim()
  const uri = normalizeString(input.uri).trim()
  const languageId = normalizeString(input.languageId).trim() || 'plaintext'
  const text = normalizeString(input.text)
  const startLine = normalizePositiveInt(input.startLine, 1)
  const endLine = normalizePositiveInt(input.endLine, startLine)

  if (!path || !uri || !text.trim()) return

  const item: SelectionReference = {
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
  const exists = state.selectionReferences.value.some((s) =>
    s.path === item.path &&
    s.startLine === item.startLine &&
    s.endLine === item.endLine &&
    s.text === item.text
  )
  if (exists) return

  state.selectionReferences.value = [item, ...state.selectionReferences.value]
}

export async function removeSelectionReference(state: ChatStoreState, id: string): Promise<void> {
  if (!id) return
  state.selectionReferences.value = state.selectionReferences.value.filter((s) => s.id !== id)
}

export async function clearSelectionReferences(state: ChatStoreState): Promise<void> {
  state.selectionReferences.value = []
}

