import type { Message } from '../types'

export const DEFAULT_CONVERSATION_TITLE_MAX_LEN = 30

function normalizeTitleCandidate(raw: string): string {
  const input = String(raw || '')

  // Basic cleanup to keep title single-line and predictable.
  const cleaned = input
    .replace(/\r\n/g, '\n')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[#>*-]+\s*/, '')
    .trim()

  return cleaned
}

function truncateByCodePoints(text: string, maxLen: number, ellipsis = '…'): string {
  const chars = [...text]
  if (chars.length <= maxLen) return text
  return chars.slice(0, maxLen).join('') + ellipsis
}

export function generateConversationTitleFromText(
  rawText: string,
  maxLen = DEFAULT_CONVERSATION_TITLE_MAX_LEN
): string {
  const candidate = normalizeTitleCandidate(rawText)
  if (!candidate) return ''
  return truncateByCodePoints(candidate, maxLen)
}

export function generateConversationTitleFromMessages(
  messages: Message[],
  maxLen = DEFAULT_CONVERSATION_TITLE_MAX_LEN
): string {
  for (const message of messages) {
    if (message.role !== 'user') continue
    const title = generateConversationTitleFromText(message.content, maxLen)
    if (title) return title
  }
  return ''
}

