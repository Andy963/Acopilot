import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildOpenAIRequest } from '../backend/modules/channel/formatters/openai/buildRequest';
import { MemorySettingsStorage } from '../backend/modules/settings/storage';
import { SettingsManager } from '../backend/modules/settings/SettingsManager';
import { DEFAULT_CHECKPOINT_CONFIG, DEFAULT_GLOBAL_SETTINGS } from '../backend/modules/settings/types';
import { translate } from '../frontend/src/i18n';
import { getLocalizedToolDescription, getToolDisplayName, isMcpTool } from '../frontend/src/components/settings/toolDisplay';

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
    const helper = readProjectFile('frontend/src/components/settings/toolDisplay.ts');
    const autoExecSettings = readProjectFile('frontend/src/components/settings/AutoExecSettings.vue');
    const checkpointToolSection = readProjectFile('frontend/src/components/settings/checkpoint/CheckpointToolSettingsSection.vue');
    const zhCN = readProjectFile('frontend/src/i18n/langs/zh-CN/components/settingsPart2b.ts');

    expect(settings).toContain('getToolDescription(tool)');
    expect(settings).toContain('getToolDisplayName(tool)');
    expect(composable).toContain("from './toolDisplay'");
    expect(composable).toContain('getLocalizedToolDescription(tool, t)');
    expect(helper).toContain('export function getLocalizedToolDescription');
    expect(helper).toContain('if (isMcpTool(tool)) return tool.description');
    expect(helper).toContain('getToolDescriptionKey(tool.name)');
    expect(autoExecSettings).toContain("from './toolDisplay'");
    expect(autoExecSettings).toContain('getToolDescription(tool)');
    expect(autoExecSettings).not.toContain('{{ tool.description }}');
    expect(checkpointToolSection).toContain("from '../toolDisplay'");
    expect(checkpointToolSection).toContain('getToolDescription(tool)');
    expect(checkpointToolSection).toContain('getToolDisplayName(tool)');
    expect(checkpointToolSection).not.toContain('{{ tool.description }}');
    expect(zhCN).toContain('descriptions: {');
    expect(zhCN).toContain("execute_command: '执行 Shell 命令并返回输出。'");
    expect(zhCN).toContain("replace_in_files: '在多个文件中搜索并替换文本，支持预览模式。'");
  });

  it('resolves tool display metadata from localized UI copy', () => {
    const translate = (key: string) => {
      if (key === 'components.settings.toolsSettings.descriptions.execute_command') {
        return 'Localized shell execution description';
      }
      return key;
    };

    expect(getLocalizedToolDescription({
      name: 'execute_command',
      description: 'Execute shell commands and return output.',
      category: 'terminal',
    }, translate)).toBe('Localized shell execution description');
    expect(getLocalizedToolDescription({
      name: 'unknown_tool',
      description: 'Backend fallback description.',
      category: 'other',
    }, translate)).toBe('Backend fallback description.');
    expect(getLocalizedToolDescription({
      name: 'mcp__server__custom_tool',
      description: 'MCP provided description.',
      category: 'mcp',
    }, translate)).toBe('MCP provided description.');
    expect(getToolDisplayName({ name: 'mcp__server__custom_tool', description: '', category: 'mcp' })).toBe('Custom Tool');
    expect(getToolDisplayName('mcp__server__custom_tool')).toBe('Custom Tool');
    expect(isMcpTool({ name: 'mcp__server__custom_tool', description: '' })).toBe(true);
  });

  it('resolves built-in tool descriptions through the active language pack', () => {
    const zhTranslate = (key: string) => translate('zh-CN', key);

    expect(getLocalizedToolDescription({
      name: 'execute_command',
      description: 'Execute shell commands and return output.',
      category: 'terminal',
    }, zhTranslate)).toBe('执行 Shell 命令并返回输出。');

    expect(getLocalizedToolDescription({
      name: 'replace_in_files',
      description: 'Search and replace text across files.',
      category: 'search',
    }, zhTranslate)).toBe('在多个文件中搜索并替换文本，支持预览模式。');
  });

  it('keeps summarize numeric fields inline with their labels', () => {
    const summarizeSettings = readProjectFile('frontend/src/components/settings/SummarizeSettings.vue');
    const summarizeStyles = readProjectFile('frontend/src/components/settings/SummarizeSettings.css');

    expect(summarizeSettings).toContain('autoSummarizeThreshold');
    expect(summarizeSettings).toContain('keepRecentRounds');
    expect(summarizeSettings).toContain('class="field-row"');
    expect(summarizeStyles).toContain('grid-template-columns: max-content max-content;');
    expect(summarizeStyles).toContain('white-space: nowrap;');
    expect(summarizeStyles).toContain('width: 112px;');
  });

  it('bounds the checkpoint cleanup list inside a custom scrollbar', () => {
    const cleanupList = readProjectFile('frontend/src/components/settings/checkpoint/CheckpointCleanupList.vue');

    expect(cleanupList).toContain('<CustomScrollbar :max-height="360">');
    expect(cleanupList).toContain('max-height: 360px;');
    expect(cleanupList).toContain('overflow: hidden;');
  });

  it('adds checkpoint scenario presets and a recent restore entry', () => {
    const checkpointSettings = readProjectFile('frontend/src/components/settings/CheckpointSettings.vue');
    const checkpointConfig = readProjectFile('frontend/src/components/settings/checkpoint/useCheckpointSettingsConfig.ts');
    const messageList = readProjectFile('frontend/src/components/message/MessageList.vue');
    const messageActions = readProjectFile('frontend/src/components/message/useMessageListActions.ts');

    expect(checkpointSettings).toContain('checkpointPresets');
    expect(checkpointSettings).toContain('applyCheckpointPreset(preset.id)');
    expect(checkpointConfig).toContain("export type CheckpointPresetId = 'safe' | 'light' | 'off' | 'dangerous'");
    expect(checkpointConfig).toContain('MUTATING_CHECKPOINT_TOOLS');
    expect(checkpointConfig).toContain('DANGEROUS_CHECKPOINT_TOOLS');
    expect(messageActions).toContain('recentCheckpoint');
    expect(messageList).toContain('recent-checkpoint');
    expect(messageList).toContain('components.message.checkpoint.recentTitle');

    for (const locale of ['en', 'zh-CN', 'ja']) {
      const settingsMessages = readProjectFile(`frontend/src/i18n/langs/${locale}/components/settingsPart1.ts`);
      const chatMessages = readProjectFile(`frontend/src/i18n/langs/${locale}/components/message.ts`);

      expect(settingsMessages).toContain('presets: {');
      expect(settingsMessages).toContain('dangerous');
      expect(chatMessages).toContain('recentTitle');
      expect(chatMessages).toContain('recentRestore');
    }
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
