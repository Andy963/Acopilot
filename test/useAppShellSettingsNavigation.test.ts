import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockChatStore, mockSettingsStore } = vi.hoisted(() => ({
  mockChatStore: {
    currentConversation: null,
    messages: [],
    allMessages: [],
    hasPendingToolConfirmation: false,
    configId: '',
    currentConfig: null as null | { id: string },
    createNewConversation: vi.fn(),
    rejectPendingToolsWithAnnotation: vi.fn(),
    sendMessage: vi.fn(),
    cancelStream: vi.fn(),
    editAndRetry: vi.fn(),
    deleteMessage: vi.fn(),
    retryFromMessage: vi.fn(),
    clearInputValue: vi.fn(),
  },
  mockSettingsStore: {
    showChat: vi.fn(),
    showHistory: vi.fn(),
    showSettings: vi.fn(),
  },
}))

vi.mock('../frontend/src/composables/useAttachments.ts', () => ({
  useAttachments: () => ({
    attachments: [],
    uploading: false,
    addAttachments: vi.fn(),
    removeAttachment: vi.fn(),
    clearAttachments: vi.fn(),
  }),
}))

vi.mock('../frontend/src/composables/useI18n.ts', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('../frontend/src/stores/index.ts', () => ({
  useChatStore: () => mockChatStore,
  useSettingsStore: () => mockSettingsStore,
}))

vi.mock('../frontend/src/utils/index.ts', () => ({
  copyToClipboard: vi.fn(),
}))

vi.mock('../frontend/src/utils/conversationTitle.ts', () => ({
  generateConversationTitleFromMessages: vi.fn(() => ''),
}))

import { useAppShell } from '../frontend/src/composables/useAppShell'

describe('useAppShell settings navigation', () => {
  beforeEach(() => {
    mockChatStore.configId = ''
    mockChatStore.currentConfig = null
    mockSettingsStore.showSettings.mockReset()
  })

  it('opens channel settings when no model configuration is available', () => {
    const shell = useAppShell()

    shell.handleShowSettings()

    expect(mockSettingsStore.showSettings).toHaveBeenCalledWith('channel')
  })

  it('keeps the restored settings tab when model configuration is available', () => {
    mockChatStore.configId = 'openai'
    mockChatStore.currentConfig = { id: 'openai' }

    const shell = useAppShell()

    shell.handleShowSettings()

    expect(mockSettingsStore.showSettings).toHaveBeenCalledWith()
  })
})
