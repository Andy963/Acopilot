import type { ContextInspectorData, Message } from '../../types'

/**
 * Check whether this assistant message is the "first real text reply"
 * after the most recent user message, i.e. the one that should carry
 * the Context-Used card.
 *
 * Rules
 * - Only assistant messages qualify.
 * - Skip function-response and summary messages.
 * - Skip messages that consist solely of function-calls (tool-use turns).
 * - Among the remaining candidates, only the first one after the last
 *   real user message gets the card.
 */
export function isContextUsedCardCandidate(
  message: Message,
  messageIndex: number,
  allMessages: Message[]
): boolean {
  if (message.role !== 'assistant') return false
  if (message.isFunctionResponse === true) return false
  if (message.isSummary === true) return false

  if (!Array.isArray(allMessages) || messageIndex <= 0 || messageIndex >= allMessages.length) {
    return true
  }

  // Find the last real user message before this one.
  let lastUserIndex = -1
  for (let i = messageIndex - 1; i >= 0; i--) {
    const current = allMessages[i]
    if (!current || current.role !== 'user') continue
    if (current.isFunctionResponse === true) continue
    if (current.isSummary === true) continue
    lastUserIndex = i
    break
  }

  const searchStart = lastUserIndex >= 0 ? lastUserIndex + 1 : 0

  // If there is already a candidate assistant message between
  // searchStart and this message, this one is NOT the first → false.
  for (let i = searchStart; i < messageIndex; i++) {
    const current = allMessages[i]
    if (!current || current.role !== 'assistant') continue
    if (current.isFunctionResponse === true) continue
    if (current.isSummary === true) continue
    // Tool-only turns are not candidates; skip them.
    if (isToolOnlyMessage(current)) continue
    return false
  }

  return true
}

/**
 * A message is "tool-only" when every part is a function call (no text content).
 */
function isToolOnlyMessage(message: Message): boolean {
  const parts = message.parts
  if (!parts || parts.length === 0) return false
  return parts.every((p) => p.functionCall !== undefined)
}

export function shouldRenderContextUsedCard(
  snapshot: ContextInspectorData | null | undefined,
  loading?: boolean
): boolean {
  return loading === true || !!snapshot
}

export function shouldShowContextUsedCard(
  message: Message,
  messageIndex: number,
  allMessages: Message[]
): boolean {
  if (!isContextUsedCardCandidate(message, messageIndex, allMessages)) {
    // Even non-candidate messages should show the card if they
    // already carry a contextSnapshot (e.g. the first tool-call turn
    // that received the early contextInfo chunk).
    return !!message.metadata?.contextSnapshot
  }
  return !!message.metadata?.contextSnapshot
}

export function shouldReserveContextUsedCard(
  message: Message,
  messageIndex: number,
  allMessages: Message[]
): boolean {
  // Always reserve space when snapshot is present.
  if (message.metadata?.contextSnapshot) return true
  // During streaming, reserve space for the candidate so the card
  // placeholder is visible before the contextInfo chunk arrives.
  if (isContextUsedCardCandidate(message, messageIndex, allMessages)) {
    return message.streaming === true
  }
  return false
}
