import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getWorkspaceLabel,
  groupConversations,
  matchesConversationSearch,
  sortConversations,
} from '../frontend/src/components/history/historyUtils'
import type { Conversation } from '../frontend/src/stores'

function conversation(overrides: Partial<Conversation>): Conversation {
  return {
    id: overrides.id || 'conv',
    title: overrides.title || 'Untitled',
    createdAt: overrides.createdAt || Date.UTC(2026, 6, 1),
    updatedAt: overrides.updatedAt || Date.UTC(2026, 6, 1),
    messageCount: overrides.messageCount ?? 1,
    preview: overrides.preview,
    isPersisted: true,
    workspaceUri: overrides.workspaceUri,
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('historyUtils', () => {
  it('formats workspace labels from file URIs', () => {
    expect(getWorkspaceLabel('file:///home/andy/Acopilot')).toBe('Acopilot')
    expect(getWorkspaceLabel(undefined)).toBe('No workspace')
  })

  it('matches search terms across title, preview, workspace, and dates', () => {
    const item = conversation({
      title: 'Fix login',
      preview: 'Investigated auth.ts',
      workspaceUri: 'file:///home/andy/service-api',
      updatedAt: Date.UTC(2026, 6, 5),
    })

    expect(matchesConversationSearch(item, 'auth service-api')).toBe(true)
    expect(matchesConversationSearch(item, '2026')).toBe(true)
    expect(matchesConversationSearch(item, 'billing')).toBe(false)
  })

  it('sorts conversations by selected field', () => {
    const first = conversation({ id: 'a', title: 'Beta', messageCount: 2, updatedAt: 10 })
    const second = conversation({ id: 'b', title: 'Alpha', messageCount: 5, updatedAt: 20 })

    expect(sortConversations([first, second], 'updated').map(item => item.id)).toEqual(['b', 'a'])
    expect(sortConversations([first, second], 'title').map(item => item.id)).toEqual(['b', 'a'])
    expect(sortConversations([first, second], 'messages').map(item => item.id)).toEqual(['b', 'a'])
  })

  it('groups conversations by relative date and workspace', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(Date.UTC(2026, 6, 5, 12)))

    const today = conversation({ id: 'today', updatedAt: Date.UTC(2026, 6, 5), workspaceUri: 'file:///repo/a' })
    const older = conversation({ id: 'older', updatedAt: Date.UTC(2026, 5, 1), workspaceUri: 'file:///repo/b' })
    const labels = { all: 'All', today: 'Today', yesterday: 'Yesterday', thisWeek: 'This Week', earlier: 'Earlier' }

    expect(groupConversations([older, today], 'date', labels).map(group => group.key)).toEqual(['today', 'earlier'])
    expect(groupConversations([older, today], 'workspace', labels).map(group => group.label)).toEqual(['a', 'b'])
  })

  it('keeps workspaces with the same folder name in separate groups', () => {
    const first = conversation({ id: 'first', workspaceUri: 'file:///home/andy/repo' })
    const second = conversation({ id: 'second', workspaceUri: 'file:///tmp/repo' })
    const groups = groupConversations([first, second], 'workspace', { all: 'All' })

    expect(groups).toHaveLength(2)
    expect(groups.map(group => group.key)).toEqual(['file:///home/andy/repo', 'file:///tmp/repo'])
    expect(groups.map(group => group.label)).toEqual(['repo', 'repo'])
  })
})
