import type {
  ApplyDiffToolConfig,
  CheckpointConfig,
  DeleteFileToolConfig,
  ExecuteCommandToolConfig,
  FindFilesToolConfig,
  ListFilesToolConfig,
  LocateToolConfig,
  ShellConfig,
  SearchInFilesToolConfig,
  ToolAutoExecConfig,
  ToolsConfig,
  ToolsEnabledState,
} from '../types';
import {
  DEFAULT_APPLY_DIFF_CONFIG,
  DEFAULT_CHECKPOINT_CONFIG,
  DEFAULT_DELETE_FILE_CONFIG,
  DEFAULT_FIND_FILES_CONFIG,
  DEFAULT_LIST_FILES_CONFIG,
  DEFAULT_LOCATE_CONFIG,
  DEFAULT_TOOL_AUTO_EXEC_CONFIG,
  DEFAULT_SEARCH_IN_FILES_CONFIG,
  getDefaultExecuteCommandConfig,
} from '../types';
import { SettingsManagerBase } from './base';

function normalizeLocateConfig(config: LocateToolConfig): LocateToolConfig {
  const model = typeof config.model === 'string' ? config.model.trim() : '';
  const autoTriggerEnabled =
    typeof config.autoTriggerEnabled === 'boolean'
      ? config.autoTriggerEnabled
      : (DEFAULT_LOCATE_CONFIG.autoTriggerEnabled ?? true);

  const triggerKeywords = Array.isArray(config.triggerKeywords)
    ? Array.from(
      new Set(
        config.triggerKeywords
          .map((k) => (typeof k === 'string' ? k.trim() : ''))
          .filter(Boolean)
      )
    ).slice(0, 200)
    : undefined;

  return {
    ...config,
    model,
    autoTriggerEnabled,
    triggerKeywords: triggerKeywords ?? [...(DEFAULT_LOCATE_CONFIG.triggerKeywords || [])],
  };
}

export class SettingsManagerTools extends SettingsManagerBase {
  getToolsEnabled(): Readonly<ToolsEnabledState> {
    return { ...this.settings.toolsEnabled };
  }

  isToolEnabled(toolName: string): boolean {
    return this.settings.toolsEnabled[toolName] !== false;
  }

  async setToolEnabled(toolName: string, enabled: boolean): Promise<void> {
    const oldValue = this.settings.toolsEnabled[toolName];
    this.settings.toolsEnabled[toolName] = enabled;

    await this.commitChange({
      type: 'tools',
      path: `toolsEnabled.${toolName}`,
      oldValue,
      newValue: enabled,
    });
  }

  async setToolsEnabled(states: ToolsEnabledState): Promise<void> {
    const oldValue = { ...this.settings.toolsEnabled };
    this.settings.toolsEnabled = {
      ...this.settings.toolsEnabled,
      ...states,
    };

    await this.commitChange({
      type: 'tools',
      path: 'toolsEnabled',
      oldValue,
      newValue: this.settings.toolsEnabled,
    });
  }

  getEnabledTools(allTools: string[]): string[] {
    return allTools.filter((name) => this.isToolEnabled(name));
  }

  getToolAutoExecConfig(): Readonly<ToolAutoExecConfig> {
    return this.settings.toolAutoExec || DEFAULT_TOOL_AUTO_EXEC_CONFIG;
  }

  isToolAutoExec(toolName: string): boolean {
    const config = this.settings.toolAutoExec || DEFAULT_TOOL_AUTO_EXEC_CONFIG;
    if (config[toolName] === undefined) {
      return true;
    }
    return config[toolName];
  }

  async setToolAutoExec(toolName: string, autoExec: boolean): Promise<void> {
    const oldConfig = { ...this.getToolAutoExecConfig() };

    if (!this.settings.toolAutoExec) {
      this.settings.toolAutoExec = { ...DEFAULT_TOOL_AUTO_EXEC_CONFIG };
    }
    this.settings.toolAutoExec[toolName] = autoExec;

    await this.commitChange({
      type: 'tools',
      path: `toolAutoExec.${toolName}`,
      oldValue: oldConfig[toolName],
      newValue: autoExec,
    });
  }

  async setToolAutoExecConfig(config: ToolAutoExecConfig): Promise<void> {
    const oldConfig = this.getToolAutoExecConfig();
    this.settings.toolAutoExec = {
      ...this.settings.toolAutoExec,
      ...config,
    };

    await this.commitChange({
      type: 'tools',
      path: 'toolAutoExec',
      oldValue: oldConfig,
      newValue: this.settings.toolAutoExec,
    });
  }

  getToolsRequiringConfirmation(allTools: string[]): string[] {
    return allTools.filter((name) => !this.isToolAutoExec(name));
  }

  getToolsConfig(): Readonly<ToolsConfig> {
    return this.settings.toolsConfig || {};
  }

  getListFilesConfig(): Readonly<ListFilesToolConfig> {
    return this.settings.toolsConfig?.list_files || DEFAULT_LIST_FILES_CONFIG;
  }

  async updateListFilesConfig(config: Partial<ListFilesToolConfig>): Promise<void> {
    await this.updateToolsConfigEntry('list_files', this.getListFilesConfig(), config);
  }

  getFindFilesConfig(): Readonly<FindFilesToolConfig> {
    return this.settings.toolsConfig?.find_files || DEFAULT_FIND_FILES_CONFIG;
  }

  async updateFindFilesConfig(config: Partial<FindFilesToolConfig>): Promise<void> {
    await this.updateToolsConfigEntry('find_files', this.getFindFilesConfig(), config);
  }

  getSearchInFilesConfig(): Readonly<SearchInFilesToolConfig> {
    return this.settings.toolsConfig?.search_in_files || DEFAULT_SEARCH_IN_FILES_CONFIG;
  }

  async updateSearchInFilesConfig(config: Partial<SearchInFilesToolConfig>): Promise<void> {
    await this.updateToolsConfigEntry('search_in_files', this.getSearchInFilesConfig(), config);
  }

  getLocateConfig(): Readonly<LocateToolConfig> {
    const stored = (this.settings.toolsConfig as any)?.locate;
    const merged: LocateToolConfig = {
      ...DEFAULT_LOCATE_CONFIG,
      ...(stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {}),
    };
    return normalizeLocateConfig(merged);
  }

  async updateLocateConfig(config: Partial<LocateToolConfig>): Promise<void> {
    const oldConfig = this.getLocateConfig();
    const newConfig = normalizeLocateConfig({
      ...oldConfig,
      ...config,
    });

    this.ensureToolsConfig().locate = newConfig as any;

    await this.commitChange({
      type: 'tools',
      path: 'toolsConfig.locate',
      oldValue: oldConfig,
      newValue: newConfig,
    });
  }

  async updateToolConfig(toolName: string, config: Record<string, unknown>): Promise<void> {
    const oldConfig = this.getToolsConfig()[toolName] || {};
    await this.updateToolsConfigEntry(toolName, oldConfig, config);
  }

  getApplyDiffConfig(): Readonly<ApplyDiffToolConfig> {
    return this.settings.toolsConfig?.apply_diff || DEFAULT_APPLY_DIFF_CONFIG;
  }

  async updateApplyDiffConfig(config: Partial<ApplyDiffToolConfig>): Promise<void> {
    await this.updateToolsConfigEntry('apply_diff', this.getApplyDiffConfig(), config);
  }

  getDeleteFileConfig(): Readonly<DeleteFileToolConfig> {
    return this.settings.toolsConfig?.delete_file || DEFAULT_DELETE_FILE_CONFIG;
  }

  async updateDeleteFileConfig(config: Partial<DeleteFileToolConfig>): Promise<void> {
    await this.updateToolsConfigEntry('delete_file', this.getDeleteFileConfig(), config);
  }

  getExecuteCommandConfig(): Readonly<ExecuteCommandToolConfig> {
    return this.settings.toolsConfig?.execute_command || getDefaultExecuteCommandConfig();
  }

  async updateExecuteCommandConfig(config: Partial<ExecuteCommandToolConfig>): Promise<void> {
    await this.updateToolsConfigEntry('execute_command', this.getExecuteCommandConfig(), config);
  }

  getEnabledShells(): ShellConfig[] {
    return this.getExecuteCommandConfig().shells.filter((shell) => shell.enabled);
  }

  getDefaultShell(): string {
    return this.getExecuteCommandConfig().defaultShell;
  }

  async setDefaultShell(shellType: string): Promise<void> {
    await this.updateExecuteCommandConfig({ defaultShell: shellType });
  }

  async updateShellConfig(shellType: string, updates: Partial<ShellConfig>): Promise<void> {
    const config = this.getExecuteCommandConfig();
    const shells = config.shells.map((shell) =>
      shell.type === shellType ? { ...shell, ...updates } : shell
    );
    await this.updateExecuteCommandConfig({ shells });
  }

  async setShellEnabled(shellType: string, enabled: boolean): Promise<void> {
    await this.updateShellConfig(shellType, { enabled });
  }

  private normalizeCheckpointToolName(toolName: string): string {
    if (toolName === 'write_to_file') {
      return 'write_file';
    }
    return toolName;
  }

  private normalizeCheckpointConfig(config: Readonly<CheckpointConfig>): CheckpointConfig {
    const normalizeList = (tools: string[] | undefined): string[] => {
      if (!tools || !Array.isArray(tools)) return [];
      return Array.from(new Set(tools.map((t) => this.normalizeCheckpointToolName(t)).filter(Boolean)));
    };

    const retentionDaysRaw = (config as any).expiredConversationRetentionDays;
    const retentionDays = Number.isFinite(retentionDaysRaw) ? Number(retentionDaysRaw) : 30;

    return {
      ...config,
      beforeTools: normalizeList(config.beforeTools),
      afterTools: normalizeList(config.afterTools),
      messageCheckpoint: config.messageCheckpoint ? { ...config.messageCheckpoint } : undefined,
      customIgnorePatterns: config.customIgnorePatterns ? [...config.customIgnorePatterns] : [],
      cleanupExpiredConversationsOnStartup: !!(config as any).cleanupExpiredConversationsOnStartup,
      expiredConversationRetentionDays: Math.max(1, Math.floor(retentionDays)),
    };
  }

  getCheckpointConfig(): Readonly<CheckpointConfig> {
    const config = this.settings.toolsConfig?.checkpoint || DEFAULT_CHECKPOINT_CONFIG;
    return this.normalizeCheckpointConfig(config);
  }

  async updateCheckpointConfig(config: Partial<CheckpointConfig>): Promise<void> {
    const oldConfig = this.getCheckpointConfig();
    const mergedConfig = {
      ...oldConfig,
      ...config,
    };
    const newConfig = this.normalizeCheckpointConfig(mergedConfig);

    this.ensureToolsConfig().checkpoint = newConfig;
    await this.commitChange({
      type: 'tools',
      path: 'toolsConfig.checkpoint',
      oldValue: oldConfig,
      newValue: newConfig,
    });
  }

  shouldCreateBeforeCheckpoint(toolName: string): boolean {
    const config = this.getCheckpointConfig();
    return config.enabled && config.beforeTools.includes(toolName);
  }

  shouldCreateAfterCheckpoint(toolName: string): boolean {
    const config = this.getCheckpointConfig();
    return config.enabled && config.afterTools.includes(toolName);
  }

  async setCheckpointEnabled(enabled: boolean): Promise<void> {
    await this.updateCheckpointConfig({ enabled });
  }

  async setToolCheckpointPhase(toolName: string, before: boolean, after: boolean): Promise<void> {
    const config = this.getCheckpointConfig();

    const beforeTools = [...config.beforeTools];
    const afterTools = [...config.afterTools];

    const beforeIndex = beforeTools.indexOf(toolName);
    if (before && beforeIndex === -1) {
      beforeTools.push(toolName);
    } else if (!before && beforeIndex !== -1) {
      beforeTools.splice(beforeIndex, 1);
    }

    const afterIndex = afterTools.indexOf(toolName);
    if (after && afterIndex === -1) {
      afterTools.push(toolName);
    } else if (!after && afterIndex !== -1) {
      afterTools.splice(afterIndex, 1);
    }

    await this.updateCheckpointConfig({ beforeTools, afterTools });
  }

  shouldCreateBeforeUserMessageCheckpoint(): boolean {
    const config = this.getCheckpointConfig();
    return config.enabled && (config.messageCheckpoint?.beforeMessages?.includes('user') ?? false);
  }

  shouldCreateAfterUserMessageCheckpoint(): boolean {
    const config = this.getCheckpointConfig();
    return config.enabled && (config.messageCheckpoint?.afterMessages?.includes('user') ?? false);
  }

  shouldCreateBeforeModelMessageCheckpoint(): boolean {
    const config = this.getCheckpointConfig();
    return config.enabled && (config.messageCheckpoint?.beforeMessages?.includes('model') ?? false);
  }

  shouldCreateAfterModelMessageCheckpoint(): boolean {
    const config = this.getCheckpointConfig();
    return config.enabled && (config.messageCheckpoint?.afterMessages?.includes('model') ?? false);
  }

  isModelOuterLayerOnly(): boolean {
    const config = this.getCheckpointConfig();
    return config.messageCheckpoint?.modelOuterLayerOnly ?? true;
  }

  getDefaultToolMode(): 'function_call' | 'xml' {
    return this.settings.defaultToolMode || 'function_call';
  }

  async setDefaultToolMode(mode: 'function_call' | 'xml'): Promise<void> {
    const oldValue = this.settings.defaultToolMode;
    this.settings.defaultToolMode = mode;

    await this.commitChange({
      type: 'toolMode',
      path: 'defaultToolMode',
      oldValue,
      newValue: mode,
    });
  }
}
