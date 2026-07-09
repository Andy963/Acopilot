import type {
  GlobalSettings,
  SettingsChangeEvent,
  SettingsChangeListener,
  StoragePathConfig,
  ToolsConfig,
} from '../types';
import { DEFAULT_GLOBAL_SETTINGS, DEFAULT_MAX_TOOL_ITERATIONS } from '../types';

export interface SettingsStorage {
  load(): Promise<GlobalSettings | null>;
  save(settings: GlobalSettings): Promise<void>;
}

export class SettingsManagerBase {
  protected settings: GlobalSettings;
  protected listeners: Set<SettingsChangeListener> = new Set();
  protected storage: SettingsStorage;

  constructor(storage: SettingsStorage) {
    this.storage = storage;
    this.settings = { ...DEFAULT_GLOBAL_SETTINGS };
  }

  protected ensureToolsConfig(): ToolsConfig {
    if (!this.settings.toolsConfig) {
      this.settings.toolsConfig = {};
    }
    return this.settings.toolsConfig;
  }

  protected async commitChange(event: Omit<SettingsChangeEvent, 'settings'>): Promise<void> {
    this.settings.lastUpdated = Date.now();
    await this.storage.save(this.settings);
    this.notifyChange({ ...event, settings: this.settings });
  }

  protected async updateToolsConfigEntry<T extends Record<string, unknown>>(
    toolKey: string,
    oldConfig: T,
    updates: Partial<T>
  ): Promise<T> {
    const newConfig = {
      ...oldConfig,
      ...updates,
    } as T;

    this.ensureToolsConfig()[toolKey] = newConfig as any;

    await this.commitChange({
      type: 'tools',
      path: `toolsConfig.${toolKey}`,
      oldValue: oldConfig,
      newValue: newConfig,
    });

    return newConfig;
  }

  async initialize(): Promise<void> {
    const stored = await this.storage.load();
    if (stored) {
      this.settings = {
        ...DEFAULT_GLOBAL_SETTINGS,
        ...stored,
        toolsEnabled: {
          ...DEFAULT_GLOBAL_SETTINGS.toolsEnabled,
          ...stored.toolsEnabled,
        },
        toolAutoExec: {
          ...DEFAULT_GLOBAL_SETTINGS.toolAutoExec,
          ...stored.toolAutoExec,
        },
        toolsConfig: {
          ...DEFAULT_GLOBAL_SETTINGS.toolsConfig,
          ...stored.toolsConfig,
        },
      };
    }
  }

  getSettings(): Readonly<GlobalSettings> {
    return { ...this.settings };
  }

  async updateSettings(updates: Partial<GlobalSettings>): Promise<void> {
    const oldSettings = { ...this.settings };

    this.settings = {
      ...this.settings,
      ...updates,
      lastUpdated: Date.now(),
    };

    await this.storage.save(this.settings);

    this.notifyChange({
      type: 'full',
      oldValue: oldSettings,
      newValue: this.settings,
      settings: this.settings,
    });
  }

  getMaxToolIterations(): number {
    return this.settings.maxToolIterations ?? DEFAULT_MAX_TOOL_ITERATIONS;
  }

  async setMaxToolIterations(value: number): Promise<void> {
    const safeValue = value === -1 ? -1 : Math.max(1, value);
    const oldValue = this.settings.maxToolIterations;
    this.settings.maxToolIterations = safeValue;

    await this.commitChange({
      type: 'tools',
      path: 'maxToolIterations',
      oldValue,
      newValue: safeValue,
    });
  }

  getActiveChannelId(): string | undefined {
    return this.settings.activeChannelId;
  }

  async setActiveChannelId(channelId: string): Promise<void> {
    const oldValue = this.settings.activeChannelId;
    this.settings.activeChannelId = channelId;

    await this.commitChange({
      type: 'channel',
      path: 'activeChannelId',
      oldValue,
      newValue: channelId,
    });
  }

  getUISettings(): NonNullable<GlobalSettings['ui']> {
    return this.settings.ui || {};
  }

  async updateUISettings(uiSettings: Partial<NonNullable<GlobalSettings['ui']>>): Promise<void> {
    const oldValue = this.settings.ui;
    this.settings.ui = {
      ...this.settings.ui,
      ...uiSettings,
    };

    await this.commitChange({
      type: 'ui',
      path: 'ui',
      oldValue,
      newValue: this.settings.ui,
    });
  }

  addChangeListener(listener: SettingsChangeListener): void {
    this.listeners.add(listener);
  }

  removeChangeListener(listener: SettingsChangeListener): void {
    this.listeners.delete(listener);
  }

  private notifyChange(event: SettingsChangeEvent): void {
    for (const listener of this.listeners) {
      Promise.resolve(listener(event)).catch((error) => {
        console.error('Settings change listener error:', error);
      });
    }
  }

  getStoragePathConfig(): Readonly<StoragePathConfig> {
    return this.settings.storagePath || {};
  }

  getCustomDataPath(): string | undefined {
    return this.settings.storagePath?.customDataPath;
  }

  async updateStoragePathConfig(config: Partial<StoragePathConfig>): Promise<void> {
    const oldConfig = this.getStoragePathConfig();
    const newConfig = {
      ...oldConfig,
      ...config,
    };

    this.settings.storagePath = newConfig;

    await this.commitChange({
      type: 'full',
      path: 'storagePath',
      oldValue: oldConfig,
      newValue: newConfig,
    });
  }

  async setCustomDataPath(customPath: string | undefined): Promise<void> {
    await this.updateStoragePathConfig({
      customDataPath: customPath,
      migrationStatus: customPath ? 'pending' : 'none',
    });
  }

  async markMigrationStarted(): Promise<void> {
    await this.updateStoragePathConfig({
      migrationStatus: 'in_progress',
    });
  }

  async markMigrationCompleted(): Promise<void> {
    await this.updateStoragePathConfig({
      migrationStatus: 'completed',
      lastMigrationAt: Date.now(),
      migrationError: undefined,
    });
  }

  async markMigrationFailed(error: string): Promise<void> {
    await this.updateStoragePathConfig({
      migrationStatus: 'failed',
      migrationError: error,
    });
  }

  async reset(): Promise<void> {
    const oldSettings = { ...this.settings };
    this.settings = {
      ...DEFAULT_GLOBAL_SETTINGS,
      lastUpdated: Date.now(),
    };

    await this.storage.save(this.settings);

    this.notifyChange({
      type: 'full',
      oldValue: oldSettings,
      newValue: this.settings,
      settings: this.settings,
    });
  }
}

