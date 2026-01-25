import { describe, expect, it } from 'vitest';

import { ConfigManager, MemoryStorageAdapter } from '../backend/modules/config';

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

  keys(): string[] {
    return Array.from(this.storeMap.keys());
  }
}

describe('ConfigManager SecretStorage apiKey handling', () => {
  it('stores apiKey in SecretStorage and strips it from persisted config on create', async () => {
    const storage = new MemoryStorageAdapter();
    const secrets = new InMemorySecretStorage();
    const manager = new ConfigManager(storage, secrets);

    const configId = await manager.createConfig({
      name: 'OpenAI',
      type: 'openai',
      apiKey: 'test-api-key',
    } as any);

    const secretKey = `acopilot.config.apiKey.${configId}`;
    expect(await secrets.get(secretKey)).toBe('test-api-key');

    const persisted = await storage.load(configId);
    expect(persisted).not.toBeNull();
    expect((persisted as any).apiKey).toBe('');

    const loaded = await manager.getConfig(configId);
    expect(loaded).not.toBeNull();
    expect((loaded as any).apiKey).toBe('test-api-key');
  });

  it('migrates plaintext apiKey from storage into SecretStorage on load', async () => {
    const storage = new MemoryStorageAdapter();
    const secrets = new InMemorySecretStorage();

    await storage.save({
      id: 'cfg-1',
      name: 'OpenAI',
      type: 'openai',
      enabled: true,
      timeout: 120000,
      url: 'https://api.openai.com/v1',
      apiKey: 'legacy-api-key',
      model: '',
      createdAt: 1,
      updatedAt: 1,
    } as any);

    const manager = new ConfigManager(storage, secrets);
    const loaded = await manager.getConfig('cfg-1');
    expect(loaded).not.toBeNull();
    expect((loaded as any).apiKey).toBe('legacy-api-key');

    const secretKey = 'acopilot.config.apiKey.cfg-1';
    expect(await secrets.get(secretKey)).toBe('legacy-api-key');

    const persisted = await storage.load('cfg-1');
    expect(persisted).not.toBeNull();
    expect((persisted as any).apiKey).toBe('');
  });

  it('does not persist apiKey when updating other fields', async () => {
    const storage = new MemoryStorageAdapter();
    const secrets = new InMemorySecretStorage();
    const manager = new ConfigManager(storage, secrets);

    const configId = await manager.createConfig({
      name: 'OpenAI',
      type: 'openai',
      apiKey: 'test-api-key',
    } as any);

    await manager.updateConfig(configId, { name: 'OpenAI Updated' } as any);

    const persisted = await storage.load(configId);
    expect((persisted as any).apiKey).toBe('');
  });

  it('deletes apiKey secret when deleting config', async () => {
    const storage = new MemoryStorageAdapter();
    const secrets = new InMemorySecretStorage();
    const manager = new ConfigManager(storage, secrets);

    const configId = await manager.createConfig({
      name: 'OpenAI',
      type: 'openai',
      apiKey: 'test-api-key',
    } as any);

    const secretKey = `acopilot.config.apiKey.${configId}`;
    expect(await secrets.get(secretKey)).toBe('test-api-key');

    await manager.deleteConfig(configId);
    expect(await secrets.get(secretKey)).toBeUndefined();
  });
});
