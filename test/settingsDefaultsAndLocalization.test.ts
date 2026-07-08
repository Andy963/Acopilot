import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildOpenAIRequest } from '../backend/modules/channel/formatters/openai/buildRequest';
import { MemorySettingsStorage } from '../backend/modules/settings/storage';
import { SettingsManager } from '../backend/modules/settings/SettingsManager';
import { DEFAULT_CHECKPOINT_CONFIG, DEFAULT_GLOBAL_SETTINGS } from '../backend/modules/settings/types';

function readProjectFile(path: string): string {
  return readFileSync(resolve(__dirname, '..', path), 'utf8');
}

async function createSettingsManagerWith(settings: any): Promise<SettingsManager> {
  const storage = new MemorySettingsStorage();
  await storage.save(settings);
  const manager = new SettingsManager(storage);
  await manager.initialize();
  return manager;
}

function cloneDefaultSettings(): any {
  return JSON.parse(JSON.stringify(DEFAULT_GLOBAL_SETTINGS));
}

describe('settings defaults and localization', () => {
  it('uses localized built-in tool descriptions without changing MCP descriptions', () => {
    const settings = readProjectFile('frontend/src/components/settings/ToolsSettings.vue');
    const composable = readProjectFile('frontend/src/components/settings/useToolsSettings.ts');
    const zhCN = readProjectFile('frontend/src/i18n/langs/zh-CN/components/settingsPart2b.ts');

    expect(settings).toContain('getToolDescription(tool)');
    expect(composable).toContain('function getToolDescription(tool: ToolInfo): string');
    expect(composable).toContain('if (isMcpTool(tool)) return tool.description');
    expect(composable).toContain('components.settings.toolsSettings.descriptions.${tool.name}');
    expect(zhCN).toContain('descriptions: {');
    expect(zhCN).toContain("execute_command: '执行 Shell 命令并返回输出。'");
    expect(zhCN).toContain("replace_in_files: '在多个文件中搜索并替换文本，支持预览模式。'");
  });

  it('bounds the checkpoint cleanup list inside a custom scrollbar', () => {
    const cleanupList = readProjectFile('frontend/src/components/settings/checkpoint/CheckpointCleanupList.vue');

    expect(cleanupList).toContain('<CustomScrollbar :max-height="360">');
    expect(cleanupList).toContain('max-height: 360px;');
    expect(cleanupList).toContain('overflow: hidden;');
  });

  it('defaults startup cleanup to enabled for new and legacy-missing checkpoint configs', async () => {
    expect(DEFAULT_CHECKPOINT_CONFIG.cleanupExpiredConversationsOnStartup).toBe(true);

    const settings = cloneDefaultSettings();
    delete settings.toolsConfig.checkpoint.cleanupExpiredConversationsOnStartup;

    const manager = await createSettingsManagerWith(settings);
    expect(manager.getCheckpointConfig().cleanupExpiredConversationsOnStartup).toBe(true);
  });

  it('keeps explicit startup cleanup disablement intact', async () => {
    const settings = cloneDefaultSettings();
    settings.toolsConfig.checkpoint.cleanupExpiredConversationsOnStartup = false;

    const manager = await createSettingsManagerWith(settings);
    expect(manager.getCheckpointConfig().cleanupExpiredConversationsOnStartup).toBe(false);
  });

  it('defaults prompt token estimation to OpenAI', () => {
    const promptSettings = readProjectFile('frontend/src/components/settings/PromptSettings.vue');

    expect(promptSettings).toContain("const selectedChannel = ref<ChannelType>('openai')");
    expect(promptSettings).not.toContain("const selectedChannel = ref<ChannelType>('gemini')");
  });

  it('defaults provider requests to streaming when configs omit stream preferences', () => {
    const request = {
      history: [{ role: 'user', parts: [{ text: 'hi' }] }],
    } as any;
    const config = {
      url: 'https://example.com/v1',
      model: 'gpt-test',
      apiKey: 'test-key',
      customHeadersEnabled: false,
    } as any;

    const http = buildOpenAIRequest(request, config);
    expect(http.stream).toBe(true);
    expect(http.body.stream).toBe(true);

    const explicitNonStream = buildOpenAIRequest(request, { ...config, options: { stream: false } });
    expect(explicitNonStream.stream).toBe(false);
    expect(explicitNonStream.body.stream).toBe(false);
  });

  it('documents stream default fallback as enabled', () => {
    for (const file of [
      'backend/modules/channel/channelManager/ChannelManager.ts',
      'backend/modules/channel/formatters/gemini/buildRequest.ts',
      'backend/modules/channel/formatters/openai/buildRequest.ts',
      'backend/modules/channel/formatters/anthropic/buildRequest.ts',
      'backend/modules/channel/formatters/openai-responses.ts',
      'backend/modules/channel/README.md',
    ]) {
      expect(readProjectFile(file)).toContain('?? true');
    }
  });
});
