import { computed, ref } from 'vue'
import { useChatStore } from '../../stores'
import type { Message } from '../../types'
import { buildMessageListRenderItems, type RenderItem } from './messageListRenderItems'
import { useMessageListActions } from './useMessageListActions'
import { useMessageListScroll } from './useMessageListScroll'

export function useMessageList(
  props: { messages: Message[] },
  emit: (...args: any[]) => void
) {
  const chatStore = useChatStore()
  const messages = computed(() => props.messages)
  const { visibleCount, hasMore, scrollbarRef, showJumpToLatest, handleJumpToLatest } = useMessageListScroll(messages)
  const actions = useMessageListActions(emit)

  const renderItems = computed<RenderItem[]>(() => {
    return buildMessageListRenderItems({
      messages: messages.value,
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

  return {
    chatStore,
    errorCopied,
    copyErrorDetails,
    hasMore,
    renderItems,
    scrollbarRef,
    showJumpToLatest,
    handleJumpToLatest,
    ...actions
  }
}
