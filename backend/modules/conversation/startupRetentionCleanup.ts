export async function runStartupRetentionCleanup(params: {
  enabled: boolean
  retentionDays: number
  nowMs: number
  cleanupExpiredConversations: () => Promise<{ deletedConversations: number; deletedSnapshots: number }>
}): Promise<void> {
  const { enabled, cleanupExpiredConversations } = params

  if (!enabled) {
    return
  }

  await cleanupExpiredConversations()
}
