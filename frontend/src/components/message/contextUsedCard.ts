import type { Message } from '../../types'

function hasFunctionCall(message: Message | undefined): boolean {
  return message?.parts?.some((part) => part.functionCall !== undefined) ?? false
}

export function isContextUsedCardCandidate(
  message: Message,
  messageIndex: number,
  allMessages: Message[]
): boolean {
  if (message.role !== 'assistant') return false
  if (message.isFunctionResponse === true) return false
  if (message.isSummary === true) return false
  if (hasFunctionCall(message)) return false

  if (!Array.isArray(allMessages) || messageIndex <= 0 || messageIndex >= allMessages.length) {
    return true
  }

  let lastUserIndex = -1
  for (let i = messageIndex - 1; i >= 0; i--) {
    const current = allMessages[i]
    if (!current || current.role !== 'user') continue
    if (current.isFunctionResponse === true) continue
    if (current.isSummary === true) continue
    lastUserIndex = i
    break
  }

  if (lastUserIndex < 0) {
    for (let i = 0; i < messageIndex; i++) {
      const current = allMessages[i]
      if (!current || current.role !== 'assistant') continue
      if (current.isFunctionResponse === true) continue
      if (current.isSummary === true) continue
      if (hasFunctionCall(current)) continue
      return false
    }
    return true
  }

  for (let i = lastUserIndex + 1; i < messageIndex; i++) {
    const current = allMessages[i]
    if (!current || current.role !== 'assistant') continue
    if (current.isFunctionResponse === true) continue
    if (current.isSummary === true) continue
    if (hasFunctionCall(current)) continue
    return false
  }

  return true
}

export function shouldShowContextUsedCard(
  message: Message,
  messageIndex: number,
  allMessages: Message[]
): boolean {
  return isContextUsedCardCandidate(message, messageIndex, allMessages) && !!message.metadata?.contextSnapshot
}

export function shouldReserveContextUsedCard(
  message: Message,
  messageIndex: number,
  allMessages: Message[]
): boolean {
  if (!isContextUsedCardCandidate(message, messageIndex, allMessages)) return false
  if (message.metadata?.contextSnapshot) return true
  return message.streaming === true
}
