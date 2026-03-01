import { t } from '../../../i18n';
import type { CreateMcpServerInput, McpServerConfig, McpServerInfo, UpdateMcpServerInput } from '../types';
import { McpManagerConnection } from './connection';

function generateId(): string {
  return `mcp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export class McpManagerConfig extends McpManagerConnection {
  async validateServerId(id: string, excludeId?: string): Promise<{ valid: boolean; error?: string }> {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      return { valid: false, error: t('modules.mcp.errors.invalidServerId') };
    }

    const configs = await this.storageAdapter.getAllConfigs();
    for (const config of configs) {
      if (config.id === id && config.id !== excludeId) {
        return { valid: false, error: t('modules.mcp.errors.serverIdExists', { serverId: id }) };
      }
    }

    return { valid: true };
  }

  async createServer(input: CreateMcpServerInput, customId?: string): Promise<string> {
    const id = customId || generateId();

    const validation = await this.validateServerId(id);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const now = Date.now();
    const config: McpServerConfig = {
      ...input,
      id,
      createdAt: now,
      updatedAt: now,
    };

    const persisted = await this.prepareConfigForStorage(config);
    await this.storageAdapter.saveConfig(persisted);

    this.servers.set(config.id, {
      config,
      status: 'disconnected',
    });

    return config.id;
  }

  async getServer(serverId: string): Promise<McpServerConfig | null> {
    const config = await this.storageAdapter.getConfig(serverId);
    if (!config) return null;
    return await this.migrateAndHydrateStdioEnv(config);
  }

  async getServerInfo(serverId: string): Promise<McpServerInfo | null> {
    const rawConfig = await this.storageAdapter.getConfig(serverId);
    const config = rawConfig ? await this.migrateAndHydrateStdioEnv(rawConfig) : null;
    if (!config) {
      return null;
    }

    const runtimeInfo = this.servers.get(serverId);
    return {
      config,
      status: runtimeInfo?.status ?? 'disconnected',
      capabilities: runtimeInfo?.capabilities,
      protocolVersion: runtimeInfo?.protocolVersion,
      serverVersion: runtimeInfo?.serverVersion,
      serverDescription: runtimeInfo?.serverDescription,
      lastError: runtimeInfo?.lastError,
      connectedAt: runtimeInfo?.connectedAt,
    };
  }

  async updateServer(serverId: string, updates: UpdateMcpServerInput): Promise<void> {
    const info = this.servers.get(serverId);
    if (!info) {
      throw new Error(t('modules.mcp.errors.serverNotFound', { serverId }));
    }

    const updatedConfig: McpServerConfig = {
      ...info.config,
      ...updates,
      updatedAt: Date.now(),
    };

    const persisted = await this.prepareConfigForStorage(updatedConfig);
    await this.storageAdapter.saveConfig(persisted);
    info.config = await this.migrateAndHydrateStdioEnv(updatedConfig);
  }

  async deleteServer(serverId: string): Promise<void> {
    const info = this.servers.get(serverId);
    if (!info) {
      throw new Error(t('modules.mcp.errors.serverNotFound', { serverId }));
    }

    if (info.status === 'connected' || info.status === 'connecting') {
      await this.disconnect(serverId);
    }

    await this.storageAdapter.deleteConfig(serverId);
    await this.tryDeleteSecret(this.getStdioEnvSecretKey(serverId));
    this.servers.delete(serverId);
  }

  async listServers(): Promise<McpServerInfo[]> {
    const configs = await this.storageAdapter.getAllConfigs();
    const hydratedConfigs = await Promise.all(configs.map((c) => this.migrateAndHydrateStdioEnv(c)));

    return hydratedConfigs.map((config) => {
      const runtimeInfo = this.servers.get(config.id);
      return {
        config,
        status: runtimeInfo?.status ?? 'disconnected',
        capabilities: runtimeInfo?.capabilities,
        protocolVersion: runtimeInfo?.protocolVersion,
        serverVersion: runtimeInfo?.serverVersion,
        serverDescription: runtimeInfo?.serverDescription,
        lastError: runtimeInfo?.lastError,
        connectedAt: runtimeInfo?.connectedAt,
      };
    });
  }

  async listServerConfigs(): Promise<McpServerConfig[]> {
    const configs = await this.storageAdapter.getAllConfigs();
    return await Promise.all(configs.map((c) => this.migrateAndHydrateStdioEnv(c)));
  }

  async setServerEnabled(serverId: string, enabled: boolean): Promise<void> {
    await this.updateServer(serverId, { enabled });

    if (!enabled) {
      const info = this.servers.get(serverId);
      if (info && (info.status === 'connected' || info.status === 'connecting')) {
        await this.disconnect(serverId);
      }
    }
  }
}

