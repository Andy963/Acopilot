import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SupportedLanguage } from '@/i18n/types'
import { normalizeSupportedLanguage } from '@/i18n/language'
import { MAIN_VIEW_REGISTRY, MAIN_VIEWS, isAppView, type AppView } from '@/navigation/mainViews'
import { loadState, saveState } from '@/utils/vscode'

export type { AppView } from '@/navigation/mainViews'

export type Language = SupportedLanguage

export const SETTINGS_TAB_IDS = [
  'channel',
  'tools',
  'mcp',
  'checkpoint',
  'summarize',
  'imageGen',
  'context',
  'prompt',
  'general',
] as const

export type SettingsTab = (typeof SETTINGS_TAB_IDS)[number]

const LANGUAGE_STATE_KEY = 'ui.language'
const SETTINGS_ACTIVE_TAB_STATE_KEY = 'ui.settings.activeTab'

export function isSettingsTab(value: unknown): value is SettingsTab {
  return typeof value === 'string' && SETTINGS_TAB_IDS.includes(value as SettingsTab)
}

function loadInitialLanguage(): Language {
  return normalizeSupportedLanguage(loadState(LANGUAGE_STATE_KEY, 'auto'))
}

function loadInitialActiveTab(): SettingsTab {
  const storedTab = loadState<unknown>(SETTINGS_ACTIVE_TAB_STATE_KEY, 'channel')
  return isSettingsTab(storedTab) ? storedTab : 'channel'
}

export const useSettingsStore = defineStore('settings', () => {
  const currentView = ref<AppView>('chat')
  const activeTab = ref<SettingsTab>(loadInitialActiveTab())
  const language = ref<Language>(loadInitialLanguage())

  const isVisible = computed(() => currentView.value === 'settings')
  const currentViewDefinition = computed(() => MAIN_VIEW_REGISTRY[currentView.value])

  function showView(view: AppView) {
    if (!isAppView(view)) return
    currentView.value = view
  }

  function showChat() {
    showView('chat')
  }

  function showHistory() {
    showView('history')
  }

  function showSettings(tab?: SettingsTab) {
    showView('settings')
    if (tab) {
      setActiveTab(tab)
    }
  }

  function hideSettings() {
    showChat()
  }

  function setActiveTab(tab: SettingsTab) {
    if (!isSettingsTab(tab)) return
    activeTab.value = tab
    saveState(SETTINGS_ACTIVE_TAB_STATE_KEY, tab)
  }

  function setLanguage(lang: Language) {
    const nextLanguage = normalizeSupportedLanguage(lang)
    language.value = nextLanguage
    saveState(LANGUAGE_STATE_KEY, nextLanguage)
  }

  return {
    currentView,
    currentViewDefinition,
    mainViews: MAIN_VIEWS,
    isVisible,
    activeTab,
    language,

    showView,
    showChat,
    showHistory,
    showSettings,
    hideSettings,
    setActiveTab,
    setLanguage
  }
})
