import { describe, expect, it } from 'vitest'

import type { Message } from '../frontend/src/types'
import {
  isContextUsedCardCandidate,
  shouldRenderContextUsedCard,
  shouldReserveContextUsedCard,
  shouldShowContextUsedCard
} from '../frontend/src/components/message/contextUsedCard'

function createMessage(overrides: Partial<Message>): Message {
  return {
    id: overrides.id || 'message-id',
    role: overrides.role || 'assistant',
    content: overrides.content || '',
    timestamp: overrides.timestamp || Date.now(),
    metadata: overrides.metadata,
    streaming: overrides.streaming,
    parts: overrides.parts,
    attachments: overrides.attachments,
    tools: overrides.tools,
    isFunctionResponse: overrides.isFunctionResponse,
    isSummary: overrides.isSummary,
    summarizedMessageCount: overrides.summarizedMessageCount
  }
}

describe('context used card visibility', () => {
  it('reserves space for the first streaming assistant reply before snapshot arrives', () => {
    const messages = [
      createMessage({ id: 'user-1', role: 'user', content: 'hello' }),
      createMessage({ id: 'assistant-1', streaming: true })
    ]

    expect(isContextUsedCardCandidate(messages[1], 1, messages)).toBe(true)
    expect(shouldReserveContextUsedCard(messages[1], 1, messages)).toBe(true)
    expect(shouldShowContextUsedCard(messages[1], 1, messages)).toBe(false)
  })

  it('shows the card once the snapshot is available', () => {
    const messages = [
      createMessage({ id: 'user-1', role: 'user', content: 'hello' }),
      createMessage({
        id: 'assistant-1',
        metadata: {
          contextSnapshot: {
            generatedAt: 1,
            conversationId: 'conv',
            configId: 'cfg',
            providerType: 'openai',
            model: 'gpt-test'
          } as any
        }
      })
    ]

    expect(shouldReserveContextUsedCard(messages[1], 1, messages)).toBe(true)
    expect(shouldShowContextUsedCard(messages[1], 1, messages)).toBe(true)
  })

  it('does not reserve space for later assistant messages in the same turn', () => {
    const messages = [
      createMessage({ id: 'user-1', role: 'user', content: 'hello' }),
      createMessage({ id: 'assistant-1', content: 'first reply' }),
      createMessage({ id: 'assistant-2', streaming: true })
    ]

    expect(isContextUsedCardCandidate(messages[2], 2, messages)).toBe(false)
    expect(shouldReserveContextUsedCard(messages[2], 2, messages)).toBe(false)
  })

  it('shows the card for tool-only messages when contextSnapshot is present', () => {
    const messages = [
      createMessage({ id: 'user-1', role: 'user', content: 'hello' }),
      createMessage({
        id: 'assistant-1',
        streaming: true,
        parts: [{ functionCall: { name: 'read_file', args: {} } }],
        metadata: {
          contextSnapshot: {
            generatedAt: 1,
            conversationId: 'conv',
            configId: 'cfg',
            providerType: 'openai',
            model: 'gpt-test'
          } as any
        }
      })
    ]

    // Tool-only messages are not candidates, but should still show
    // the card when they carry a contextSnapshot.
    expect(shouldReserveContextUsedCard(messages[1], 1, messages)).toBe(true)
    expect(shouldShowContextUsedCard(messages[1], 1, messages)).toBe(true)
  })

  it('keeps rendering once a context snapshot exists even without injected references', () => {
    expect(
      shouldRenderContextUsedCard({
        generatedAt: 1,
        conversationId: 'conv',
        configId: 'cfg',
        providerType: 'openai',
        model: 'gpt-test'
      } as any, false)
    ).toBe(true)
  })
})
