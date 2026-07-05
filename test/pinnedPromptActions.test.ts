import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockSendToExtension } = vi.hoisted(() => ({
  mockSendToExtension: vi.fn()
}))

vi.mock('../frontend/src/utils/vscode.ts', () => ({
  sendToExtension: mockSendToExtension
}))

import {
  resolveDefaultPinnedPromptForNewConversation,
  setPinnedPrompt
} from '../frontend/src/stores/chat/pinnedPromptActions'
import type { ChatStoreState } from '../frontend/src/stores/chat/types'

function createState(overrides: Partial<ChatStoreState> = {}): ChatStoreState {
  return {
    pinnedPrompt: { value: { mode: 'none' } },
    pinnedPromptFromWorkspaceDefault: { value: false },
    currentConversationId: { value: null },
    ...overrides
  } as unknown as ChatStoreState
}

describe('resolveDefaultPinnedPromptForNewConversation', () => {
  beforeEach(() => {
    mockSendToExtension.mockReset()
  })

  it('applies the remembered workspace skill selection', async () => {
    mockSendToExtension.mockResolvedValue({ default: { mode: 'skill', skillId: 'skill.review' } })

    const result = await resolveDefaultPinnedPromptForNewConversation()

    expect(result).toEqual({
      pinnedPrompt: { mode: 'skill', skillId: 'skill.review' },
      fromWorkspaceDefault: true
    })
  })

  it('applies the remembered workspace preset selection', async () => {
    mockSendToExtension.mockResolvedValue({ default: { mode: 'preset', presetId: 'prompt-review' } })

    const result = await resolveDefaultPinnedPromptForNewConversation()

    expect(result).toEqual({
      pinnedPrompt: { mode: 'preset', presetId: 'prompt-review' },
      fromWorkspaceDefault: true
    })
  })

  it('falls back to none when no workspace default exists', async () => {
    mockSendToExtension.mockResolvedValue({ default: null })

    const result = await resolveDefaultPinnedPromptForNewConversation()

    expect(result).toEqual({
      pinnedPrompt: { mode: 'none' },
      fromWorkspaceDefault: false
    })
  })

  it('falls back to none when the request fails', async () => {
    mockSendToExtension.mockRejectedValue(new Error('boom'))

    const result = await resolveDefaultPinnedPromptForNewConversation()

    expect(result).toEqual({
      pinnedPrompt: { mode: 'none' },
      fromWorkspaceDefault: false
    })
  })
})

describe('setPinnedPrompt workspace default sync', () => {
  beforeEach(() => {
    mockSendToExtension.mockReset()
    mockSendToExtension.mockResolvedValue({ success: true })
  })

  it('remembers a skill selection at the workspace level', async () => {
    const state = createState()

    await setPinnedPrompt(state, { mode: 'skill', skillId: 'skill.review' })

    expect(mockSendToExtension).toHaveBeenCalledWith('setPinnedPromptWorkspaceDefault', {
      value: { mode: 'skill', skillId: 'skill.review' }
    })
    expect(state.pinnedPromptFromWorkspaceDefault.value).toBe(false)
  })

  it('clears the workspace default when the pinned prompt is cleared', async () => {
    const state = createState()

    await setPinnedPrompt(state, { mode: 'none' })

    expect(mockSendToExtension).toHaveBeenCalledWith('setPinnedPromptWorkspaceDefault', { value: null })
  })

  it('remembers a preset selection at the workspace level', async () => {
    const state = createState()

    await setPinnedPrompt(state, { mode: 'preset', presetId: 'prompt-review' })

    expect(mockSendToExtension).toHaveBeenCalledWith('setPinnedPromptWorkspaceDefault', {
      value: { mode: 'preset', presetId: 'prompt-review' }
    })
  })

  it('does not touch the workspace default for ad-hoc custom text', async () => {
    const state = createState()

    await setPinnedPrompt(state, { mode: 'custom', customPrompt: 'temporary text' })

    expect(mockSendToExtension).not.toHaveBeenCalledWith(
      'setPinnedPromptWorkspaceDefault',
      expect.anything()
    )
  })
})
