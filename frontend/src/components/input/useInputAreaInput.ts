import { computed, ref } from 'vue'
import { useChatStore } from '../../stores'
import type { Attachment } from '../../types'

const MAX_PROMPT_HISTORY = 50

export function useInputAreaInput(params: {
  uploading?: boolean
  attachments?: Attachment[]
}) {
  const chatStore = useChatStore()
  const isComposing = ref(false)

  const inputValue = computed({
    get: () => chatStore.inputValue,
    set: (value: string) => chatStore.setInputValue(value)
  })

  const promptHistory = ref<string[]>([])
  const promptHistoryCursor = ref(0)
  const historyNavigationActive = ref(false)

  function pushPromptToHistory(prompt: string): void {
    const value = prompt.trim()
    if (!value) return

    const history = promptHistory.value
    if (history[history.length - 1] === value) return

    history.push(value)
    if (history.length > MAX_PROMPT_HISTORY) {
      history.splice(0, history.length - MAX_PROMPT_HISTORY)
    }
  }

  function resetPromptHistoryNavigation(): void {
    historyNavigationActive.value = false
    promptHistoryCursor.value = promptHistory.value.length
  }

  function handlePromptHistoryKeydown(key: 'ArrowUp' | 'ArrowDown'): void {
    const history = promptHistory.value
    if (history.length === 0) return

    if (!historyNavigationActive.value) {
      promptHistoryCursor.value = history.length
    }

    if (key === 'ArrowUp') {
      promptHistoryCursor.value = Math.max(0, promptHistoryCursor.value - 1)
      historyNavigationActive.value = true
      inputValue.value = history[promptHistoryCursor.value] || ''
      return
    }

    if (!historyNavigationActive.value) return

    if (promptHistoryCursor.value >= history.length - 1) {
      resetPromptHistoryNavigation()
      inputValue.value = ''
      return
    }

    promptHistoryCursor.value += 1
    historyNavigationActive.value = true
    inputValue.value = history[promptHistoryCursor.value] || ''
  }

  const canSend = computed(() => {
    const hasContent = inputValue.value.trim().length > 0 ||
      (params.attachments && params.attachments.length > 0)

    if (chatStore.hasPendingToolConfirmation && hasContent) {
      return true
    }

    return hasContent && !chatStore.isWaitingForResponse && !params.uploading
  })

  function handleInput(value: string) {
    resetPromptHistoryNavigation()
    chatStore.setInputValue(value)
  }

  function handleCompositionStart() {
    isComposing.value = true
  }

  function handleCompositionEnd() {
    isComposing.value = false
  }

  return {
    inputValue,
    isComposing,
    historyNavigationActive,
    canSend,
    pushPromptToHistory,
    resetPromptHistoryNavigation,
    handlePromptHistoryKeydown,
    handleInput,
    handleCompositionStart,
    handleCompositionEnd
  }
}
