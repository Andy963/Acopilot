import { describe, expect, it } from 'vitest'

import { runStartupRetentionCleanup } from '../backend/modules/conversation/startupRetentionCleanup'

describe('runStartupRetentionCleanup', () => {
  it('does nothing when disabled', async () => {
    let called = 0

    await runStartupRetentionCleanup({
      enabled: false,
      retentionDays: 30,
      nowMs: 123,
      cleanupExpiredConversations: async () => {
        called++
        return { deletedConversations: 0, deletedSnapshots: 0 }
      },
    })

    expect(called).toBe(0)
  })

  it('runs cleanup when enabled', async () => {
    let called = 0

    await runStartupRetentionCleanup({
      enabled: true,
      retentionDays: 30,
      nowMs: 123,
      cleanupExpiredConversations: async () => {
        called++
        return { deletedConversations: 1, deletedSnapshots: 2 }
      },
    })

    expect(called).toBe(1)
  })
})
