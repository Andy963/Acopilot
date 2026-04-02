import { describe, expect, it } from 'vitest';

import { ConfigManager, MemoryStorageAdapter, ensureDefaultConfig } from '../backend/modules/config';
import { MemorySettingsStorage } from '../backend/modules/settings/storage';
import { SettingsManager } from '../backend/modules/settings/SettingsManager';

class InMemorySecretStorage {
  private storeMap = new Map<string, string>();

  async get(key: string): Promise<string | undefined> {
    return this.storeMap.get(key);
  }

  async store(key: string, value: string): Promise<void> {
    this.storeMap.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.storeMap.delete(key);
  }
}

async function createSettingsManager(storage = new MemorySettingsStorage()): Promise<SettingsManager> {
  const manager = new SettingsManager(storage);
  await manager.initialize();
  return manager;
}

describe('default config bootstrap', () => {
  it('creates exactly one default config via ConfigManager and strips apiKey from persisted storage', async () => {
    const configStorage = new MemoryStorageAdapter();
    const secretStorage = new InMemorySecretStorage();
    const settingsManager = await createSettingsManager();
    const configManager = new ConfigManager(configStorage, secretStorage);

    await ensureDefaultConfig(configManager, settingsManager, { geminiApiKey: 'bootstrap-secret' });

    const configs = await configManager.listConfigs();
    expect(configs).toHaveLength(1);
    expect(configs[0]?.name).toBe('Gemini(Default)');
    expect(configs[0]?.type).toBe('gemini');
    expect(configs[0]?.apiKey).toBe('bootstrap-secret');
    expect(settingsManager.getActiveChannelId()).toBe(configs[0]?.id);

    const persisted = await configStorage.load(configs[0]!.id);
    expect(persisted).not.toBeNull();
    expect((persisted as any).apiKey).toBe('');
  });

  it('does not create duplicate default configs when re-initializing persisted state', async () => {
    const configStorage = new MemoryStorageAdapter();
    const settingsStorage = new MemorySettingsStorage();
    const secretStorage = new InMemorySecretStorage();

    const firstSettingsManager = await createSettingsManager(settingsStorage);
    const firstConfigManager = new ConfigManager(configStorage, secretStorage);
    await ensureDefaultConfig(firstConfigManager, firstSettingsManager, { geminiApiKey: 'bootstrap-secret' });

    const initialConfigs = await firstConfigManager.listConfigs();
    expect(initialConfigs).toHaveLength(1);

    const secondSettingsManager = await createSettingsManager(settingsStorage);
    const secondConfigManager = new ConfigManager(configStorage, secretStorage);
    await ensureDefaultConfig(secondConfigManager, secondSettingsManager, { geminiApiKey: 'another-secret' });

    const finalConfigs = await secondConfigManager.listConfigs();
    expect(finalConfigs).toHaveLength(1);
    expect(finalConfigs[0]?.id).toBe(initialConfigs[0]?.id);
    expect(finalConfigs[0]?.apiKey).toBe('bootstrap-secret');
    expect(secondSettingsManager.getActiveChannelId()).toBe(initialConfigs[0]?.id);
  });
});
