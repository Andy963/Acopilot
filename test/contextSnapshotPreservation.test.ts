import { describe, expect, it } from 'vitest'

import type { Message } from '../frontend/src/types'
import {
  handleContextInfo,
  handleComplete,
  handleToolIteration,
  handleToolsExecuting,
  handleAwaitingConfirmation
} from '../frontend/src/stores/chat/streamChunkHandlers'

const SNAPSHOT = {
  generatedAt: 1,
  conversationId: 'conv',
  configId: 'cfg',
  providerType: 'openai',
  model: 'gpt-test',
  injected: { pinnedFiles: { files: [{ id: '1', path: 'a.ts', included: true }], totalEnabled: 1, included: 1 } }
} as any

function makeState(messages: Message[], streamingId: string | null = null): any {
  return {
    allMessages: { value: messages },
    streamingMessageId: { value: streamingId },
    isStreaming: { value: !!streamingId },
    isWaitingForResponse: { value: !!streamingId },
    postEditValidationPending: { value: false },
    toolCallBuffer: { value: null }
  }
}

function makeContent(overrides: Record<string, any> = {}): any {
  return {
    role: 'model',
    parts: [{ text: 'hello' }],
    modelVersion: 'gpt-test',
    ...overrides
  }
}

describe('contextSnapshot preserved across chunk handlers', () => {
  it('handleComplete preserves snapshot written by handleContextInfo', () => {
    const msg: Message = {
      id: 'a1',
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      streaming: true,
      metadata: {}
    }
    const state = makeState([msg], 'a1')

    // Simulate contextInfo chunk arriving during streaming
    handleContextInfo({ type: 'contextInfo', conversationId: 'c', contextSnapshot: SNAPSHOT } as any, state)
    expect(state.allMessages.value[0].metadata?.contextSnapshot).toBe(SNAPSHOT)

    // Simulate complete chunk WITHOUT contextSnapshot in content
    handleComplete(
      { type: 'complete', conversationId: 'c', content: makeContent() } as any,
      state,
      () => {},
      async () => {}
    )

    const final = state.allMessages.value[0]
    expect(final.streaming).toBe(false)
    expect(final.metadata?.contextSnapshot).toBe(SNAPSHOT)
  })

  it('handleComplete uses content contextSnapshot when both exist', () => {
    const newSnapshot = { ...SNAPSHOT, generatedAt: 99 }
    const msg: Message = {
      id: 'a1',
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      streaming: true,
      metadata: { contextSnapshot: SNAPSHOT }
    }
    const state = makeState([msg], 'a1')

    handleComplete(
      { type: 'complete', conversationId: 'c', content: makeContent({ contextSnapshot: newSnapshot }) } as any,
      state,
      () => {},
      async () => {}
    )

    const final = state.allMessages.value[0]
    expect(final.metadata?.contextSnapshot).toBe(newSnapshot)
  })

  it('handleToolsExecuting preserves snapshot', () => {
    const msg: Message = {
      id: 'a1',
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      streaming: true,
      metadata: { contextSnapshot: SNAPSHOT },
      tools: [{ id: 't1', name: 'read_file', args: {}, status: 'running' as const }]
    }
    const state = makeState([msg], 'a1')

    handleToolsExecuting(
      {
        type: 'toolsExecuting',
        conversationId: 'c',
        content: makeContent({ parts: [{ functionCall: { id: 't1', name: 'read_file', args: {} } }] }),
        pendingToolCalls: [{ id: 't1', name: 'read_file', args: {} }],
        toolsExecuting: true
      } as any,
      state
    )

    const final = state.allMessages.value[0]
    expect(final.metadata?.contextSnapshot).toBe(SNAPSHOT)
  })

  it('handleAwaitingConfirmation preserves snapshot', () => {
    const msg: Message = {
      id: 'a1',
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      streaming: true,
      metadata: { contextSnapshot: SNAPSHOT }
    }
    const state = makeState([msg], 'a1')

    handleAwaitingConfirmation(
      {
        type: 'awaitingConfirmation',
        conversationId: 'c',
        content: makeContent(),
        pendingToolCalls: []
      } as any,
      state
    )

    const final = state.allMessages.value[0]
    expect(final.metadata?.contextSnapshot).toBe(SNAPSHOT)
  })

  it('handleToolIteration preserves snapshot on finalized message', () => {
    const msg: Message = {
      id: 'a1',
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      streaming: true,
      metadata: { modelVersion: 'gpt-test', contextSnapshot: SNAPSHOT },
      parts: [{ functionCall: { id: 't1', name: 'write_file', args: {} } }],
      tools: [{ id: 't1', name: 'write_file', args: {}, status: 'running' as const }]
    }
    const state = makeState([msg], 'a1')

    handleToolIteration(
      {
        content: {
          role: 'model',
          parts: msg.parts,
          modelVersion: 'gpt-test'
        },
        toolResults: [{ id: 't1', name: 'write_file', result: { success: true } }],
        checkpoints: []
      } as any,
      state,
      () => 'gpt-test',
      () => {}
    )

    // First message (finalized) should keep contextSnapshot
    expect(state.allMessages.value[0].metadata?.contextSnapshot).toBe(SNAPSHOT)
  })
})
