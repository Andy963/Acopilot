import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildOpenAIRequest } from '../backend/modules/channel/formatters/openai/buildRequest';
import { MemorySettingsStorage } from '../backend/modules/settings/storage';
import { SettingsManager } from '../backend/modules/settings/SettingsManager';
import { DEFAULT_CHECKPOINT_CONFIG, DEFAULT_GLOBAL_SETTINGS } from '../backend/modules/settings/types';
import { translate } from '../frontend/src/i18n';
import { getLocalizedToolDescription, getToolDisplayName } from '../frontend/src/components/settings/toolDisplay';

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
  it('uses localized built-in tool descriptions across settings', () => {
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
    expect(getToolDisplayName({ name: 'custom_tool', description: '', category: 'other' })).toBe('Custom Tool');
    expect(getToolDisplayName('custom_tool')).toBe('Custom Tool');
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
    expect(summarizeStyles).toContain('grid-template-columns: minmax(0, 1fr) minmax(70px, 112px);');
    expect(summarizeStyles).toContain('overflow-wrap: anywhere;');
    expect(summarizeStyles).toContain('width: 100%;');
  });

  it('moves summarize settings into context and removes standalone MCP and summarize tabs', () => {
    const settingsPanel = readProjectFile('frontend/src/components/settings/SettingsPanel.vue');
    const settingsPanelConfig = readProjectFile('frontend/src/components/settings/useSettingsPanel.ts');
    const settingsStore = readProjectFile('frontend/src/stores/settingsStore.ts');
    const contextSettings = readProjectFile('frontend/src/components/settings/ContextSettings.vue');
    const tabIds = settingsStore.slice(
      settingsStore.indexOf('export const SETTINGS_TAB_IDS'),
      settingsStore.indexOf('] as const')
    );

    expect(settingsPanel).not.toContain("activeTab === 'mcp'");
    expect(settingsPanel).not.toContain("activeTab === 'summarize'");
    expect(settingsPanelConfig).not.toContain("{ id: 'mcp'");
    expect(settingsPanelConfig).not.toContain("{ id: 'summarize'");
    expect(tabIds).not.toContain("'mcp'");
    expect(tabIds).not.toContain("'summarize'");
    expect(settingsStore).toContain("mcp: 'tools'");
    expect(settingsStore).toContain("summarize: 'context'");
    expect(contextSettings).toContain("import SummarizeSettings from './SummarizeSettings.vue'");
    expect(contextSettings).toContain('<SummarizeSettings />');
  });

  it('removes MCP hints, categories, badges, and tool loading from settings', () => {
    const files = [
      'frontend/src/components/settings/ToolsSettings.vue',
      'frontend/src/components/settings/useToolsSettings.ts',
      'frontend/src/components/settings/AutoExecSettings.vue',
      'frontend/src/i18n/langs/en/components/settingsPart1.ts',
      'frontend/src/i18n/langs/en/components/settingsPart2b.ts',
      'frontend/src/i18n/langs/zh-CN/components/settingsPart1.ts',
      'frontend/src/i18n/langs/zh-CN/components/settingsPart2b.ts',
      'frontend/src/i18n/langs/ja/components/settingsPart1.ts',
      'frontend/src/i18n/langs/ja/components/settingsPart2b.ts',
    ];

    for (const file of files) {
      const content = readProjectFile(file);
      expect(content).not.toContain('tools.getMcpTools');
      expect(content).not.toContain('mcpNote');
      expect(content).not.toContain('mcp-badge');
      expect(content).not.toContain('isMcpTool');
      expect(content).not.toMatch(/mcp:\s*['"]/i);
    }
  });

  it('keeps the checkpoint limit input inline with its label', () => {
    const checkpointSettings = readProjectFile('frontend/src/components/settings/CheckpointSettings.vue');

    expect(checkpointSettings).toContain('class="checkpoint-limit-row"');
    expect(checkpointSettings).toContain('for="max-checkpoints"');
    expect(checkpointSettings).toContain('id="max-checkpoints"');
    expect(checkpointSettings).toContain('aria-describedby="max-checkpoints-hint"');
    expect(checkpointSettings).toContain('id="max-checkpoints-hint"');
    expect(checkpointSettings).toMatch(
      /\.checkpoint-limit-row\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(70px, 100px\);\s*align-items:\s*center;/
    );
  });

  it('separates channel creation from the current config rename action', () => {
    const channelSettings = readProjectFile('frontend/src/components/settings/ChannelSettings.vue');
    const channelStyles = readProjectFile('frontend/src/components/settings/ChannelSettings.part1.css');
    const customSelect = readProjectFile('frontend/src/components/common/CustomSelect.vue');
    const headerStart = channelSettings.indexOf('<div class="config-selector-header">');
    const selectorStart = channelSettings.indexOf('<div class="config-selector">');
    const formStart = channelSettings.indexOf('<div v-if="currentConfig" class="config-form">');

    expect(headerStart).toBeGreaterThanOrEqual(0);
    expect(selectorStart).toBeGreaterThan(headerStart);
    expect(formStart).toBeGreaterThan(selectorStart);

    const headerMarkup = channelSettings.slice(headerStart, selectorStart);
    const selectorMarkup = channelSettings.slice(selectorStart, formStart);

    expect(headerMarkup).toContain('v-if="!isEditing && !showNewDialog"');
    expect(headerMarkup).toContain('class="add-config-btn"');
    expect(headerMarkup).toContain('channelSettings.selector.add');
    expect(selectorMarkup).toContain('v-if="!isEditing && !showNewDialog"');
    expect(selectorMarkup).toContain('channelSettings.selector.rename');
    expect(selectorMarkup).not.toContain('channelSettings.selector.add');
    expect(selectorMarkup).toContain(':trigger-aria-label="configSelectorAriaLabel"');
    expect(channelSettings).toContain('const configSelectorAriaLabel = computed(() => {');
    expect(channelSettings).toContain('currentConfig.value?.name');
    expect(channelStyles).toMatch(
      /\.config-selector-header\s*\{[\s\S]*?flex-wrap:\s*wrap;[\s\S]*?justify-content:\s*space-between;/
    );
    expect(channelStyles).toMatch(
      /\.add-config-btn\s*\{[\s\S]*?background:\s*var\(--vscode-button-background\);/
    );
    expect(customSelect).toContain('triggerAriaLabel?: string');
    expect(customSelect).toContain(':aria-label="triggerAriaLabel"');

    for (const locale of ['en', 'zh-CN', 'ja']) {
      const messages = readProjectFile(`frontend/src/i18n/langs/${locale}/components/settingsPart1.ts`);
      const localeSelectorStart = messages.indexOf('selector: {');
      const localeDialogStart = messages.indexOf('dialog: {', localeSelectorStart);
      const selectorMessages = messages.slice(localeSelectorStart, localeDialogStart);

      expect(selectorMessages).toContain('label:');
    }
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
