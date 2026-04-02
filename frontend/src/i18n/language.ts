import type { SupportedLanguage } from './types'
import { isSupportedLanguage } from './types'

export type ResolvedLanguage = Exclude<SupportedLanguage, 'auto'>

export function detectInitialLanguage(): string {
  if (typeof navigator !== 'undefined' && typeof navigator.language === 'string' && navigator.language.trim()) {
    return navigator.language.trim()
  }

  return 'zh-CN'
}

export function normalizeSupportedLanguage(
  value: unknown,
  fallback: SupportedLanguage = 'auto',
): SupportedLanguage {
  return isSupportedLanguage(value) ? value : fallback
}

export function resolveSupportedLanguage(
  value: unknown,
  detectedLanguage: unknown,
): ResolvedLanguage {
  const normalized = normalizeSupportedLanguage(value)
  if (normalized !== 'auto') {
    return normalized
  }

  const detected = String(detectedLanguage || '').trim()
  if (detected === 'zh-CN' || detected.startsWith('zh')) return 'zh-CN'
  if (detected === 'en' || detected.startsWith('en')) return 'en'
  if (detected === 'ja' || detected.startsWith('ja')) return 'ja'
  return 'zh-CN'
}
