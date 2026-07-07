import type { Conversation } from '../../stores'

export type HistorySortBy = 'updated' | 'created' | 'title' | 'messages'
export type HistoryGroupBy = 'none' | 'date' | 'workspace'

export interface HistoryGroup {
  key: string
  label: string
  conversations: Conversation[]
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function getWorkspaceLabel(workspaceUri?: string | null): string {
  if (!workspaceUri) return 'No workspace'

  const normalized = safeDecode(workspaceUri).replace(/\/+$/, '')
  const lastSegment = normalized.split('/').filter(Boolean).pop()
  if (!lastSegment) return normalized

  return lastSegment.replace(/^file:/, '') || normalized
}

function getOptionalConversationField(conversation: Conversation, field: string): string {
  const value = (conversation as unknown as Record<string, unknown>)[field]
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

export function getConversationSearchText(conversation: Conversation): string {
  return [
    conversation.title,
    conversation.preview,
    conversation.workspaceUri,
    getWorkspaceLabel(conversation.workspaceUri),
    String(conversation.messageCount || ''),
    new Date(conversation.createdAt).toLocaleDateString(),
    new Date(conversation.updatedAt).toLocaleDateString(),
    getOptionalConversationField(conversation, 'model'),
    getOptionalConversationField(conversation, 'modelName'),
    getOptionalConversationField(conversation, 'configName'),
    getOptionalConversationField(conversation, 'checkpointCount'),
    getOptionalConversationField(conversation, 'hasCheckpoint')
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function matchesConversationSearch(conversation: Conversation, keyword: string): boolean {
  const normalizedKeyword = keyword.trim().toLowerCase()
  if (!normalizedKeyword) return true

  return normalizedKeyword
    .split(/\s+/)
    .every(term => getConversationSearchText(conversation).includes(term))
}

export function sortConversations(conversations: Conversation[], sortBy: HistorySortBy): Conversation[] {
  return [...conversations].sort((a, b) => {
    if (sortBy === 'created') return b.createdAt - a.createdAt
    if (sortBy === 'messages') return b.messageCount - a.messageCount
    if (sortBy === 'title') return a.title.localeCompare(b.title)
    return b.updatedAt - a.updatedAt
  })
}

export function getDateGroupKey(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const dayDiff = Math.floor((startOfToday - startOfDate) / 86400000)

  if (dayDiff === 0) return 'today'
  if (dayDiff === 1) return 'yesterday'
  if (dayDiff < 7) return 'thisWeek'
  return 'earlier'
}

export function groupConversations(
  conversations: Conversation[],
  groupBy: HistoryGroupBy,
  labels: Record<string, string>
): HistoryGroup[] {
  if (groupBy === 'none') {
    return [{ key: 'all', label: labels.all || 'All', conversations }]
  }

  const order = groupBy === 'date'
    ? ['today', 'yesterday', 'thisWeek', 'earlier']
    : []
  const groups = new Map<string, HistoryGroup>()

  for (const conversation of conversations) {
    const key = groupBy === 'date'
      ? getDateGroupKey(conversation.updatedAt)
      : conversation.workspaceUri || '__no_workspace__'
    const label = groupBy === 'workspace'
      ? getWorkspaceLabel(conversation.workspaceUri)
      : labels[key] || key
    const existing = groups.get(key)
    if (existing) {
      existing.conversations.push(conversation)
    } else {
      groups.set(key, { key, label, conversations: [conversation] })
    }
  }

  const result = Array.from(groups.values())
  if (groupBy === 'date') {
    return result.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
  }

  return result.sort((a, b) => a.label.localeCompare(b.label))
}
