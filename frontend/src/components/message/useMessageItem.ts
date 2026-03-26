import { computed, onUnmounted, ref, watch } from 'vue'
import { useChatStore } from '../../stores'
import type { Attachment, CheckpointRecord, Message } from '../../types'
import { formatModelName, formatTime } from '../../utils/format'
import { useI18n } from '../../i18n'
import { buildRenderBlocks, mergeThoughtToolBlocks, type RenderBlock } from './messageItemBlocks'

function formatDuration(ms: number): string {
  const seconds = ms / 1000
  return `${seconds.toFixed(1)}s`
}

export function useMessageItem(
  props: { message: Message; messageIndex: number },
  emit: (...args: any[]) => void
) {
  const { t } = useI18n()
  const chatStore = useChatStore()

  const isHovered = ref(false)
  const showRetryDialog = ref(false)
  const showEditDialog = ref(false)

  const isUser = computed(() => props.message.role === 'user')
  const isTool = computed(() => props.message.role === 'tool')
  const isSummary = computed(() => props.message.isSummary === true)
  const showFooterActions = computed(() => !isTool.value || isHovered.value)
  const taskCard = computed(() => props.message.metadata?.taskCard)
  const isStreaming = computed(() => props.message.streaming === true)

  const isSummaryExpanded = ref(false)

  const isThoughtExpanded = ref(false)

  const elapsedThinkingTime = ref(0)
  let thinkingTimer: ReturnType<typeof setInterval> | null = null

  function startThinkingTimer() {
    if (thinkingTimer) return
    const startTime = props.message.metadata?.thinkingStartTime
    if (!startTime) return

    elapsedThinkingTime.value = Date.now() - startTime

    thinkingTimer = setInterval(() => {
      elapsedThinkingTime.value = Date.now() - startTime
    }, 100)
  }

  function stopThinkingTimer() {
    if (thinkingTimer) {
      clearInterval(thinkingTimer)
      thinkingTimer = null
    }
  }

  onUnmounted(() => {
    stopThinkingTimer()
  })

  const renderBlocks = computed<RenderBlock[]>(() => buildRenderBlocks(props.message))
  const displayBlocks = computed<RenderBlock[]>(() => mergeThoughtToolBlocks(renderBlocks.value))

  const isThinking = computed(() => {
    if (!isStreaming.value) return false
    if (props.message.metadata?.thinkingDuration) return false

    const hasThoughtBlock = renderBlocks.value.some((b) => b.type === 'thought')
    const hasTextBlock = renderBlocks.value.some((b) => b.type === 'text' && b.text && b.text.trim())
    const hasToolBlock = renderBlocks.value.some((b) => b.type === 'tool')
    return hasThoughtBlock && !hasTextBlock && !hasToolBlock
  })

  const thinkingTimeDisplay = computed(() => {
    const duration = props.message.metadata?.thinkingDuration
    if (duration && duration > 0) {
      return formatDuration(duration)
    }

    if (isThinking.value && elapsedThinkingTime.value > 0) {
      return formatDuration(elapsedThinkingTime.value)
    }

    return null
  })

  watch(
    isThinking,
    (thinking) => {
      if (thinking) {
        startThinkingTimer()
      } else {
        stopThinkingTimer()
      }
    },
    { immediate: true }
  )

  watch(
    () => props.message.metadata?.thinkingStartTime,
    (startTime) => {
      if (startTime && isThinking.value && !thinkingTimer) {
        startThinkingTimer()
      }
    },
    { immediate: true }
  )

  const availableCheckpoints = computed<CheckpointRecord[]>(() => {
    return chatStore.checkpoints.filter((cp) => cp.messageIndex <= props.messageIndex && cp.phase === 'before')
  })

  const checkpointsBeforeMessage = computed<CheckpointRecord[]>(() => {
    const userMessageBefore = chatStore.checkpoints.find(
      (cp) => cp.messageIndex === props.messageIndex && cp.toolName === 'user_message' && cp.phase === 'before'
    )

    if (userMessageBefore) {
      return [userMessageBefore]
    }

    const previousCheckpoints = chatStore.checkpoints
      .filter((cp) => cp.messageIndex < props.messageIndex)
      .sort((a, b) => b.messageIndex - a.messageIndex)

    if (previousCheckpoints.length > 0) {
      return [previousCheckpoints[0]]
    }

    return []
  })

  const modelVersion = computed(() => props.message.metadata?.modelVersion)
  const finishReason = computed(() => props.message.metadata?.finishReason)

  const showFinishReason = computed(() => {
    if (!finishReason.value) return false
    return finishReason.value.toLowerCase() !== 'stop'
  })

  const finishReasonKey = computed(() => (finishReason.value || '').toLowerCase())

  const finishReasonIcon = computed(() => {
    switch (finishReasonKey.value) {
      case 'completed':
      case 'end_turn':
        return 'codicon-pass'
      case 'length':
      case 'max_tokens':
      case 'incomplete':
      case 'stream_closed':
        return 'codicon-warning'
      case 'content_filter':
      case 'safety':
        return 'codicon-shield'
      case 'tool_calls':
      case 'tool_use':
      case 'function_call':
        return 'codicon-tools'
      case 'cancelled':
      case 'canceled':
        return 'codicon-circle-slash'
      case 'failed':
      case 'error':
        return 'codicon-error'
      case 'expired':
      case 'timeout':
        return 'codicon-clock'
      case 'queued':
      case 'in_progress':
      case 'running':
        return 'codicon-loading'
      default:
        return 'codicon-info'
    }
  })

  const finishReasonClass = computed(() => {
    switch (finishReasonKey.value) {
      case 'completed':
      case 'end_turn':
        return 'finish-reason-success'
      default:
        return ''
    }
  })

  const finishReasonSpin = computed(() => {
    switch (finishReasonKey.value) {
      case 'queued':
      case 'in_progress':
      case 'running':
        return true
      default:
        return false
    }
  })

  const finishReasonTitle = computed(() => {
    if (!finishReason.value) return t('components.message.stats.finishReason')
    return `${t('components.message.stats.finishReason')}: ${finishReason.value}`
  })

  const roleDisplayName = computed(() => {
    if (isUser.value) return t('components.message.roles.user')
    if (isTool.value) return t('components.message.roles.tool')
    return (modelVersion.value ? formatModelName(modelVersion.value) : '') || t('components.message.roles.assistant')
  })

  const usageMetadata = computed(() => props.message.metadata?.usageMetadata)
  const hasUsage = computed(() => {
    return (
      !isUser.value &&
      !isTool.value &&
      !!usageMetadata.value &&
      (usageMetadata.value.totalTokenCount || usageMetadata.value.promptTokenCount || usageMetadata.value.candidatesTokenCount)
    )
  })

  const contextSnapshot = computed(() => props.message.metadata?.contextSnapshot)
  const hasContextSnapshot = computed(() => !!props.message.metadata?.contextSnapshot)

  const showContextUsedCard = computed(() => {
    if (isUser.value || isTool.value || isSummary.value) return false
    if (!props.message.metadata?.contextSnapshot) return false

    const hasFunctionCall = (m: Message) => m.parts?.some((p) => p.functionCall)
    if (hasFunctionCall(props.message)) return false

    const all = chatStore.allMessages
    const currentIndex = props.messageIndex
    if (!Array.isArray(all) || currentIndex <= 0 || currentIndex >= all.length) return true

    let lastUserIndex = -1
    for (let i = currentIndex - 1; i >= 0; i--) {
      const m = all[i]
      if (!m || m.role !== 'user') continue
      if (m.isFunctionResponse === true) continue
      if (m.isSummary === true) continue
      lastUserIndex = i
      break
    }

    if (lastUserIndex < 0) {
      for (let i = 0; i < currentIndex; i++) {
        const m = all[i]
        if (!m || m.role !== 'assistant') continue
        if (m.isFunctionResponse === true) continue
        if (m.isSummary === true) continue
        if (hasFunctionCall(m)) continue
        return false
      }
      return true
    }

    for (let i = lastUserIndex + 1; i < currentIndex; i++) {
      const m = all[i]
      if (!m || m.role !== 'assistant') continue
      if (m.isFunctionResponse === true) continue
      if (m.isSummary === true) continue
      if (hasFunctionCall(m)) continue
      return false
    }

    return true
  })

  function formatTokenCount(count: number | undefined): string {
    if (count === undefined) return ''
    if (count >= 1_000_000) return `${Math.round(count / 1_000_000)}m`
    if (count >= 1_000) return `${Math.round(count / 1_000)}k`
    return String(count)
  }

  const cacheHitInfo = computed(() => {
    const usage = usageMetadata.value
    const cachedTokens = usage?.cachedPromptTokenCount ?? 0
    const inputTokens = usage?.promptTokenCount ?? 0

    if (cachedTokens <= 0) return null
    if (inputTokens <= 0) return null

    const percent = Math.max(0, Math.min(100, Math.round((cachedTokens / inputTokens) * 100)))
    return {
      cachedTokens,
      percent,
      cachedTokensText: formatTokenCount(cachedTokens)
    }
  })

  const cacheHitTitle = computed(() => {
    if (!cacheHitInfo.value) return ''
    return t('components.message.stats.cacheHit', {
      tokens: cacheHitInfo.value.cachedTokensText,
      percent: cacheHitInfo.value.percent
    })
  })

  const messageClass = computed(() => ({
    'message-item': true,
    'user-message': isUser.value,
    'assistant-message': !isUser.value,
    streaming: isStreaming.value,
    'summary-message': isSummary.value
  }))

  const formattedTime = computed(() => {
    if (!props.message.timestamp || props.message.timestamp === 0) {
      return null
    }
    return formatTime(props.message.timestamp, 'HH:mm')
  })

  function startEdit() {
    showEditDialog.value = true
  }

  function handleEdit(newContent: string, attachments: Attachment[]) {
    emit('edit', props.message.id, newContent, attachments)
  }

  function handleRestoreAndEdit(newContent: string, attachments: Attachment[], checkpointId: string) {
    emit('restoreAndEdit', props.message.id, newContent, attachments, checkpointId)
  }

  function handleCopy() {
    emit('copy', props.message.content)
  }

  function handleDelete() {
    emit('delete', props.message.id)
  }

  function handleRetryClick() {
    showRetryDialog.value = true
  }

  function handleRetry() {
    emit('retry', props.message.id)
  }

  function handleRestoreAndRetry(checkpointId: string) {
    emit('restoreAndRetry', props.message.id, checkpointId)
  }

  function handleOpenContextUsed() {
    const snapshot = props.message.metadata?.contextSnapshot
    if (snapshot) {
      chatStore.openContextInspectorWithData(snapshot)
    }
  }

  return {
    t,
    isHovered,
    showRetryDialog,
    showEditDialog,
    isUser,
    isTool,
    isSummary,
    showFooterActions,
    taskCard,
    isStreaming,
    isSummaryExpanded,
    displayBlocks,
    isThoughtExpanded,
    isThinking,
    thinkingTimeDisplay,
    availableCheckpoints,
    checkpointsBeforeMessage,
    roleDisplayName,
    hasUsage,
    usageMetadata,
    formatTokenCount,
    cacheHitInfo,
    cacheHitTitle,
    showFinishReason,
    finishReasonClass,
    finishReasonTitle,
    finishReasonIcon,
    finishReasonSpin,
    contextSnapshot,
    hasContextSnapshot,
    showContextUsedCard,
    messageClass,
    formattedTime,
    startEdit,
    handleEdit,
    handleRestoreAndEdit,
    handleCopy,
    handleDelete,
    handleRetryClick,
    handleRetry,
    handleRestoreAndRetry,
    handleOpenContextUsed
  }
}
