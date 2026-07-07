import { beforeEach, describe, expect, it, vi } from 'vitest'

const { capturedWatchers } = vi.hoisted(() => ({
  capturedWatchers: [] as Array<{ getter: () => any; callback: (next: any, prev: any) => void }>,
}))

vi.mock('vue', () => ({
  ref: (value: any) => ({ value }),
  computed: (getter: any) => ({
    get value() {
      return getter()
    },
  }),
  watch: (getter: any, callback: any) => {
    capturedWatchers.push({ getter, callback })
  },
  onMounted: () => {},
}))

const { mockChatStore, mockSettingsStore, mockSendToExtension } = vi.hoisted(() => ({
  mockChatStore: {
    configId: '',
    currentConfig: null,
    setConfigId: vi.fn(),
  },
  mockSettingsStore: {
    currentView: 'chat' as string,
  },
  mockSendToExtension: vi.fn(),
}))

vi.mock('../frontend/src/stores/index.ts', () => ({
  useChatStore: () => mockChatStore,
  useSettingsStore: () => mockSettingsStore,
}))

vi.mock('../frontend/src/utils/vscode.ts', () => ({
  sendToExtension: mockSendToExtension,
}))

import { useInputAreaConfig } from '../frontend/src/components/input/useInputAreaConfig'

describe('useInputAreaConfig summarize strategy', () => {
  beforeEach(() => {
    mockSendToExtension.mockReset()
    mockSettingsStore.currentView = 'chat'
    capturedWatchers.length = 0
  })

  it('exposes the configured summarize footer state', async () => {
    mockSendToExtension.mockImplementation(async (type: string) => {
      if (type === 'getSummarizeConfig') return {
        keepRecentRounds: 3,
        autoSummarize: true,
        autoSummarizeThreshold: 82,
      }
      throw new Error(`Unexpected request: ${type}`)
    })

    const {
      summarizeKeepRecentRounds,
      summarizeAutoSummarize,
      summarizeAutoSummarizeThreshold,
      loadSummarizeConfig,
    } = useInputAreaConfig()
    await (loadSummarizeConfig as any)()

    expect(summarizeKeepRecentRounds.value).toBe(3)
    expect(summarizeAutoSummarize.value).toBe(true)
    expect(summarizeAutoSummarizeThreshold.value).toBe(82)
  })

  it('falls back to null when the backend response is missing the field', async () => {
    mockSendToExtension.mockImplementation(async (type: string) => {
      if (type === 'getSummarizeConfig') return {}
      throw new Error(`Unexpected request: ${type}`)
    })

    const { summarizeKeepRecentRounds, loadSummarizeConfig } = useInputAreaConfig()
    await (loadSummarizeConfig as any)()

    expect(summarizeKeepRecentRounds.value).toBeNull()
  })

  it('falls back to null when the request fails', async () => {
    mockSendToExtension.mockRejectedValue(new Error('boom'))

    const { summarizeKeepRecentRounds, loadSummarizeConfig } = useInputAreaConfig()
    await (loadSummarizeConfig as any)()

    expect(summarizeKeepRecentRounds.value).toBeNull()
  })

  it('reloads keep-recent-rounds after the settings panel closes, since InputArea never remounts', async () => {
    mockSendToExtension.mockImplementation(async (type: string) => {
      if (type === 'getSummarizeConfig') return { keepRecentRounds: 2 }
      throw new Error(`Unexpected request: ${type}`)
    })

    const { summarizeKeepRecentRounds } = useInputAreaConfig()
    // The settings-view watcher is registered last inside useInputAreaConfig.
    const settingsViewWatcher = capturedWatchers[capturedWatchers.length - 1]

    await settingsViewWatcher.callback('chat', 'chat')
    expect(summarizeKeepRecentRounds.value).toBeNull() // unchanged: this transition isn't leaving settings

    mockSendToExtension.mockImplementation(async (type: string) => {
      if (type === 'getSummarizeConfig') return { keepRecentRounds: 10 }
      throw new Error(`Unexpected request: ${type}`)
    })

    await settingsViewWatcher.callback('chat', 'settings')

    expect(summarizeKeepRecentRounds.value).toBe(10)
  })
})
