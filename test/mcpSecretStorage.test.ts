import { describe, expect, it } from 'vitest';

import { InMemoryMcpStorageAdapter, McpManager } from '../backend/modules/mcp';

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

describe('McpManager SecretStorage stdio env handling', () => {
  it('stores stdio env in SecretStorage and strips it from persisted config on create', async () => {
    const storage = new InMemoryMcpStorageAdapter();
    const secrets = new InMemorySecretStorage();
    const manager = new McpManager(storage, secrets);

    await manager.createServer(
      {
        name: 'Test Server',
        transport: {
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@example/mcp-server'],
          env: { TOKEN: 'test-token' },
        },
        enabled: true,
        autoConnect: false,
        timeout: 30_000,
      } as any,
      'srv-1'
    );

    const secretKey = 'acopilot.mcp.stdio.env.srv-1';
    const secretValue = await secrets.get(secretKey);
    expect(secretValue).toBeTruthy();
    expect(JSON.parse(secretValue as string)).toEqual({ TOKEN: 'test-token' });

    const persisted = await storage.getConfig('srv-1');
    expect(persisted).not.toBeNull();
    expect((persisted as any).transport?.env).toBeUndefined();
  });

  it('migrates plaintext stdio env from storage into SecretStorage on initialize', async () => {
    const storage = new InMemoryMcpStorageAdapter();
    const secrets = new InMemorySecretStorage();

    await storage.saveConfig({
      id: 'srv-2',
      name: 'Legacy Server',
      transport: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@example/mcp-server'],
        env: { TOKEN: 'legacy-token' },
      },
      enabled: true,
      autoConnect: false,
      createdAt: 1,
      updatedAt: 1,
    } as any);

    const manager = new McpManager(storage, secrets);
    await manager.initialize();

    const loaded = await manager.getServer('srv-2');
    expect(loaded).not.toBeNull();
    expect((loaded as any).transport?.env).toEqual({ TOKEN: 'legacy-token' });

    const secretKey = 'acopilot.mcp.stdio.env.srv-2';
    expect(JSON.parse((await secrets.get(secretKey)) as string)).toEqual({ TOKEN: 'legacy-token' });

    const persisted = await storage.getConfig('srv-2');
    expect((persisted as any).transport?.env).toBeUndefined();
  });

  it('updates stdio env secret on update and does not persist env', async () => {
    const storage = new InMemoryMcpStorageAdapter();
    const secrets = new InMemorySecretStorage();
    const manager = new McpManager(storage, secrets);

    await manager.createServer(
      {
        name: 'Test Server',
        transport: {
          type: 'stdio',
          command: 'npx',
          env: { TOKEN: 'token-1' },
        },
        enabled: true,
        autoConnect: false,
      } as any,
      'srv-3'
    );

    await manager.updateServer('srv-3', {
      transport: {
        type: 'stdio',
        command: 'npx',
        env: { TOKEN: 'token-2' },
      },
    } as any);

    const secretKey = 'acopilot.mcp.stdio.env.srv-3';
    expect(JSON.parse((await secrets.get(secretKey)) as string)).toEqual({ TOKEN: 'token-2' });

    const persisted = await storage.getConfig('srv-3');
    expect((persisted as any).transport?.env).toBeUndefined();
  });

  it('deletes stdio env secret when deleting server', async () => {
    const storage = new InMemoryMcpStorageAdapter();
    const secrets = new InMemorySecretStorage();
    const manager = new McpManager(storage, secrets);

    await manager.createServer(
      {
        name: 'Test Server',
        transport: {
          type: 'stdio',
          command: 'npx',
          env: { TOKEN: 'test-token' },
        },
        enabled: true,
        autoConnect: false,
      } as any,
      'srv-4'
    );

    const secretKey = 'acopilot.mcp.stdio.env.srv-4';
    expect(await secrets.get(secretKey)).toBeTruthy();

    await manager.deleteServer('srv-4');
    expect(await secrets.get(secretKey)).toBeUndefined();
  });
});

