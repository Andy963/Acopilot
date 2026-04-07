import { describe, expect, it } from 'vitest'

import { mergeMessageMetadata } from '../frontend/src/stores/chat/streamChunkHandlers'

const SNAPSHOT = {
  generatedAt: 1,
  conversationId: 'conv',
  configId: 'cfg',
  providerType: 'openai',
  model: 'gpt-test'
} as any

describe('mergeMessageMetadata', () => {
  it('returns incoming when existing is undefined', () => {
    const incoming = { modelVersion: 'v1' }
    expect(mergeMessageMetadata(undefined, incoming)).toEqual(incoming)
  })

  it('returns a copy of existing when incoming is undefined', () => {
    const existing = { modelVersion: 'v1', contextSnapshot: SNAPSHOT }
    const result = mergeMessageMetadata(existing, undefined)
    expect(result).toEqual(existing)
    expect(result).not.toBe(existing)
  })

  it('returns empty object when both are undefined', () => {
    expect(mergeMessageMetadata(undefined, undefined)).toEqual({})
  })

  it('preserves contextSnapshot from existing when incoming has none', () => {
    const existing = { modelVersion: 'v1', contextSnapshot: SNAPSHOT }
    const incoming = { modelVersion: 'v2', thinkingDuration: 100 }
    const result = mergeMessageMetadata(existing, incoming)
    expect(result.contextSnapshot).toBe(SNAPSHOT)
    expect(result.modelVersion).toBe('v2')
    expect(result.thinkingDuration).toBe(100)
  })

  it('preserves contextSnapshot from existing when incoming has explicit undefined', () => {
    const existing = { modelVersion: 'v1', contextSnapshot: SNAPSHOT }
    const incoming = { modelVersion: 'v2', contextSnapshot: undefined }
    const result = mergeMessageMetadata(existing, incoming)
    expect(result.contextSnapshot).toBe(SNAPSHOT)
  })

  it('uses incoming contextSnapshot when it is provided', () => {
    const newSnapshot = { ...SNAPSHOT, generatedAt: 2 }
    const existing = { modelVersion: 'v1', contextSnapshot: SNAPSHOT }
    const incoming = { modelVersion: 'v2', contextSnapshot: newSnapshot }
    const result = mergeMessageMetadata(existing, incoming)
    expect(result.contextSnapshot).toBe(newSnapshot)
  })

  it('incoming values override existing for non-contextSnapshot fields', () => {
    const existing = { modelVersion: 'v1', thinkingDuration: 50 }
    const incoming = { modelVersion: 'v2', thinkingDuration: 100, responseDuration: 200 }
    const result = mergeMessageMetadata(existing, incoming)
    expect(result.modelVersion).toBe('v2')
    expect(result.thinkingDuration).toBe(100)
    expect(result.responseDuration).toBe(200)
  })
})
