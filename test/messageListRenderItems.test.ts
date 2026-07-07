import { describe, expect, it } from 'vitest'
import { buildMessageListRenderItems } from '../frontend/src/components/message/messageListRenderItems'
import type { Message } from '../frontend/src/types'

function message(id: string, role: Message['role'] = 'user', extra: Partial<Message> = {}): Message {
  return {
    id,
    role,
    content: id,
    timestamp: 1,
    ...extra,
  }
}

describe('message list render items', () => {
  it('keeps the latest summary visible even when it is outside the paged slice', () => {
    const messages: Message[] = [
      message('summary', 'user', { isSummary: true }),
      ...Array.from({ length: 50 }, (_, index) => message(`m${index}`, index % 2 === 0 ? 'user' : 'assistant')),
    ]

    const items = buildMessageListRenderItems({
      messages,
      visibleCount: 40,
      allMessages: messages,
      checkpoints: [],
      getToolResponseById: () => null,
    })

    expect(items[items.length - 1]).toMatchObject({
      kind: 'message',
      message: expect.objectContaining({ id: 'summary', isSummary: true }),
      actualIndex: 0,
    })
  })
})
