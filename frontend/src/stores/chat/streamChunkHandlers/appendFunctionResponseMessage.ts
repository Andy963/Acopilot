import type { Message } from '../../../types'
import { generateId } from '../../../utils/format'
import type { ChatStoreState } from '../types'

export function appendFunctionResponseMessage(
  state: ChatStoreState,
  toolResults: Array<{ id: string; name: string; result: any }> | undefined
): void {
  if (!toolResults || toolResults.length === 0) return

  const responseMessage: Message = {
    id: generateId(),
    role: 'user',
    content: '',
    timestamp: Date.now(),
    isFunctionResponse: true,
    parts: toolResults.map(r => ({
      functionResponse: {
        name: r.name,
        response: r.result,
        id: r.id
      }
    }))
  }

  state.allMessages.value.push(responseMessage)
}

