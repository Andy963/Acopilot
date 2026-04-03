import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { useChatStore } from '../../stores'
import type { Message } from '../../types'
import {
  createInitialStreamingFollowState,
  pauseForUserScroll,
  resetAfterStreamEnd,
  resetForNewStream,
  resumeFollowLatest,
  shouldShowJumpToLatest,
  type StreamingFollowState
} from './streamingScrollGuard'

export interface ScrollbarHandle {
  getContainer: () => HTMLElement | null
  scrollToBottom: () => void
  update?: () => void
}

const VISIBLE_INCREMENT = 40
const DEFAULT_STICKY_THRESHOLD_PX = 50

export function useMessageListScroll(messages: Ref<Message[]>) {
  const chatStore = useChatStore()

  const visibleCount = ref(VISIBLE_INCREMENT)
  const hasMore = computed(() => messages.value.length > visibleCount.value)

  const scrollbarRef = ref<ScrollbarHandle | null>(null)
  const needsScrollToBottom = ref(false)
  const isLoadingMore = ref(false)
  const showJumpToLatest = computed(() => shouldShowJumpToLatest(chatStore.isStreaming, streamingFollowState.value))

  let resizeObserver: ResizeObserver | null = null
  let scheduledAutoScrollRaf: number | null = null
  let isProgrammaticScroll = false

  const wasAtBottom = ref(true)
  const streamingFollowState = ref<StreamingFollowState>(createInitialStreamingFollowState())

  function getScrollContainer(): HTMLElement | null {
    return scrollbarRef.value?.getContainer() ?? null
  }

  function isAtBottom(container: HTMLElement): boolean {
    return container.scrollHeight - container.scrollTop - container.clientHeight <= DEFAULT_STICKY_THRESHOLD_PX
  }

  function withProgrammaticScroll(fn: () => void) {
    isProgrammaticScroll = true
    fn()
    requestAnimationFrame(() => {
      isProgrammaticScroll = false
    })
  }

  function scrollToBottomNow() {
    const container = getScrollContainer()
    if (!container) return

    withProgrammaticScroll(() => {
      container.scrollTop = container.scrollHeight
    })
    scrollbarRef.value?.update?.()
  }

  function tryScrollToBottom() {
    const container = getScrollContainer()
    if (!container) return

    if (container.scrollHeight > 0 && container.clientHeight > 0 && needsScrollToBottom.value) {
      needsScrollToBottom.value = false
      scrollToBottomNow()
    }
  }

  function resetStreamingFollowState(nextState: StreamingFollowState) {
    streamingFollowState.value = nextState
  }

  function loadMore() {
    if (isLoadingMore.value || !hasMore.value || !scrollbarRef.value) return

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

  function handleScroll(event: Event) {
    const container = event.target as HTMLElement
    if (!container) return

    if (chatStore.isStreaming && !isProgrammaticScroll && streamingFollowState.value.mode === 'following' && !isAtBottom(container)) {
      resetStreamingFollowState(pauseForUserScroll(streamingFollowState.value))
    }

    wasAtBottom.value = isAtBottom(container)
    if (hasMore.value && !isLoadingMore.value && container.scrollTop < 100) {
      loadMore()
    }
  }

  function scheduleAutoScroll() {
    if (scheduledAutoScrollRaf !== null) return
    scheduledAutoScrollRaf = requestAnimationFrame(() => {
      scheduledAutoScrollRaf = null
      performAutoScroll()
    })
  }

  function performStreamingAutoScroll(container: HTMLElement) {
    if (streamingFollowState.value.mode !== 'following') return

    withProgrammaticScroll(() => {
      container.scrollTop = container.scrollHeight
    })
    wasAtBottom.value = isAtBottom(container)
  }

  function performNonStreamingStickyBottom(container: HTMLElement) {
    if (!wasAtBottom.value) return

    withProgrammaticScroll(() => {
      container.scrollTop = container.scrollHeight
    })
    wasAtBottom.value = true
  }

  function performAutoScroll() {
    const container = getScrollContainer()
    if (!container) return

    const streamingMessageId = chatStore.streamingMessageId
    if (chatStore.isStreaming && streamingMessageId) {
      performStreamingAutoScroll(container)
      return
    }

    performNonStreamingStickyBottom(container)
  }

  function handleJumpToLatest() {
    resetStreamingFollowState(resumeFollowLatest(streamingFollowState.value))
    scrollToBottomNow()
    scheduleAutoScroll()
  }

  const activeStreamingMessage = computed(() => {
    if (!chatStore.streamingMessageId) return null
    return chatStore.allMessages.find((message) => message.id === chatStore.streamingMessageId) ?? null
  })

  watch(
    () => chatStore.currentConversationId,
    (newId, oldId) => {
      if (newId === oldId) return

      needsScrollToBottom.value = true
      visibleCount.value = VISIBLE_INCREMENT
      resetStreamingFollowState(resetAfterStreamEnd())
    }
  )

  watch(
    messages,
    (nextMessages) => {
      if (needsScrollToBottom.value && nextMessages.length > 0) {
        tryScrollToBottom()
      }
    },
    { deep: false }
  )

  watch(
    () => chatStore.streamingMessageId,
    (newId, oldId) => {
      if (newId && newId !== oldId) {
        resetStreamingFollowState(resetForNewStream())
        scheduleAutoScroll()
      }
    }
  )

  watch(
    () => chatStore.isStreaming,
    (isStreaming, wasStreaming) => {
      if (!isStreaming && wasStreaming) {
        resetStreamingFollowState(resetAfterStreamEnd())
      }
    }
  )

  watch(
    () => activeStreamingMessage.value?.content,
    () => {
      if (chatStore.isStreaming) {
        scheduleAutoScroll()
      }
    },
    { flush: 'post' }
  )

  watch(
    () => chatStore.allMessages.length,
    () => {
      scheduleAutoScroll()
    },
    { flush: 'post' }
  )

  onMounted(() => {
    nextTick(() => {
      const container = scrollbarRef.value?.getContainer()
      if (!container) return

      container.addEventListener('scroll', handleScroll, { passive: true })
      wasAtBottom.value = isAtBottom(container)

      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.height > 0 && needsScrollToBottom.value) {
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
    const container = scrollbarRef.value?.getContainer()
    if (container) {
      container.removeEventListener('scroll', handleScroll)
    }

    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }

    if (scheduledAutoScrollRaf !== null) {
      cancelAnimationFrame(scheduledAutoScrollRaf)
      scheduledAutoScrollRaf = null
    }
  })

  return {
    visibleCount,
    hasMore,
    scrollbarRef,
    showJumpToLatest,
    handleJumpToLatest
  }
}
