import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { useChatStore } from '../../stores'
import type { Message } from '../../types'
import {
  computeAnchorClampDelta,
  computeGuardAction,
  createInitialStreamingFollowState,
  pauseForUserScroll,
  resetAfterStreamEnd,
  resetForNewStream,
  resumeFollowLatest,
  shouldPauseForUserScroll,
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
const STREAMING_GUARD_MARGIN_PX = 8
const USER_SCROLL_UP_THRESHOLD_PX = 8

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
  let lastProgrammaticScrollTop = 0

  const wasAtBottom = ref(true)
  const streamingFollowState = ref<StreamingFollowState>(createInitialStreamingFollowState())

  function getScrollContainer(): HTMLElement | null {
    return scrollbarRef.value?.getContainer() ?? null
  }

  function isAtBottom(container: HTMLElement): boolean {
    return container.scrollHeight - container.scrollTop - container.clientHeight <= DEFAULT_STICKY_THRESHOLD_PX
  }

  function applyProgrammaticScroll(container: HTMLElement, nextScrollTop: number) {
    container.scrollTop = nextScrollTop
    // Record the resulting (clamped) position so handleScroll can tell our
    // own scroll apart from a genuine user scroll without relying on timing.
    lastProgrammaticScrollTop = container.scrollTop
  }

  function scrollToBottomNow() {
    const container = getScrollContainer()
    if (!container) return

    applyProgrammaticScroll(container, container.scrollHeight)
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

  function beginStreamingFollow() {
    const container = getScrollContainer()
    if (container) {
      // Establish the baseline before the new message DOM is rendered. A
      // position the user chose before sending is not a scroll-up during this
      // stream and must not pause the new response's auto-follow.
      lastProgrammaticScrollTop = container.scrollTop
      wasAtBottom.value = isAtBottom(container)
    }
    resetStreamingFollowState(resetForNewStream())
    scheduleAutoScroll()
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
      lastProgrammaticScrollTop = container.scrollTop

      // Delay clearing the flag until the next frame so that any
      // synchronous scroll events fired by the scrollTop assignment
      // still see isLoadingMore === true and skip re-triggering.
      requestAnimationFrame(() => {
        isLoadingMore.value = false
      })
    })
  }

  function handleScroll(event: Event) {
    const container = event.target as HTMLElement
    if (!container) return

    const distanceFromBottomPx = container.scrollHeight - container.scrollTop - container.clientHeight
    if (
      shouldPauseForUserScroll({
        isStreaming: chatStore.isStreaming,
        mode: streamingFollowState.value.mode,
        currentScrollTop: container.scrollTop,
        lastProgrammaticScrollTop,
        distanceFromBottomPx,
        stickyThresholdPx: DEFAULT_STICKY_THRESHOLD_PX,
        userScrollUpThresholdPx: USER_SCROLL_UP_THRESHOLD_PX
      })
    ) {
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

  function performStreamingAutoScroll(container: HTMLElement, streamingMessageId: string) {
    if (streamingFollowState.value.mode !== 'following') return

    applyProgrammaticScroll(container, container.scrollHeight)

    const anchor = container.querySelector<HTMLElement>(`[data-message-id="${streamingMessageId}"]`)
    if (!anchor) {
      wasAtBottom.value = isAtBottom(container)
      return
    }

    const containerRect = container.getBoundingClientRect()
    const anchorRect = anchor.getBoundingClientRect()
    const clampDeltaPx = computeAnchorClampDelta({
      containerTopPx: containerRect.top,
      anchorTopPx: anchorRect.top,
      marginPx: STREAMING_GUARD_MARGIN_PX
    })

    const { nextState, clampDeltaPx: nextClampDeltaPx } = computeGuardAction(streamingFollowState.value, clampDeltaPx)
    if (nextClampDeltaPx > 0) {
      applyProgrammaticScroll(container, Math.max(0, container.scrollTop - nextClampDeltaPx))
    }

    resetStreamingFollowState(nextState)
    wasAtBottom.value = isAtBottom(container)
  }

  function performNonStreamingStickyBottom(container: HTMLElement) {
    if (!wasAtBottom.value) return

    applyProgrammaticScroll(container, container.scrollHeight)
    wasAtBottom.value = true
  }

  function performAutoScroll() {
    const container = getScrollContainer()
    if (!container) return

    const streamingMessageId = chatStore.streamingMessageId
    if (chatStore.isStreaming && streamingMessageId) {
      performStreamingAutoScroll(container, streamingMessageId)
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
        scheduleAutoScroll()
      }
    }
  )

  watch(
    () => chatStore.isStreaming,
    (isStreaming, wasStreaming) => {
      if (isStreaming && !wasStreaming) {
        beginStreamingFollow()
        return
      }

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
      lastProgrammaticScrollTop = container.scrollTop

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
