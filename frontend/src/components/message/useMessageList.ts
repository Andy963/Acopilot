import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useChatStore } from '../../stores'
import { useI18n } from '../../i18n'
import type { Attachment, CheckpointRecord, Message } from '../../types'
import { formatTime } from '../../utils/format'
import { buildMessageListRenderItems, type RenderItem } from './messageListRenderItems'

interface ScrollbarHandle {
  getContainer: () => HTMLElement | null
  scrollToBottom: () => void
}

const VISIBLE_INCREMENT = 40

export function useMessageList(
  props: { messages: Message[] },
  emit: (e: string, ...args: any[]) => void
) {
  const { t } = useI18n()
  const chatStore = useChatStore()

  const visibleCount = ref(VISIBLE_INCREMENT)
  const hasMore = computed(() => props.messages.length > visibleCount.value)

  const renderItems = computed<RenderItem[]>(() => {
    return buildMessageListRenderItems({
      messages: props.messages,
      visibleCount: visibleCount.value,
      allMessages: chatStore.allMessages,
      checkpoints: chatStore.checkpoints,
      getToolResponseById: (toolId) => (chatStore.getToolResponseById(toolId) as Record<string, unknown> | null)
    })
  })

  const errorCopied = ref(false)

  async function copyErrorDetails() {
    const err = chatStore.error
    if (!err) return

    const parts: string[] = []
    if (err.code) parts.push(String(err.code))
    if (err.message) parts.push(String(err.message))

    let text = parts.join(': ')
    if (err.details !== undefined) {
      try {
        text += `\\n\\n${JSON.stringify(err.details, null, 2)}`
      } catch {
        text += `\\n\\n${String(err.details)}`
      }
    }

    try {
      await navigator.clipboard.writeText(text)
      errorCopied.value = true
      window.setTimeout(() => {
        errorCopied.value = false
      }, 1200)
    } catch (e) {
      console.warn('Failed to copy error:', e)
    }
  }

  const scrollbarRef = ref<ScrollbarHandle | null>(null)
  const needsScrollToBottom = ref(false)
  let resizeObserver: ResizeObserver | null = null

  const isLoadingMore = ref(false)

  function loadMore() {
    if (isLoadingMore.value || !hasMore.value) return
    if (!scrollbarRef.value) return
    const container = scrollbarRef.value.getContainer()
    if (!container) return

    isLoadingMore.value = true
    const oldScrollHeight = container.scrollHeight
    const oldScrollTop = container.scrollTop

    visibleCount.value += VISIBLE_INCREMENT

    nextTick(() => {
      const newScrollHeight = container.scrollHeight
      container.scrollTop = oldScrollTop + (newScrollHeight - oldScrollHeight)
      isLoadingMore.value = false
    })
  }

  function handleScroll(e: Event) {
    const container = e.target as HTMLElement
    if (!container) return
    if (hasMore.value && !isLoadingMore.value && container.scrollTop < 100) {
      loadMore()
    }
  }

  watch(
    () => chatStore.currentConversationId,
    (newId, oldId) => {
      if (newId !== oldId) {
        needsScrollToBottom.value = true
        visibleCount.value = VISIBLE_INCREMENT
      }
    }
  )

  watch(
    () => props.messages,
    (newMessages) => {
      if (needsScrollToBottom.value && newMessages.length > 0) {
        tryScrollToBottom()
      }
    },
    { deep: false }
  )

  function tryScrollToBottom() {
    if (!scrollbarRef.value) return

    const container = scrollbarRef.value.getContainer()
    if (!container) return

    if (container.scrollHeight > 0 && container.clientHeight > 0) {
      if (needsScrollToBottom.value) {
        needsScrollToBottom.value = false
        scrollbarRef.value.scrollToBottom()
      }
    }
  }

  onMounted(() => {
    nextTick(() => {
      if (!scrollbarRef.value) return

      const container = scrollbarRef.value.getContainer()
      if (!container) return

      container.addEventListener('scroll', handleScroll, { passive: true })

      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { height } = entry.contentRect
          if (height > 0 && needsScrollToBottom.value) {
            requestAnimationFrame(() => {
              tryScrollToBottom()
            })
          }
        }
      })

      resizeObserver.observe(container)
    })
  })

  onBeforeUnmount(() => {
    if (scrollbarRef.value) {
      const container = scrollbarRef.value.getContainer()
      if (container) {
        container.removeEventListener('scroll', handleScroll)
      }
    }

    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
  })

  const showDeleteConfirm = ref(false)
  const pendingDeleteMessageId = ref<string | null>(null)

  const showRestoreConfirm = ref(false)
  const pendingCheckpoint = ref<CheckpointRecord | null>(null)

  const deleteCount = computed(() => {
    if (!pendingDeleteMessageId.value) return 0
    const index = chatStore.allMessages.findIndex((m) => m.id === pendingDeleteMessageId.value)
    if (index === -1) return 0
    return chatStore.allMessages.length - index
  })

  function handleEdit(messageId: string, newContent: string, attachments: Attachment[]) {
    emit('edit', messageId, newContent, attachments)
  }

  function handleDelete(messageId: string) {
    pendingDeleteMessageId.value = messageId
    showDeleteConfirm.value = true
  }

  function confirmDelete() {
    if (pendingDeleteMessageId.value) {
      const actualIndex = chatStore.allMessages.findIndex((m) => m.id === pendingDeleteMessageId.value)
      if (actualIndex !== -1) {
        chatStore.deleteMessage(actualIndex)
      }
      pendingDeleteMessageId.value = null
    }
  }

  function cancelDelete() {
    pendingDeleteMessageId.value = null
  }

  const deleteCheckpoints = computed<CheckpointRecord[]>(() => {
    if (!pendingDeleteMessageId.value) return []

    const messageIndex = chatStore.allMessages.findIndex((m) => m.id === pendingDeleteMessageId.value)
    if (messageIndex === -1) return []

    return chatStore.checkpoints.filter((cp) => cp.messageIndex <= messageIndex && cp.phase === 'before')
  })

  async function handleRestoreAndDelete(checkpointId: string) {
    if (!pendingDeleteMessageId.value) return

    const actualIndex = chatStore.allMessages.findIndex((m) => m.id === pendingDeleteMessageId.value)
    if (actualIndex === -1) return

    await chatStore.restoreAndDelete(actualIndex, checkpointId)
    pendingDeleteMessageId.value = null
  }

  function handleRetry(messageId: string) {
    const actualIndex = chatStore.allMessages.findIndex((m) => m.id === messageId)
    if (actualIndex !== -1) {
      chatStore.retryFromMessage(actualIndex)
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

  function handleRestoreCheckpoint(checkpointId: string) {
    const checkpoint = chatStore.checkpoints.find((cp) => cp.id === checkpointId)
    if (checkpoint) {
      restoreCheckpoint(checkpoint)
    }
  }

  async function handleRestoreAndRetry(messageId: string, checkpointId: string) {
    const actualIndex = chatStore.allMessages.findIndex((m) => m.id === messageId)
    if (actualIndex === -1) return
    await chatStore.restoreAndRetry(actualIndex, checkpointId)
  }

  async function handleRestoreAndEdit(
    messageId: string,
    newContent: string,
    attachments: Attachment[],
    checkpointId: string
  ) {
    const actualIndex = chatStore.allMessages.findIndex((m) => m.id === messageId)
    if (actualIndex === -1) return
    await chatStore.restoreAndEdit(actualIndex, newContent, attachments, checkpointId)
  }

  function shouldMergeForTool(messageIndex: number, toolName: string): boolean {
    if (!chatStore.mergeUnchangedCheckpoints) {
      return false
    }

    const beforeCp = chatStore.checkpoints.find(
      (cp) => cp.messageIndex === messageIndex && cp.phase === 'before' && cp.toolName === toolName
    )
    const afterCp = chatStore.checkpoints.find(
      (cp) => cp.messageIndex === messageIndex && cp.phase === 'after' && cp.toolName === toolName
    )

    if (!beforeCp || !afterCp) return false

    return Boolean(beforeCp.contentHash && afterCp.contentHash && beforeCp.contentHash === afterCp.contentHash)
  }

  async function restoreCheckpoint(checkpoint: CheckpointRecord) {
    pendingCheckpoint.value = checkpoint
    showRestoreConfirm.value = true
  }

  async function confirmRestore() {
    if (pendingCheckpoint.value) {
      await chatStore.restoreCheckpoint(pendingCheckpoint.value.id)
      pendingCheckpoint.value = null
    }
  }

  function getCheckpointLabel(cp: CheckpointRecord, phase: 'before' | 'after'): string {
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

  function getMergedLabel(cp: CheckpointRecord): string {
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

  function formatCheckpointTime(timestamp: number): string {
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

  return {
    t,
    chatStore,
    errorCopied,
    copyErrorDetails,
    hasMore,
    renderItems,
    scrollbarRef,
    showDeleteConfirm,
    deleteCheckpoints,
    deleteCount,
    confirmDelete,
    handleRestoreAndDelete,
    cancelDelete,
    showRestoreConfirm,
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
    getCheckpointLabel,
    getMergedLabel,
    formatCheckpointTime
  }
}

