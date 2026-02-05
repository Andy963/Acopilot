import { describe, expect, it } from 'vitest'

import { cleanupExpiredConversations } from '../backend/modules/conversation/cleanupExpiredConversations'

describe('cleanupExpiredConversations', () => {
  it('deletes conversations older than retentionDays with checkpoints, diffs, and snapshots', async () => {
    const nowMs = Date.UTC(2026, 0, 31, 0, 0, 0)
    const retentionDays = 30

    const deleted: string[] = []
    const deletedSnapshots: string[] = []
    const deletedCheckpoints: string[] = []
    const deletedDiffs: string[] = []

    await cleanupExpiredConversations({
      nowMs,
      retentionDays,
      listConversationIds: async () => ['old', 'new'],
      getConversationMetadata: async (conversationId) => {
        if (conversationId === 'old') {
          return { createdAt: nowMs - 60 * 86400_000, updatedAt: nowMs - 31 * 86400_000 }
        }
        return { createdAt: nowMs - 10 * 86400_000, updatedAt: nowMs - 2 * 86400_000 }
      },
      listSnapshotIds: async (conversationId) => {
        if (conversationId === 'old') return ['snapshot_1', 'snapshot_2']
        return []
      },
      deleteSnapshot: async (snapshotId) => {
        deletedSnapshots.push(snapshotId)
      },
      deleteAllCheckpoints: async (conversationId) => {
        deletedCheckpoints.push(conversationId)
      },
      deleteConversationDiffs: async (conversationId) => {
        deletedDiffs.push(conversationId)
      },
      deleteConversation: async (conversationId) => {
        deleted.push(conversationId)
      },
    })

    expect(deleted).toEqual(['old'])
    expect(deletedCheckpoints).toEqual(['old'])
    expect(deletedDiffs).toEqual(['old'])
    expect(deletedSnapshots.sort()).toEqual(['snapshot_1', 'snapshot_2'])
  })

  it('skips conversations without metadata timestamps', async () => {
    const nowMs = Date.UTC(2026, 0, 31, 0, 0, 0)

    const deleted: string[] = []

    await cleanupExpiredConversations({
      nowMs,
      retentionDays: 30,
      listConversationIds: async () => ['unknown'],
      getConversationMetadata: async () => ({ createdAt: undefined, updatedAt: undefined }),
      listSnapshotIds: async () => [],
      deleteSnapshot: async () => {},
      deleteAllCheckpoints: async () => {},
      deleteConversationDiffs: async () => {},
      deleteConversation: async (conversationId) => {
        deleted.push(conversationId)
      },
    })

    expect(deleted).toEqual([])
  })
})
