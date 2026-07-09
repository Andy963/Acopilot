import { computed, ref } from 'vue'
import { useI18n } from '../../i18n'
import { useChatStore } from '../../stores'
import type { Attachment, CheckpointRecord } from '../../types'
import {
  formatCheckpointTime,
  getCheckpointLabel,
  getMergedLabel,
  shouldMergeCheckpointForTool,
  type MessageCheckpointPhase
} from './messageCheckpointUtils'

export function useMessageListActions(emit: (...args: any[]) => void) {
  const { t } = useI18n()
  const chatStore = useChatStore()

  const showDeleteConfirm = ref(false)
  const pendingDeleteMessageId = ref<string | null>(null)

  const showRestoreConfirm = ref(false)
  const pendingCheckpoint = ref<CheckpointRecord | null>(null)

  const recentCheckpoint = computed<CheckpointRecord | null>(() => {
    if (chatStore.checkpoints.length === 0) return null
    return [...chatStore.checkpoints].sort((a, b) => b.timestamp - a.timestamp)[0] || null
  })

  function findMessageIndex(messageId: string | null): number {
    if (!messageId) return -1
    return chatStore.allMessages.findIndex((message) => message.id === messageId)
  }

  const deleteCount = computed(() => {
    const index = findMessageIndex(pendingDeleteMessageId.value)
    if (index === -1) return 0
    return chatStore.allMessages.length - index
  })

  const deleteCheckpoints = computed<CheckpointRecord[]>(() => {
    const messageIndex = findMessageIndex(pendingDeleteMessageId.value)
    if (messageIndex === -1) return []

    return chatStore.checkpoints.filter((cp) => cp.messageIndex <= messageIndex && cp.phase === 'before')
  })

  function handleEdit(messageId: string, newContent: string, attachments: Attachment[]) {
    emit('edit', messageId, newContent, attachments)
  }

  function handleDelete(messageId: string) {
    pendingDeleteMessageId.value = messageId
    showDeleteConfirm.value = true
  }

  function confirmDelete() {
    const messageIndex = findMessageIndex(pendingDeleteMessageId.value)
    if (messageIndex !== -1) {
      chatStore.deleteMessage(messageIndex)
    }
    pendingDeleteMessageId.value = null
  }

  function cancelDelete() {
    pendingDeleteMessageId.value = null
  }

  async function handleRestoreAndDelete(checkpointId: string) {
    const messageIndex = findMessageIndex(pendingDeleteMessageId.value)
    if (messageIndex === -1) return

    await chatStore.restoreAndDelete(messageIndex, checkpointId)
    pendingDeleteMessageId.value = null
  }

  function handleRetry(messageId: string) {
    const messageIndex = findMessageIndex(messageId)
    if (messageIndex !== -1) {
      chatStore.retryFromMessage(messageIndex)
    }
  }

  function handleCopy(content: string) {
    emit('copy', content)
  }

  function handleErrorRetry() {
    chatStore.retryAfterError()
  }

  async function handleContinue() {
    const plan = chatStore.planRunner
    const step =
      plan && plan.currentStepIndex >= 0 && plan.currentStepIndex < plan.steps.length ? plan.steps[plan.currentStepIndex] : null

    const canContinuePlan =
      !!plan &&
      plan.status === 'paused' &&
      step?.status === 'error' &&
      (step?.errorCode === 'NEEDS_CONTINUE' || step?.errorCode === 'MAX_TOOL_ITERATIONS')

    if (canContinuePlan) {
      await chatStore.continuePlanRunner()
      return
    }

    await chatStore.continueAfterToolExecution()
  }

  function restoreCheckpoint(checkpoint: CheckpointRecord) {
    pendingCheckpoint.value = checkpoint
    showRestoreConfirm.value = true
  }

  function handleRestoreCheckpoint(checkpointId: string) {
    const checkpoint = chatStore.checkpoints.find((cp) => cp.id === checkpointId)
    if (checkpoint) {
      restoreCheckpoint(checkpoint)
    }
  }

  async function handleRestoreAndRetry(messageId: string, checkpointId: string) {
    const messageIndex = findMessageIndex(messageId)
    if (messageIndex === -1) return
    await chatStore.restoreAndRetry(messageIndex, checkpointId)
  }

  async function handleRestoreAndEdit(
    messageId: string,
    newContent: string,
    attachments: Attachment[],
    checkpointId: string
  ) {
    const messageIndex = findMessageIndex(messageId)
    if (messageIndex === -1) return
    await chatStore.restoreAndEdit(messageIndex, newContent, attachments, checkpointId)
  }

  async function confirmRestore() {
    if (!pendingCheckpoint.value) return

    await chatStore.restoreCheckpoint(pendingCheckpoint.value.id)
    pendingCheckpoint.value = null
  }

  function shouldMergeForTool(messageIndex: number, toolName: string): boolean {
    return shouldMergeCheckpointForTool(chatStore.checkpoints, chatStore.mergeUnchangedCheckpoints, messageIndex, toolName)
  }

  function getCheckpointLabelForPhase(cp: CheckpointRecord, phase: MessageCheckpointPhase): string {
    return getCheckpointLabel(t, cp, phase)
  }

  function getMergedLabelForCheckpoint(cp: CheckpointRecord): string {
    return getMergedLabel(t, cp)
  }

  function formatCheckpointTimestamp(timestamp: number): string {
    return formatCheckpointTime(t, timestamp)
  }

  return {
    t,
    showDeleteConfirm,
    deleteCheckpoints,
    deleteCount,
    confirmDelete,
    handleRestoreAndDelete,
    cancelDelete,
    showRestoreConfirm,
    recentCheckpoint,
    confirmRestore,
    handleEdit,
    handleDelete,
    handleRetry,
    handleCopy,
    handleRestoreCheckpoint,
    handleRestoreAndRetry,
    handleRestoreAndEdit,
    handleContinue,
    handleErrorRetry,
    shouldMergeForTool,
    restoreCheckpoint,
    getCheckpointLabel: getCheckpointLabelForPhase,
    getMergedLabel: getMergedLabelForCheckpoint,
    formatCheckpointTime: formatCheckpointTimestamp
  }
}
