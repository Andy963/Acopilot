import type { McpEvent, McpEventListener, McpEventType, McpServerConfig, McpServerInfo, McpServerStatus, McpStorageAdapter } from '../types';
import type { StdioMcpClient } from '../StdioClient';
import type { HttpMcpClient } from '../HttpClient';

type SecretStorage = {
  get(key: string): Thenable<string | undefined>;
  store(key: string, value: string): Thenable<void>;
  delete(key: string): Thenable<void>;
};

const MCP_STDIO_ENV_SECRET_PREFIX = 'acopilot.mcp.stdio.env.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!isRecord(value)) return false;
  for (const v of Object.values(value)) {
    if (typeof v !== 'string') return false;
  }
  return true;
}

export class McpManagerBase {
  protected storageAdapter: McpStorageAdapter;
  protected secretStorage?: SecretStorage;

  protected servers: Map<string, McpServerInfo> = new Map();
  protected clients: Map<string, StdioMcpClient | HttpMcpClient> = new Map();
  protected listeners: Map<McpEventType, Set<McpEventListener>> = new Map();

  protected initialized = false;

  constructor(storageAdapter: McpStorageAdapter, secretStorage?: SecretStorage) {
    this.storageAdapter = storageAdapter;
    this.secretStorage = secretStorage;
  }

  protected getStdioEnvSecretKey(serverId: string): string {
    return `${MCP_STDIO_ENV_SECRET_PREFIX}${serverId}`;
  }

  protected async tryStoreSecret(key: string, value: string): Promise<boolean> {
    if (!this.secretStorage) return false;
    try {
      await this.secretStorage.store(key, value);
      return true;
    } catch {
      return false;
    }
  }

  protected async tryDeleteSecret(key: string): Promise<void> {
    if (!this.secretStorage) return;
    try {
      await this.secretStorage.delete(key);
    } catch {
      return;
    }
  }

  protected async tryGetSecret(key: string): Promise<string | undefined> {
    if (!this.secretStorage) return undefined;
    try {
      return await this.secretStorage.get(key);
    } catch {
      return undefined;
    }
  }

  protected stripStdioEnvForStorage(config: McpServerConfig): McpServerConfig {
    if (!this.secretStorage) return config;
    if (config.transport.type !== 'stdio') return config;

    const { env: _env, ...transport } = config.transport;
    return { ...config, transport: transport as McpServerConfig['transport'] };
  }

  protected hasPlaintextStdioEnv(config: McpServerConfig): boolean {
    if (config.transport.type !== 'stdio') return false;
    const env = config.transport.env;
    if (!isStringRecord(env)) return false;
    return Object.values(env).some((v) => String(v || '').trim().length > 0 && v !== '***REDACTED***');
  }

  protected async migrateAndHydrateStdioEnv(config: McpServerConfig): Promise<McpServerConfig> {
    if (!this.secretStorage) {
      return config;
    }

    if (config.transport.type !== 'stdio') {
      return config;
    }

    const secretKey = this.getStdioEnvSecretKey(config.id);
    const envFromConfig = config.transport.env;

    if (this.hasPlaintextStdioEnv(config)) {
      const stored = await this.tryStoreSecret(secretKey, JSON.stringify(envFromConfig));
      if (stored) {
        await this.storageAdapter.saveConfig(this.stripStdioEnvForStorage(config));
      }
    }

    const secretValue = await this.tryGetSecret(secretKey);
    if (!secretValue) {
      return config;
    }

    try {
      const parsed = JSON.parse(secretValue);
      if (!isStringRecord(parsed)) {
        return config;
      }

      return {
        ...config,
        transport: {
          ...config.transport,
          env: parsed,
        },
      };
    } catch {
      return config;
    }
  }

  protected async prepareConfigForStorage(config: McpServerConfig): Promise<McpServerConfig> {
    if (!this.secretStorage) {
      return config;
    }

    if (config.transport.type !== 'stdio') {
      await this.tryDeleteSecret(this.getStdioEnvSecretKey(config.id));
      return config;
    }

    const env = config.transport.env;
    const secretKey = this.getStdioEnvSecretKey(config.id);

    if (isStringRecord(env) && Object.keys(env).length > 0) {
      const stored = await this.tryStoreSecret(secretKey, JSON.stringify(env));
      if (stored) {
        return this.stripStdioEnvForStorage(config);
      }
      return config;
    }

    await this.tryDeleteSecret(secretKey);
    return this.stripStdioEnvForStorage(config);
  }

  addEventListener(type: McpEventType, listener: McpEventListener): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: McpEventType, listener: McpEventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  protected emitEvent(event: McpEvent): void {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch {
          // ignore listener errors
        }
      }
    }
  }

  protected updateServerStatus(serverId: string, status: McpServerStatus): void {
    const info = this.servers.get(serverId);
    if (info) {
      info.status = status;
    }
  }
}

