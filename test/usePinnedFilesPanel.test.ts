import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('vue', () => ({
  ref: (value: any) => ({ value }),
  computed: (getter: any) => ({
    get value() {
      return getter()
    },
  }),
  watch: () => {},
}))

const { mockChatStore, mockSendToExtension, mockShowNotification } = vi.hoisted(() => ({
  mockChatStore: {
    pinnedPrompt: { mode: 'none' as const },
    setPinnedPrompt: vi.fn().mockResolvedValue(undefined),
  },
  mockSendToExtension: vi.fn(),
  mockShowNotification: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../frontend/src/stores/index.ts', () => ({
  useChatStore: () => mockChatStore,
}))

vi.mock('../frontend/src/utils/vscode.ts', () => ({
  sendToExtension: mockSendToExtension,
  showNotification: mockShowNotification,
}))

vi.mock('../frontend/src/i18n/index.ts', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

import { usePinnedFilesPanel } from '../frontend/src/components/input/usePinnedFilesPanel'

describe('usePinnedFilesPanel pinned prompt flow', () => {
  beforeEach(() => {
    mockChatStore.pinnedPrompt = { mode: 'none' }
    mockChatStore.setPinnedPrompt.mockReset()
    mockChatStore.setPinnedPrompt.mockResolvedValue(undefined)
    mockSendToExtension.mockReset()
    mockShowNotification.mockReset()
    mockShowNotification.mockResolvedValue(undefined)
  })

  it('hydrates the custom prompt draft from the store metadata', async () => {
    mockChatStore.pinnedPrompt = {
      mode: 'custom',
      customPrompt: 'Remember the pinned prompt',
    }
    mockSendToExtension.mockImplementation(async (type: string) => {
      if (type === 'getPinnedFilesConfig') return { files: [] }
      if (type === 'skills.list') return { skills: [] }
      if (type === 'pinnedPromptPresets.list') return { presets: [] }
      throw new Error(`Unexpected request: ${type}`)
    })

    const panel = usePinnedFilesPanel({ visible: true }, vi.fn() as any)

    await panel.openPanel()

    expect(panel.pinPanelTab.value).toBe('custom')
    expect(panel.customPromptDraft.value).toBe('Remember the pinned prompt')
  })

  it('defaults to the custom tab when no pinned prompt mode is active', async () => {
    mockChatStore.pinnedPrompt = { mode: 'none' }
    mockSendToExtension.mockImplementation(async (type: string) => {
      if (type === 'getPinnedFilesConfig') return { files: [] }
      if (type === 'skills.list') return { skills: [] }
      if (type === 'pinnedPromptPresets.list') return { presets: [] }
      throw new Error(`Unexpected request: ${type}`)
    })

    const panel = usePinnedFilesPanel({ visible: true }, vi.fn() as any)

    await panel.openPanel()

    expect(panel.pinPanelTab.value).toBe('custom')
  })

  it('opens directly to the skill tab when a skill is pinned', async () => {
    mockChatStore.pinnedPrompt = { mode: 'skill', skillId: 'skill.review' }
    mockSendToExtension.mockImplementation(async (type: string) => {
      if (type === 'getPinnedFilesConfig') return { files: [] }
      if (type === 'skills.list') return { skills: [] }
      if (type === 'pinnedPromptPresets.list') return { presets: [] }
      throw new Error(`Unexpected request: ${type}`)
    })

    const panel = usePinnedFilesPanel({ visible: true }, vi.fn() as any)

    await panel.openPanel()

    expect(panel.pinPanelTab.value).toBe('skill')
  })

  it('saves a custom pinned prompt via chatStore using customPrompt', async () => {
    const panel = usePinnedFilesPanel({ visible: false }, vi.fn() as any)
    panel.pinPanelTab.value = 'custom'
    panel.customPromptDraft.value = '  Keep answers concise  '

    await panel.handleSavePinnedPrompt()

    expect(mockChatStore.setPinnedPrompt).toHaveBeenCalledWith({
      mode: 'custom',
      customPrompt: 'Keep answers concise',
    })
    expect(panel.customPromptDraft.value).toBe('Keep answers concise')
    expect(mockSendToExtension).not.toHaveBeenCalled()
    expect(mockShowNotification).toHaveBeenCalledWith(
      'components.input.notifications.pinnedPromptSaved',
      'info',
    )
  })

  it('saves a pinned skill without leaking a prompt payload', async () => {
    const panel = usePinnedFilesPanel({ visible: false }, vi.fn() as any)
    panel.pinPanelTab.value = 'skill'
    panel.skills.value = [
      {
        id: 'skill.review',
        name: 'Review',
        prompt: 'Review code carefully.',
      },
    ]
    panel.handleSelectSkill('skill.review')

    await panel.handleSavePinnedPrompt()

    expect(mockChatStore.setPinnedPrompt).toHaveBeenCalledWith({
      mode: 'skill',
      skillId: 'skill.review',
    })
    expect(mockSendToExtension).not.toHaveBeenCalled()
  })

  it('saves the custom draft as a reusable prompt preset and selects it', async () => {
    mockSendToExtension.mockImplementation(async (type: string) => {
      if (type === 'pinnedPromptPresets.save') {
        return {
          preset: {
            id: 'prompt-tdd-reminder',
            name: 'TDD Reminder',
            prompt: 'Always write tests first',
          },
          presets: [
            {
              id: 'prompt-tdd-reminder',
              name: 'TDD Reminder',
              prompt: 'Always write tests first',
            },
          ],
        }
      }
      throw new Error(`Unexpected request: ${type}`)
    })

    const panel = usePinnedFilesPanel({ visible: false }, vi.fn() as any)
    panel.pinPanelTab.value = 'custom'
    panel.customPromptDraft.value = 'Always write tests first'
    panel.presetNameDraft.value = 'TDD Reminder'

    await panel.handleSaveCustomPromptAsPreset()

    expect(mockSendToExtension).toHaveBeenCalledWith('pinnedPromptPresets.save', {
      preset: {
        id: undefined,
        name: 'TDD Reminder',
        prompt: 'Always write tests first',
      },
    })
    expect(mockChatStore.setPinnedPrompt).toHaveBeenCalledWith({
      mode: 'preset',
      presetId: 'prompt-tdd-reminder',
    })
    expect(panel.selectedPresetId.value).toBe('prompt-tdd-reminder')
    expect(panel.pinPanelTab.value).toBe('custom')
    expect(panel.presetNameDraft.value).toBe('TDD Reminder')
  })

  it('selects an existing reusable prompt preset', async () => {
    const panel = usePinnedFilesPanel({ visible: false }, vi.fn() as any)
    panel.presets.value = [
      {
        id: 'prompt-review',
        name: 'Review',
        prompt: 'Review code carefully.',
      },
    ]

    await panel.handleSelectPreset('prompt-review')

    expect(panel.customPromptDraft.value).toBe('Review code carefully.')
    expect(panel.presetNameDraft.value).toBe('Review')
    expect(mockChatStore.setPinnedPrompt).toHaveBeenCalledWith({
      mode: 'preset',
      presetId: 'prompt-review',
    })
  })

  it('clears the pinned prompt via chatStore', async () => {
    const panel = usePinnedFilesPanel({ visible: false }, vi.fn() as any)
    panel.customPromptDraft.value = 'Temporary prompt'

    await panel.handleClearPinnedPrompt()

    expect(mockChatStore.setPinnedPrompt).toHaveBeenCalledWith({ mode: 'none' })
    expect(panel.customPromptDraft.value).toBe('')
    expect(mockSendToExtension).not.toHaveBeenCalled()
    expect(mockShowNotification).toHaveBeenCalledWith(
      'components.input.notifications.pinnedPromptCleared',
      'info',
    )
  })
})
