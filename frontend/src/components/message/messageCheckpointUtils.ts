import type { CheckpointRecord } from '../../types'
import { formatTime } from '../../utils/format'

export type MessageCheckpointPhase = 'before' | 'after'

type Translate = (key: string, params?: Record<string, unknown>) => string

export function shouldMergeCheckpointForTool(
  checkpoints: CheckpointRecord[],
  mergeUnchangedCheckpoints: boolean,
  messageIndex: number,
  toolName: string
): boolean {
  if (!mergeUnchangedCheckpoints) {
    return false
  }

  const beforeCp = checkpoints.find(
    (cp) => cp.messageIndex === messageIndex && cp.phase === 'before' && cp.toolName === toolName
  )
  const afterCp = checkpoints.find(
    (cp) => cp.messageIndex === messageIndex && cp.phase === 'after' && cp.toolName === toolName
  )

  if (!beforeCp || !afterCp) return false

  return Boolean(beforeCp.contentHash && afterCp.contentHash && beforeCp.contentHash === afterCp.contentHash)
}

export function getCheckpointLabel(t: Translate, cp: CheckpointRecord, phase: MessageCheckpointPhase): string {
  if (cp.toolName === 'user_message') {
    return phase === 'before'
      ? t('components.message.checkpoint.userMessageBefore')
      : t('components.message.checkpoint.userMessageAfter')
  }
  if (cp.toolName === 'model_message') {
    return phase === 'before'
      ? t('components.message.checkpoint.assistantMessageBefore')
      : t('components.message.checkpoint.assistantMessageAfter')
  }
  if (cp.toolName === 'tool_batch') {
    return phase === 'before'
      ? t('components.message.checkpoint.toolBatchBefore')
      : t('components.message.checkpoint.toolBatchAfter')
  }
  return phase === 'before'
    ? t('components.message.checkpoint.toolBatchBefore')
    : t('components.message.checkpoint.toolBatchAfter')
}

export function getMergedLabel(t: Translate, cp: CheckpointRecord): string {
  if (cp.toolName === 'user_message') {
    return t('components.message.checkpoint.userMessageUnchanged')
  }
  if (cp.toolName === 'model_message') {
    return t('components.message.checkpoint.assistantMessageUnchanged')
  }
  if (cp.toolName === 'tool_batch') {
    return t('components.message.checkpoint.toolBatchUnchanged')
  }
  return t('components.message.checkpoint.toolExecutionUnchanged')
}

export function formatCheckpointTime(t: Translate, timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  const isToday = date.toDateString() === now.toDateString()
  const timeStr = formatTime(timestamp, 'HH:mm:ss')

  if (isToday) {
    return timeStr
  }

  const daysDiff = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (daysDiff === 1) {
    return `${t('components.message.checkpoint.yesterday')} ${timeStr}`
  }

  if (daysDiff < 7) {
    return `${t('components.message.checkpoint.daysAgo', { days: daysDiff })} ${timeStr}`
  }

  return formatTime(timestamp, 'YYYY-MM-DD HH:mm:ss')
}
