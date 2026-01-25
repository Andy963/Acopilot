import { describe, expect, it } from 'vitest'

import type { Message } from '../frontend/src/types'
import { handleToolIteration } from '../frontend/src/stores/chat/streamChunkHandlers'

describe('handleToolIteration', () => {
  it('appends a new assistant placeholder after functionResponse', () => {
    const initialAssistant: Message = {
      id: 'assistant-1',
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      streaming: true,
      metadata: { modelVersion: 'gpt-4o-2024-08-06' },
      parts: [
        {
          functionCall: {
            id: 'tool-1',
            name: 'write_file',
            args: { files: [{ path: 'foo.txt', content: 'bar' }] },
          },
        },
      ],
      tools: [
        {
          id: 'tool-1',
          name: 'write_file',
          args: { files: [{ path: 'foo.txt', content: 'bar' }] },
          status: 'running',
        },
      ],
    }

    const state: any = {
      allMessages: { value: [initialAssistant] },
      streamingMessageId: { value: initialAssistant.id },
      isStreaming: { value: true },
      isWaitingForResponse: { value: true },
      postEditValidationPending: { value: false },
    }

    const chunk: any = {
      content: {
        role: 'model',
        parts: initialAssistant.parts,
        modelVersion: 'gpt-4o-2024-08-06',
      },
      toolResults: [
        {
          id: 'tool-1',
          name: 'write_file',
          result: { success: true, data: { results: [{ success: true, action: 'modified', status: 'accepted' }] } },
        },
      ],
      checkpoints: [],
    }

    handleToolIteration(chunk, state, () => 'fallback-model', () => {})

    const messages = state.allMessages.value as Message[]
    expect(messages).toHaveLength(3)
    expect(messages[1].isFunctionResponse).toBe(true)
    expect(messages[2].role).toBe('assistant')
    expect(messages[2].streaming).toBe(true)
    expect(messages[2].metadata?.modelVersion).toBe('gpt-4o-2024-08-06')
    expect(state.streamingMessageId.value).toBe(messages[2].id)
    expect(state.isStreaming.value).toBe(true)
    expect(state.isWaitingForResponse.value).toBe(true)
  })
})

