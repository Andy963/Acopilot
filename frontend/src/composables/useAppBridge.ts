import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { setDetectedLanguage, setLanguage, t } from './useI18n'
import { useChatStore, useSettingsStore, useTerminalStore } from '../stores'
import { onMessageFromExtension, sendToExtension } from '../utils/vscode'

type ChatStore = ReturnType<typeof useChatStore>
type SettingsStore = ReturnType<typeof useSettingsStore>

interface UseAppBridgeOptions {
  chatStore: ChatStore
  settingsStore: SettingsStore
  handleNewChat: () => void
  handleShowHistory: () => void
  handleShowSettings: () => void
}

export function useAppBridge(options: UseAppBridgeOptions) {
  const languageLoaded = ref(false)
  const terminalStore = useTerminalStore()
  let disposeCommandListener: (() => void) | undefined

  async function loadLanguageSettings() {
    try {
      const response = await sendToExtension<any>('getSettings', {})
      if (response?.settings?.ui?.language) {
        setLanguage(response.settings.ui.language)
      }
    } catch (error) {
      console.error('Failed to load language settings:', error)
    } finally {
      languageLoaded.value = true
    }
  }

  async function reportUiState() {
    try {
      await sendToExtension('uiStateChanged', {
        currentView: options.settingsStore.currentView,
        activeTab: options.settingsStore.activeTab,
        showEmptyState: options.chatStore.showEmptyState,
        currentConversationId: options.chatStore.currentConversationId,
        selectionReferenceCount: options.chatStore.selectionReferences.length,
      })
    } catch {
      // Ignore smoke status sync failures.
    }
  }

  function handleCommandMessage(message: any) {
    if (message.type !== 'command') return

    switch (message.command) {
      case 'showChat':
        options.settingsStore.showChat()
        break
      case 'newChat':
        options.handleNewChat()
        break
      case 'addSelectionToChat':
        options.settingsStore.showChat()
        options.chatStore.addSelectionReference(message.data).catch(() => {})
        sendToExtension('showNotification', {
          message: message.data?.source === 'file'
            ? t('components.input.notifications.fileReferenceAdded')
            : t('components.input.notifications.selectionReferenceAdded'),
          type: 'info'
        }).catch(() => {})
        break
      case 'showHistory':
        options.handleShowHistory()
        break
      case 'showSettings':
        options.handleShowSettings()
        break
    }
  }

  watch(
    () => [
      options.settingsStore.currentView,
      options.settingsStore.activeTab,
      options.chatStore.showEmptyState,
      options.chatStore.currentConversationId,
      options.chatStore.selectionReferences.length,
    ],
    () => {
      void reportUiState()
    }
  )

  onMounted(async () => {
    console.log('Acopilot Chat loaded')

    setDetectedLanguage(typeof navigator !== 'undefined' ? navigator.language : 'zh-CN')

    terminalStore.initialize()

    await loadLanguageSettings()

    disposeCommandListener = onMessageFromExtension(handleCommandMessage)

    sendToExtension('webviewReady', {}).catch(() => {})
    void reportUiState()

    options.chatStore.initialize()
  })

  onBeforeUnmount(() => {
    disposeCommandListener?.()
  })

  return {
    languageLoaded,
    reportUiState,
  }
}
