import { t } from '../../../i18n';
import type {
  McpPromptGetRequest,
  McpPromptMessage,
  McpResourceContent,
  McpResourceReadRequest,
  McpServerCapabilities,
  McpServerInfo,
  McpToolCallRequest,
  McpToolCallResult,
} from '../types';
import { McpManagerConfig } from './config';

export class McpManager extends McpManagerConfig {
  async callTool(request: McpToolCallRequest): Promise<McpToolCallResult> {
    const info = this.servers.get(request.serverId);
    if (!info) {
      return {
        success: false,
        error: t('modules.mcp.errors.serverNotFound', { serverId: request.serverId }),
      };
    }

    if (info.status !== 'connected') {
      return {
        success: false,
        error: t('modules.mcp.errors.serverNotConnected', { serverName: info.config.name }),
      };
    }

    try {
      const result = await this.performToolCall(info, request);

      this.emitEvent({
        type: 'tool:result',
        serverId: request.serverId,
        data: { toolName: request.toolName, result },
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
        isError: true,
      };
    }
  }

  async readResource(request: McpResourceReadRequest): Promise<McpResourceContent | null> {
    const info = this.servers.get(request.serverId);
    if (!info) {
      throw new Error(t('modules.mcp.errors.serverNotFound', { serverId: request.serverId }));
    }

    if (info.status !== 'connected') {
      throw new Error(t('modules.mcp.errors.serverNotConnected', { serverName: info.config.name }));
    }

    return await this.performResourceRead(info, request);
  }

  async getPrompt(request: McpPromptGetRequest): Promise<McpPromptMessage[]> {
    const info = this.servers.get(request.serverId);
    if (!info) {
      throw new Error(t('modules.mcp.errors.serverNotFound', { serverId: request.serverId }));
    }

    if (info.status !== 'connected') {
      throw new Error(t('modules.mcp.errors.serverNotConnected', { serverName: info.config.name }));
    }

    return await this.performPromptGet(info, request);
  }

  getAllTools(): Array<{ serverId: string; serverName: string; tools: McpServerCapabilities['tools']; cleanSchema: boolean }> {
    const result: Array<{ serverId: string; serverName: string; tools: McpServerCapabilities['tools']; cleanSchema: boolean }> = [];

    for (const [serverId, info] of this.servers) {
      if (info.status === 'connected' && info.capabilities?.tools) {
        result.push({
          serverId,
          serverName: info.config.name,
          tools: info.capabilities.tools,
          cleanSchema: info.config.cleanSchema !== false,
        });
      }
    }

    return result;
  }

  getAllResources(): Array<{ serverId: string; serverName: string; resources: McpServerCapabilities['resources'] }> {
    const result: Array<{ serverId: string; serverName: string; resources: McpServerCapabilities['resources'] }> = [];

    for (const [serverId, info] of this.servers) {
      if (info.status === 'connected' && info.capabilities?.resources) {
        result.push({
          serverId,
          serverName: info.config.name,
          resources: info.capabilities.resources,
        });
      }
    }

    return result;
  }

  getAllPrompts(): Array<{ serverId: string; serverName: string; prompts: McpServerCapabilities['prompts'] }> {
    const result: Array<{ serverId: string; serverName: string; prompts: McpServerCapabilities['prompts'] }> = [];

    for (const [serverId, info] of this.servers) {
      if (info.status === 'connected' && info.capabilities?.prompts) {
        result.push({
          serverId,
          serverName: info.config.name,
          prompts: info.capabilities.prompts,
        });
      }
    }

    return result;
  }

  private async performToolCall(info: McpServerInfo, request: McpToolCallRequest): Promise<McpToolCallResult> {
    const client = this.clients.get(info.config.id);
    if (!client) {
      return {
        success: false,
        error: t('modules.mcp.errors.clientNotConnected'),
      };
    }

    try {
      const result = await client.callTool(request.toolName, request.arguments);
      return {
        success: !result.isError,
        content: result.content.map((c) => ({
          type: c.type as 'text' | 'image' | 'resource',
          text: c.text,
          data: c.data,
          mimeType: c.mimeType,
        })),
        isError: result.isError,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : t('modules.mcp.errors.toolCallFailed'),
      };
    }
  }

  private async performResourceRead(info: McpServerInfo, request: McpResourceReadRequest): Promise<McpResourceContent | null> {
    const client = this.clients.get(info.config.id);
    if (!client) {
      throw new Error(t('modules.mcp.errors.clientNotConnected'));
    }

    const result = await client.readResource(request.uri);
    const content = result.contents[0];
    if (!content) {
      return null;
    }

    return {
      uri: content.uri,
      mimeType: content.mimeType,
      text: content.text,
      blob: content.blob,
    };
  }

  private async performPromptGet(info: McpServerInfo, request: McpPromptGetRequest): Promise<McpPromptMessage[]> {
    const client = this.clients.get(info.config.id);
    if (!client) {
      throw new Error(t('modules.mcp.errors.clientNotConnected'));
    }

    const result = await client.getPrompt(request.promptName, request.arguments);
    return result.messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: {
        type: m.content.type as 'text' | 'image' | 'resource',
        text: m.content.text,
      },
    }));
  }
}

