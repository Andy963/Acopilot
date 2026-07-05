import { describe, expect, it } from 'vitest';

import { MemorySettingsStorage } from '../backend/modules/settings/storage';
import { SettingsManager } from '../backend/modules/settings/SettingsManager';

async function createSettingsManager(): Promise<SettingsManager> {
  const manager = new SettingsManager(new MemorySettingsStorage());
  await manager.initialize();
  return manager;
}

describe('SettingsManager pinned prompt workspace default', () => {
  it('returns null when no default has been set for a workspace', async () => {
    const settingsManager = await createSettingsManager();

    expect(settingsManager.getPinnedPromptWorkspaceDefault('file:///workspace-a')).toBeNull();
  });

  it('persists and retrieves a per-workspace skill selection', async () => {
    const settingsManager = await createSettingsManager();

    await settingsManager.setPinnedPromptWorkspaceDefault('file:///workspace-a', {
      mode: 'skill',
      skillId: 'skill.review'
    });

    expect(settingsManager.getPinnedPromptWorkspaceDefault('file:///workspace-a')).toEqual({
      mode: 'skill',
      skillId: 'skill.review'
    });
    expect(settingsManager.getPinnedPromptWorkspaceDefault('file:///workspace-b')).toBeNull();
  });

  it('persists and retrieves a per-workspace preset selection', async () => {
    const settingsManager = await createSettingsManager();

    await settingsManager.setPinnedPromptWorkspaceDefault('file:///workspace-a', {
      mode: 'preset',
      presetId: 'prompt-review'
    });

    expect(settingsManager.getPinnedPromptWorkspaceDefault('file:///workspace-a')).toEqual({
      mode: 'preset',
      presetId: 'prompt-review'
    });
  });

  it('persists pinned prompt presets globally', async () => {
    const settingsManager = await createSettingsManager();

    await settingsManager.updatePinnedPromptPresets([
      {
        id: 'prompt-review',
        name: 'Review',
        prompt: 'Review code carefully.'
      }
    ]);

    expect(settingsManager.getPinnedPromptPresets()).toEqual([
      {
        id: 'prompt-review',
        name: 'Review',
        prompt: 'Review code carefully.'
      }
    ]);
  });

  it('clears a workspace default without disturbing other workspaces', async () => {
    const settingsManager = await createSettingsManager();

    await settingsManager.setPinnedPromptWorkspaceDefault('file:///workspace-a', {
      mode: 'skill',
      skillId: 'skill.review'
    });
    await settingsManager.setPinnedPromptWorkspaceDefault('file:///workspace-b', {
      mode: 'skill',
      skillId: 'skill.docs'
    });

    await settingsManager.setPinnedPromptWorkspaceDefault('file:///workspace-a', null);

    expect(settingsManager.getPinnedPromptWorkspaceDefault('file:///workspace-a')).toBeNull();
    expect(settingsManager.getPinnedPromptWorkspaceDefault('file:///workspace-b')).toEqual({
      mode: 'skill',
      skillId: 'skill.docs'
    });
  });

  it('survives re-initialization from the same persisted storage', async () => {
    const storage = new MemorySettingsStorage();
    const firstManager = new SettingsManager(storage);
    await firstManager.initialize();
    await firstManager.setPinnedPromptWorkspaceDefault('file:///workspace-a', {
      mode: 'skill',
      skillId: 'skill.review'
    });

    const secondManager = new SettingsManager(storage);
    await secondManager.initialize();

    expect(secondManager.getPinnedPromptWorkspaceDefault('file:///workspace-a')).toEqual({
      mode: 'skill',
      skillId: 'skill.review'
    });
  });
});
