const DAY_MS = 24 * 60 * 60 * 1000

export async function cleanupExpiredConversations(params: {
  nowMs: number
  retentionDays: number
  listConversationIds: () => Promise<string[]>
  getConversationMetadata: (conversationId: string) => Promise<{ createdAt?: number; updatedAt?: number } | null>
  listSnapshotIds: (conversationId: string) => Promise<string[]>
  deleteSnapshot: (snapshotId: string) => Promise<void>
  deleteAllCheckpoints: (conversationId: string) => Promise<void>
  deleteConversationDiffs: (conversationId: string) => Promise<void>
  deleteConversation: (conversationId: string) => Promise<void>
}): Promise<{
  deletedConversations: number
  deletedSnapshots: number
}> {
  const {
    nowMs,
    retentionDays,
    listConversationIds,
    getConversationMetadata,
    listSnapshotIds,
    deleteSnapshot,
    deleteAllCheckpoints,
    deleteConversationDiffs,
    deleteConversation,
  } = params

  if (!Number.isFinite(nowMs)) {
    throw new Error('nowMs must be a finite number')
  }
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
    throw new Error('retentionDays must be a positive number')
  }

  const cutoffMs = nowMs - retentionDays * DAY_MS

  const conversationIds = await listConversationIds()

  let deletedConversations = 0
  let deletedSnapshots = 0

  for (const conversationId of conversationIds) {
    let metadata: { createdAt?: number; updatedAt?: number } | null = null

    try {
      metadata = await getConversationMetadata(conversationId)
    } catch {
      continue
    }

    const lastActivity = metadata?.updatedAt ?? metadata?.createdAt
    if (!Number.isFinite(lastActivity)) {
      continue
    }

    if (lastActivity >= cutoffMs) {
      continue
    }

    try {
      await deleteAllCheckpoints(conversationId)
    } catch {
      // best-effort cleanup
    }

    try {
      await deleteConversationDiffs(conversationId)
    } catch {
      // best-effort cleanup
    }

    try {
      const snapshotIds = await listSnapshotIds(conversationId)
      for (const snapshotId of snapshotIds) {
        try {
          await deleteSnapshot(snapshotId)
          deletedSnapshots++
        } catch {
          // best-effort cleanup
        }
      }
    } catch {
      // best-effort cleanup
    }

    try {
      await deleteConversation(conversationId)
      deletedConversations++
    } catch {
      // best-effort cleanup
    }
  }

  return { deletedConversations, deletedSnapshots }
}
