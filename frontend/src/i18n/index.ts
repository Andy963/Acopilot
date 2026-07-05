/**
 * Acopilot - i18n 国际化模块
 *
 * 提供统一的前端语言状态、翻译查找和语言解析逻辑。
 */

import { computed, ref } from 'vue'
import { getActivePinia } from 'pinia'
import { useSettingsStore } from '@/stores/settingsStore'
import { loadState, saveState } from '@/utils/vscode'
import type { SupportedLanguage, LanguageMessages, LanguageOption } from './types'
import { detectInitialLanguage, normalizeSupportedLanguage, resolveSupportedLanguage, type ResolvedLanguage } from './language'
import zhCN from './langs/zh-CN'
import en from './langs/en'
import ja from './langs/ja'

const LANGUAGE_STATE_KEY = 'ui.language'

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { value: 'auto', label: '跟随系统', nativeLabel: 'Auto' },
  { value: 'zh-CN', label: '简体中文', nativeLabel: '简体中文' },
  { value: 'en', label: 'English', nativeLabel: 'English' },
  { value: 'ja', label: '日本語', nativeLabel: '日本語' },
]

export const messages: Record<ResolvedLanguage, LanguageMessages> = {
  'zh-CN': zhCN,
  'en': en,
  'ja': ja,
}

const fallbackLanguage = ref<SupportedLanguage>(loadPersistedLanguage())
const detectedLanguage = ref<string>(detectInitialLanguage())

export { normalizeSupportedLanguage } from './language'

function loadPersistedLanguage(): SupportedLanguage {
  return normalizeSupportedLanguage(loadState(LANGUAGE_STATE_KEY, 'auto'))
}

function getSettingsStore() {
  if (!getActivePinia()) return null

  try {
    return useSettingsStore()
  } catch {
    return null
  }
}

function getConfiguredLanguage(): SupportedLanguage {
  return getSettingsStore()?.language ?? fallbackLanguage.value
}

export const currentLanguage = computed(() => getConfiguredLanguage())
export const actualLanguage = computed<ResolvedLanguage>(() => resolveSupportedLanguage(currentLanguage.value, detectedLanguage.value))

export function setLanguage(lang: SupportedLanguage) {
  const normalized = normalizeSupportedLanguage(lang)
  fallbackLanguage.value = normalized

  const settingsStore = getSettingsStore()
  if (settingsStore) {
    if (settingsStore.language !== normalized) {
      settingsStore.setLanguage(normalized)
    }
    return
  }

  saveState(LANGUAGE_STATE_KEY, normalized)
}

export function getLanguage(): SupportedLanguage {
  return getConfiguredLanguage()
}

export function setDetectedLanguage(lang: string) {
  detectedLanguage.value = String(lang || '').trim() || detectInitialLanguage()
}

export function translate(lang: string, key: string, params?: Record<string, any>): string {
  const message = messages[resolveSupportedLanguage(lang, detectedLanguage.value)] || messages['zh-CN']
  const keys = key.split('.')
  let value: any = message

  for (const currentKey of keys) {
    if (value && typeof value === 'object' && currentKey in value) {
      value = value[currentKey]
    } else {
      console.warn(`[i18n] Missing translation: ${key}`)
      return key
    }
  }

  if (typeof value !== 'string') {
    return key
  }

  if (!params) {
    return value
  }

  return value.replace(/\{(\w+)\}/g, (match, paramName) => {
    return params[paramName] !== undefined ? String(params[paramName]) : match
  })
}

export function t(key: string, params?: Record<string, any>): string {
  return translate(getConfiguredLanguage(), key, params)
}

export function useI18n() {
  return {
    t,
    currentLanguage,
    actualLanguage,
    setLanguage,
    getLanguage,
    setDetectedLanguage,
    SUPPORTED_LANGUAGES,
  }
}

export default {
  t,
  setLanguage,
  getLanguage,
  setDetectedLanguage,
  normalizeSupportedLanguage,
  translate,
  useI18n,
  SUPPORTED_LANGUAGES,
}