import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({
  Uri: {
    file: (fsPath: string) => ({
      fsPath,
      toString: () => `file://${fsPath}`,
    }),
  },
}));

import { StoragePathManager } from '../backend/modules/settings/StoragePathManager';

type StoragePathConfig = {
  customDataPath?: string;
  migrationStatus?: 'none' | 'pending' | 'in_progress' | 'completed' | 'failed';
  lastMigrationAt?: number;
  migrationError?: string;
};

class FakeSettingsManager {
  constructor(private config: StoragePathConfig = {}) {}

  getStoragePathConfig(): StoragePathConfig {
    return { ...this.config };
  }

  async updateStoragePathConfig(next: Partial<StoragePathConfig>): Promise<void> {
    this.config = { ...this.config, ...next };
  }

  async markMigrationStarted(): Promise<void> {
    this.config = { ...this.config, migrationStatus: 'in_progress' };
  }

  async markMigrationFailed(error: string): Promise<void> {
    this.config = { ...this.config, migrationStatus: 'failed', migrationError: error };
  }
}

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'acopilot-storage-'));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

function createManager(defaultDataPath: string, settingsManager: FakeSettingsManager): StoragePathManager {
  return new StoragePathManager(settingsManager as any, {
    globalStorageUri: { fsPath: defaultDataPath },
  } as any);
}

describe('StoragePathManager migrate/reset boundary', () => {
  it('does not create or report the removed MCP storage directory', async () => {
    await withTempDir(async (root) => {
      const defaultDataPath = path.join(root, 'default-data');
      const manager = createManager(defaultDataPath, new FakeSettingsManager());

      await manager.ensureDirectories();

      await expect(fs.access(path.join(defaultDataPath, 'mcp'))).rejects.toBeDefined();
      const stats = await manager.getStorageStats();
      expect(stats.subDirs).not.toHaveProperty('mcp');
    });
  });

  it('rejects custom paths inside managed storage subdirectories', async () => {
    await withTempDir(async (root) => {
      const defaultDataPath = path.join(root, 'default-data');
      await fs.mkdir(path.join(defaultDataPath, 'conversations'), { recursive: true });

      const settingsManager = new FakeSettingsManager();
      const manager = createManager(defaultDataPath, settingsManager);

      const result = await manager.validatePath(path.join(defaultDataPath, 'conversations'));

      expect(result.valid).toBe(false);
      expect(result.error).toContain('managed storage subdirectory');
    });
  });

  it('uses the effective storage boundary after migrate and reset across reloads', async () => {
    await withTempDir(async (root) => {
      const defaultDataPath = path.join(root, 'default-data');
      const customDataPath = path.join(root, 'custom-data');
      const conversationId = 'conv-1';

      await fs.mkdir(path.join(defaultDataPath, 'conversations'), { recursive: true });
      await fs.writeFile(path.join(defaultDataPath, 'conversations', `${conversationId}.json`), '[]');

      const settingsManager = new FakeSettingsManager();
      const manager = createManager(defaultDataPath, settingsManager);

      const migrateResult = await manager.migrateData(customDataPath);
      expect(migrateResult.success).toBe(true);

      const reloadedAfterMigrate = createManager(defaultDataPath, settingsManager);
      expect(reloadedAfterMigrate.getEffectiveDataPath()).toBe(customDataPath);
      expect(reloadedAfterMigrate.getConversationsPath()).toBe(path.join(customDataPath, 'conversations'));
      await expect(fs.readFile(path.join(customDataPath, 'conversations', `${conversationId}.json`), 'utf8')).resolves.toBe('[]');

      const resetResult = await reloadedAfterMigrate.resetToDefault();
      expect(resetResult.success).toBe(true);

      const reloadedAfterReset = createManager(defaultDataPath, settingsManager);
      expect(reloadedAfterReset.getEffectiveDataPath()).toBe(defaultDataPath);
      expect(reloadedAfterReset.getConversationsPath()).toBe(path.join(defaultDataPath, 'conversations'));
      await expect(fs.readFile(path.join(defaultDataPath, 'conversations', `${conversationId}.json`), 'utf8')).resolves.toBe('[]');
    });
  });
});
