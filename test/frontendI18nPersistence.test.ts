import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('frontend i18n language unification and persistence', () => {
  let webviewState: Record<string, unknown> = {}
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')

  beforeEach(() => {
    vi.resetModules()
    webviewState = {}

    Object.defineProperty(globalThis, 'navigator', {
      value: { language: 'ja-JP' },
      configurable: true,
      writable: true,
    })

    ;(globalThis as any).acquireVsCodeApi = () => ({
      postMessage: vi.fn(),
      getState: () => webviewState,
      setState: (state: Record<string, unknown>) => {
        webviewState = { ...state }
      },
    })
  })

  afterEach(() => {
    vi.resetModules()
    delete (globalThis as any).acquireVsCodeApi

    if (originalNavigator) {
      Object.defineProperty(globalThis, 'navigator', originalNavigator)
    } else {
      delete (globalThis as any).navigator
    }
  })

  it('uses the unified i18n implementation and resolves auto to the detected language', async () => {
    const { resolveSupportedLanguage } = await import('../frontend/src/i18n/language.ts')

    expect(resolveSupportedLanguage('auto', 'ja-JP')).toBe('ja')
    expect(resolveSupportedLanguage('auto', 'en-US')).toBe('en')
    expect(resolveSupportedLanguage('zh-CN', 'ja-JP')).toBe('zh-CN')
  }, 15000)

  it('persists the selected language across store reloads', async () => {
    const { createPinia, setActivePinia } = await import('pinia')
    let settingsStoreModule = await import('../frontend/src/stores/settingsStore')

    setActivePinia(createPinia())

    let settingsStore = settingsStoreModule.useSettingsStore()
    settingsStore.setLanguage('en')

    expect(webviewState['ui.language']).toBe('en')

    vi.resetModules()

    ;(globalThis as any).acquireVsCodeApi = () => ({
      postMessage: vi.fn(),
      getState: () => webviewState,
      setState: (state: Record<string, unknown>) => {
        webviewState = { ...state }
      },
    })

    const { createPinia: createPiniaReloaded, setActivePinia: setActivePiniaReloaded } = await import('pinia')
    settingsStoreModule = await import('../frontend/src/stores/settingsStore')

    setActivePiniaReloaded(createPiniaReloaded())

    settingsStore = settingsStoreModule.useSettingsStore()
    expect(settingsStore.language).toBe('en')
  }, 15000)
})
