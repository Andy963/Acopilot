import { describe, expect, it } from 'vitest';

import { setGlobalSettingsManager } from '../backend/core/settingsContext';
import { MemorySettingsStorage } from '../backend/modules/settings/storage';
import { SettingsManager } from '../backend/modules/settings/SettingsManager';
import {
  applyPinnedPromptPlaceholders,
  getPinnedPromptBlock,
  getPinnedPromptBlocks,
  getPinnedPromptInjectedInfo
} from '../backend/modules/api/chat/services/pinnedPrompt';
import type { ConversationManager } from '../backend/modules/conversation/ConversationManager';

async function createSettingsManager(): Promise<SettingsManager> {
  const manager = new SettingsManager(new MemorySettingsStorage());
  await manager.initialize();
  return manager;
}

function createConversationManager(metadata: Record<string, unknown>): ConversationManager {
  return {
    getCustomMetadata: async (_conversationId: string, key: string) => metadata[key]
  } as unknown as ConversationManager;
}

describe('pinned prompt preset injection', () => {
  it('injects a selected reusable prompt preset from global settings', async () => {
    const settingsManager = await createSettingsManager();
    await settingsManager.updatePinnedPromptPresets([
      {
        id: 'prompt-review',
        name: 'Review',
        prompt: 'Review code carefully.'
      }
    ]);
    setGlobalSettingsManager(settingsManager);

    const conversationManager = createConversationManager({
      pinnedPrompt: {
        mode: 'preset',
        presetId: 'prompt-review'
      }
    });

    await expect(getPinnedPromptBlock(conversationManager, 'conversation-1')).resolves.toBe(
      '====\n\nPINNED PROMPT: Review\n\nReview code carefully.'
    );
    await expect(getPinnedPromptInjectedInfo(conversationManager, 'conversation-1')).resolves.toEqual({
      mode: 'preset',
      presetId: 'prompt-review',
      presetName: 'Review',
      count: 1,
      prompts: [
        {
          id: 'preset:prompt-review',
          mode: 'preset',
          presetId: 'prompt-review',
          presetName: 'Review',
          name: 'PINNED PROMPT: Review'
        }
      ]
    });
  });

  it('renders multiple pinned prompts in explicit order', async () => {
    const settingsManager = await createSettingsManager();
    await settingsManager.updateSystemPromptConfig({
      skills: [
        { id: 'skill-review', name: 'Review Skill', prompt: 'Use review rules.' }
      ]
    });
    await settingsManager.updatePinnedPromptPresets([
      { id: 'prompt-safety', name: 'Safety', prompt: 'Use safety rules.' }
    ]);
    setGlobalSettingsManager(settingsManager);

    const conversationManager = createConversationManager({
      pinnedPrompts: [
        { id: 'preset:safety', mode: 'preset', presetId: 'prompt-safety', order: 2 },
        { id: 'skill:review', mode: 'skill', skillId: 'skill-review', order: 1 },
        { id: 'custom:extra', mode: 'custom', customPrompt: 'Use custom rules.', name: 'Extra', order: 3 }
      ]
    });

    await expect(getPinnedPromptBlock(conversationManager, 'conversation-1')).resolves.toBe(
      [
        '====\n\nSKILL: Review Skill\n\nUse review rules.',
        '====\n\nPINNED PROMPT: Safety\n\nUse safety rules.',
        '====\n\nPINNED PROMPT: Extra\n\nUse custom rules.'
      ].join('\n\n')
    );
    await expect(getPinnedPromptInjectedInfo(conversationManager, 'conversation-1')).resolves.toMatchObject({
      mode: 'multiple',
      count: 3,
      prompts: [
        { id: 'skill:review', mode: 'skill' },
        { id: 'preset:safety', mode: 'preset' },
        { id: 'custom:extra', mode: 'custom' }
      ]
    });
  });

  it('places all pinned prompts at the aggregate placeholder', async () => {
    const blocks = [
      { id: 'a', mode: 'custom' as const, title: 'PINNED PROMPT: A', prompt: 'Alpha' },
      { id: 'b', mode: 'custom' as const, title: 'PINNED PROMPT: B', prompt: 'Beta' }
    ];

    expect(applyPinnedPromptPlaceholders('before\n{{$PINNED_PROMPTS}}\nafter', blocks)).toBe(
      'before\n====\n\nPINNED PROMPT: A\n\nAlpha\n\n====\n\nPINNED PROMPT: B\n\nBeta\nafter'
    );
  });

  it('places named pinned prompts once and renders remaining prompts at the aggregate placeholder', async () => {
    const blocks = [
      { id: 'a', mode: 'custom' as const, title: 'PINNED PROMPT: A', prompt: 'Alpha' },
      { id: 'b', mode: 'custom' as const, title: 'PINNED PROMPT: B', prompt: 'Beta' }
    ];

    expect(applyPinnedPromptPlaceholders('{{$PINNED_PROMPT:b}}\n---\n{{$PINNED_PROMPTS}}', blocks)).toBe(
      '====\n\nPINNED PROMPT: B\n\nBeta\n---\n====\n\nPINNED PROMPT: A\n\nAlpha'
    );
  });

  it('prepends pinned prompts when no placeholder exists', async () => {
    const blocks = [
      { id: 'a', mode: 'custom' as const, title: 'PINNED PROMPT: A', prompt: 'Alpha' }
    ];

    expect(applyPinnedPromptPlaceholders('Base prompt', blocks)).toBe(
      '====\n\nPINNED PROMPT: A\n\nAlpha\n\nBase prompt'
    );
  });

  it('uses pinnedPrompts before the legacy pinnedPrompt field', async () => {
    const settingsManager = await createSettingsManager();
    await settingsManager.updatePinnedPromptPresets([
      { id: 'new', name: 'New', prompt: 'New prompt.' },
      { id: 'legacy', name: 'Legacy', prompt: 'Legacy prompt.' }
    ]);
    setGlobalSettingsManager(settingsManager);

    const conversationManager = createConversationManager({
      pinnedPrompts: [{ id: 'preset:new', mode: 'preset', presetId: 'new', order: 0 }],
      pinnedPrompt: { mode: 'preset', presetId: 'legacy' }
    });

    const blocks = await getPinnedPromptBlocks(conversationManager, 'conversation-1');
    expect(blocks.map(block => block.presetId)).toEqual(['new']);
  });
});
