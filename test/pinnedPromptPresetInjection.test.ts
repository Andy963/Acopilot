import { describe, expect, it } from 'vitest';

import { setGlobalSettingsManager } from '../backend/core/settingsContext';
import { MemorySettingsStorage } from '../backend/modules/settings/storage';
import { SettingsManager } from '../backend/modules/settings/SettingsManager';
import { getPinnedPromptBlock, getPinnedPromptInjectedInfo } from '../backend/modules/api/chat/services/pinnedPrompt';
import type { ConversationManager } from '../backend/modules/conversation/ConversationManager';

async function createSettingsManager(): Promise<SettingsManager> {
  const manager = new SettingsManager(new MemorySettingsStorage());
  await manager.initialize();
  return manager;
}

function createConversationManager(metadata: unknown): ConversationManager {
  return {
    getCustomMetadata: async () => metadata
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
      mode: 'preset',
      presetId: 'prompt-review'
    });

    await expect(getPinnedPromptBlock(conversationManager, 'conversation-1')).resolves.toBe(
      '====\n\nPINNED PROMPT: Review\n\nReview code carefully.'
    );
    await expect(getPinnedPromptInjectedInfo(conversationManager, 'conversation-1')).resolves.toEqual({
      mode: 'preset',
      presetId: 'prompt-review',
      presetName: 'Review'
    });
  });
});
