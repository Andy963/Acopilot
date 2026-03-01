import { t } from '../../../i18n';
import type { McpServerInfo, McpServerStatus } from '../types';
import { StdioMcpClient } from '../StdioClient';
import { HttpMcpClient } from '../HttpClient';
import { McpManagerBase } from './base';

export class McpManagerConnection extends McpManagerBase {
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.reloadFromStorage();

    this.initialized = true;
  }

  getServersToAutoConnect(): string[] {
    const serverIds: string[] = [];
    for (const [serverId, info] of this.servers) {
      if (info.config.enabled && info.config.autoConnect && info.status === 'disconnected') {
        serverIds.push(serverId);
      }
    }
    return serverIds;
  }

  protected async reloadFromStorage(): Promise<void> {
    const configs = await this.storageAdapter.getAllConfigs();
    const hydratedConfigs = await Promise.all(configs.map((c) => this.migrateAndHydrateStdioEnv(c)));
    const configMap = new Map(hydratedConfigs.map((c) => [c.id, c]));

    for (const [serverId, info] of this.servers) {
      const newConfig = configMap.get(serverId);
      if (newConfig) {
        info.config = newConfig;
        configMap.delete(serverId);
      } else {
        if (info.status === 'connected' || info.status === 'connecting') {
          await this.disconnect(serverId).catch(() => {});
        }
        this.servers.delete(serverId);
      }
    }

    for (const [serverId, config] of configMap) {
      this.servers.set(serverId, {
        config,
        status: 'disconnected',
      });
    }
  }

  async dispose(): Promise<void> {
    for (const [serverId] of this.servers) {
      try {
        await this.disconnect(serverId);
      } catch {
        // ignore
      }
    }

    this.servers.clear();
    this.listeners.clear();
    this.initialized = false;
  }

  async connect(serverId: string): Promise<void> {
    await this.reloadFromStorage();

    const info = this.servers.get(serverId);
    if (!info) {
      const availableIds = Array.from(this.servers.keys());
      throw new Error(
        t('modules.mcp.errors.serverNotFoundWithAvailable', {
          serverId,
          available: availableIds.join(', ') || 'none',
        })
      );
    }

    if (!info.config.enabled) {
      throw new Error(t('modules.mcp.errors.serverDisabled', { serverId }));
    }

    if (info.status === 'connected' || info.status === 'connecting') {
      return;
    }

    this.updateServerStatus(serverId, 'connecting');

    try {
      await this.performConnect(info);

      this.updateServerStatus(serverId, 'connected');
      info.connectedAt = Date.now();

      this.emitEvent({
        type: 'server:connected',
        serverId,
        timestamp: Date.now(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      info.lastError = errorMessage;
      this.updateServerStatus(serverId, 'error');

      this.emitEvent({
        type: 'server:error',
        serverId,
        data: { error: errorMessage },
        timestamp: Date.now(),
      });

      throw error;
    }
  }

  async disconnect(serverId: string): Promise<void> {
    const info = this.servers.get(serverId);
    if (!info) {
      throw new Error(t('modules.mcp.errors.serverNotFound', { serverId }));
    }

    if (info.status === 'disconnected') {
      return;
    }

    try {
      await this.performDisconnect(info);
    } catch {
      // ignore
    }

    this.updateServerStatus(serverId, 'disconnected');
    info.connectedAt = undefined;
    info.capabilities = undefined;

    this.emitEvent({
      type: 'server:disconnected',
      serverId,
      timestamp: Date.now(),
    });
  }

  async reconnect(serverId: string): Promise<void> {
    await this.disconnect(serverId);
    await this.connect(serverId);
  }

  getServerStatus(serverId: string): McpServerStatus | null {
    const info = this.servers.get(serverId);
    return info?.status ?? null;
  }

  protected async performConnect(info: McpServerInfo): Promise<void> {
    const { transport } = info.config;

    switch (transport.type) {
      case 'stdio': {
        const client = new StdioMcpClient(transport.command, transport.args || [], transport.env, undefined);

        client.on('error', (err) => {
          info.lastError = err.message;
          this.updateServerStatus(info.config.id, 'error');
        });

        client.on('exit', () => {
          this.clients.delete(info.config.id);
          this.updateServerStatus(info.config.id, 'disconnected');
        });

        await client.connect();

        this.clients.set(info.config.id, client);

        info.capabilities = {
          tools: client.getTools().map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
          resources: client.getResources().map((r) => ({
            uri: r.uri,
            name: r.name,
            description: r.description,
            mimeType: r.mimeType,
          })),
          prompts: client.getPrompts().map((p) => ({
            name: p.name,
            description: p.description,
            arguments: p.arguments,
          })),
        };
        info.protocolVersion = client.getProtocolVersion();

        const serverInfo = client.getServerInfo();
        if (serverInfo) {
          info.serverVersion = serverInfo.version;
          info.serverDescription = serverInfo.name;
        }
        break;
      }

      case 'sse': {
        const sseClient = new HttpMcpClient(transport.url, 'sse', transport.headers || {}, info.config.timeout || 30000);

        await sseClient.connect();

        this.clients.set(info.config.id, sseClient);

        info.capabilities = {
          tools: sseClient.getTools().map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
          resources: sseClient.getResources().map((r) => ({
            uri: r.uri,
            name: r.name,
            description: r.description,
            mimeType: r.mimeType,
          })),
          prompts: sseClient.getPrompts().map((p) => ({
            name: p.name,
            description: p.description,
            arguments: p.arguments,
          })),
        };
        info.protocolVersion = sseClient.getProtocolVersion();

        const sseServerInfo = sseClient.getServerInfo();
        if (sseServerInfo) {
          info.serverVersion = sseServerInfo.version;
          info.serverDescription = sseServerInfo.name;
        }
        break;
      }

      case 'streamable-http': {
        const httpClient = new HttpMcpClient(
          transport.url,
          'streamable-http',
          transport.headers || {},
          info.config.timeout || 30000
        );

        await httpClient.connect();

        this.clients.set(info.config.id, httpClient);

        info.capabilities = {
          tools: httpClient.getTools().map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
          resources: httpClient.getResources().map((r) => ({
            uri: r.uri,
            name: r.name,
            description: r.description,
            mimeType: r.mimeType,
          })),
          prompts: httpClient.getPrompts().map((p) => ({
            name: p.name,
            description: p.description,
            arguments: p.arguments,
          })),
        };
        info.protocolVersion = httpClient.getProtocolVersion();

        const httpServerInfo = httpClient.getServerInfo();
        if (httpServerInfo) {
          info.serverVersion = httpServerInfo.version;
          info.serverDescription = httpServerInfo.name;
        }
        break;
      }
    }
  }

  protected async performDisconnect(info: McpServerInfo): Promise<void> {
    const client = this.clients.get(info.config.id);
    if (client) {
      await client.disconnect();
      this.clients.delete(info.config.id);
    }
  }
}

