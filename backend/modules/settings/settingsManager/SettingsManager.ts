import type {
  ContextAwarenessConfig,
  CropImageToolConfig,
  DiagnosticsConfig,
  GenerateImageToolConfig,
  PinnedFileItem,
  PinnedFilesConfig,
  PinnedPromptPreset,
  PinnedPromptWorkspaceDefault,
  ProxySettings,
  RemoveBackgroundToolConfig,
  ResizeImageToolConfig,
  RotateImageToolConfig,
  SummarizeConfig,
  SystemPromptConfig,
  TokenCountConfig,
} from '../types';
import {
  DEFAULT_CONTEXT_AWARENESS_CONFIG,
  DEFAULT_CROP_IMAGE_CONFIG,
  DEFAULT_DIAGNOSTICS_CONFIG,
  DEFAULT_GENERATE_IMAGE_CONFIG,
  DEFAULT_PINNED_FILES_CONFIG,
  DEFAULT_REMOVE_BACKGROUND_CONFIG,
  DEFAULT_RESIZE_IMAGE_CONFIG,
  DEFAULT_ROTATE_IMAGE_CONFIG,
  DEFAULT_SUMMARIZE_CONFIG,
  DEFAULT_SYSTEM_PROMPT_CONFIG,
  DEFAULT_TOKEN_COUNT_CONFIG,
} from '../types';
import { SettingsManagerTools } from './tools';

export class SettingsManager extends SettingsManagerTools {
  getProxySettings(): Readonly<ProxySettings> {
    return this.settings.proxy || { enabled: false };
  }

  getEffectiveProxyUrl(): string | undefined {
    const proxy = this.settings.proxy;
    if (proxy?.enabled && proxy.url && proxy.url.trim()) {
      return proxy.url.trim();
    }
    return undefined;
  }

  async updateProxySettings(proxySettings: Partial<ProxySettings>): Promise<void> {
    const oldValue = this.settings.proxy;
    this.settings.proxy = {
      ...this.settings.proxy,
      ...proxySettings,
    };

    await this.commitChange({
      type: 'proxy',
      path: 'proxy',
      oldValue,
      newValue: this.settings.proxy,
    });
  }

  async setProxyEnabled(enabled: boolean): Promise<void> {
    await this.updateProxySettings({ enabled });
  }

  async setProxyUrl(url: string | undefined): Promise<void> {
    await this.updateProxySettings({ url });
  }

  getSummarizeConfig(): Readonly<SummarizeConfig> {
    return this.settings.toolsConfig?.summarize || DEFAULT_SUMMARIZE_CONFIG;
  }

  async updateSummarizeConfig(config: Partial<SummarizeConfig>): Promise<void> {
    await this.updateToolsConfigEntry('summarize', this.getSummarizeConfig(), config);
  }

  getGenerateImageConfig(): Readonly<GenerateImageToolConfig> {
    return this.settings.toolsConfig?.generate_image || DEFAULT_GENERATE_IMAGE_CONFIG;
  }

  async updateGenerateImageConfig(config: Partial<GenerateImageToolConfig>): Promise<void> {
    await this.updateToolsConfigEntry('generate_image', this.getGenerateImageConfig(), config);
  }

  getRemoveBackgroundConfig(): Readonly<RemoveBackgroundToolConfig> {
    return this.settings.toolsConfig?.remove_background || DEFAULT_REMOVE_BACKGROUND_CONFIG;
  }

  async updateRemoveBackgroundConfig(config: Partial<RemoveBackgroundToolConfig>): Promise<void> {
    await this.updateToolsConfigEntry('remove_background', this.getRemoveBackgroundConfig(), config);
  }

  getCropImageConfig(): Readonly<CropImageToolConfig> {
    return this.settings.toolsConfig?.crop_image || DEFAULT_CROP_IMAGE_CONFIG;
  }

  async updateCropImageConfig(config: Partial<CropImageToolConfig>): Promise<void> {
    await this.updateToolsConfigEntry('crop_image', this.getCropImageConfig(), config);
  }

  getResizeImageConfig(): Readonly<ResizeImageToolConfig> {
    return this.settings.toolsConfig?.resize_image || DEFAULT_RESIZE_IMAGE_CONFIG;
  }

  async updateResizeImageConfig(config: Partial<ResizeImageToolConfig>): Promise<void> {
    await this.updateToolsConfigEntry('resize_image', this.getResizeImageConfig(), config);
  }

  getRotateImageConfig(): Readonly<RotateImageToolConfig> {
    return this.settings.toolsConfig?.rotate_image || DEFAULT_ROTATE_IMAGE_CONFIG;
  }

  async updateRotateImageConfig(config: Partial<RotateImageToolConfig>): Promise<void> {
    await this.updateToolsConfigEntry('rotate_image', this.getRotateImageConfig(), config);
  }

  getContextAwarenessConfig(): Readonly<ContextAwarenessConfig> {
    return this.settings.toolsConfig?.context_awareness || DEFAULT_CONTEXT_AWARENESS_CONFIG;
  }

  async updateContextAwarenessConfig(config: Partial<ContextAwarenessConfig>): Promise<void> {
    await this.updateToolsConfigEntry('context_awareness', this.getContextAwarenessConfig(), config);
  }

  getMaxFileDepth(): number {
    return this.getContextAwarenessConfig().maxFileDepth;
  }

  shouldIncludeOpenTabs(): boolean {
    return this.getContextAwarenessConfig().includeOpenTabs;
  }

  getMaxOpenTabs(): number {
    return this.getContextAwarenessConfig().maxOpenTabs;
  }

  shouldIncludeActiveEditor(): boolean {
    return this.getContextAwarenessConfig().includeActiveEditor;
  }

  getContextIgnorePatterns(): string[] {
    return this.getContextAwarenessConfig().ignorePatterns || [];
  }

  getDiagnosticsConfig(): Readonly<DiagnosticsConfig> {
    return this.getContextAwarenessConfig().diagnostics || DEFAULT_DIAGNOSTICS_CONFIG;
  }

  async updateDiagnosticsConfig(config: Partial<DiagnosticsConfig>): Promise<void> {
    const contextConfig = this.getContextAwarenessConfig();
    const oldConfig = this.getDiagnosticsConfig();
    const newConfig = {
      ...oldConfig,
      ...config,
    };

    await this.updateContextAwarenessConfig({
      ...contextConfig,
      diagnostics: newConfig,
    });
  }

  isDiagnosticsEnabled(): boolean {
    return this.getDiagnosticsConfig().enabled;
  }

  async setDiagnosticsEnabled(enabled: boolean): Promise<void> {
    await this.updateDiagnosticsConfig({ enabled });
  }

  getDiagnosticsSeverities(): string[] {
    return this.getDiagnosticsConfig().includeSeverities;
  }

  async setDiagnosticsSeverities(severities: ('error' | 'warning' | 'information' | 'hint')[]): Promise<void> {
    await this.updateDiagnosticsConfig({ includeSeverities: severities });
  }

  getPinnedFilesConfig(): Readonly<PinnedFilesConfig> {
    return this.settings.toolsConfig?.pinned_files || DEFAULT_PINNED_FILES_CONFIG;
  }

  async updatePinnedFilesConfig(config: Partial<PinnedFilesConfig>): Promise<void> {
    await this.updateToolsConfigEntry('pinned_files', this.getPinnedFilesConfig(), config);
  }

  getPinnedFiles(): PinnedFileItem[] {
    return this.getPinnedFilesConfig().files || [];
  }

  getEnabledPinnedFiles(): PinnedFileItem[] {
    return this.getPinnedFiles().filter((file) => file.enabled);
  }

  async addPinnedFile(path: string, workspaceUri: string): Promise<PinnedFileItem> {
    const files = [...this.getPinnedFiles()];

    if (files.some((f) => f.path === path && f.workspaceUri === workspaceUri)) {
      throw new Error(`File already pinned: ${path}`);
    }

    const newFile: PinnedFileItem = {
      id: `pinned_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      path,
      workspaceUri,
      enabled: true,
      addedAt: Date.now(),
    };

    files.push(newFile);
    await this.updatePinnedFilesConfig({ files });

    return newFile;
  }

  getPinnedFilesForWorkspace(workspaceUri: string): PinnedFileItem[] {
    return this.getPinnedFiles().filter((f) => f.workspaceUri === workspaceUri);
  }

  getEnabledPinnedFilesForWorkspace(workspaceUri: string): PinnedFileItem[] {
    return this.getPinnedFilesForWorkspace(workspaceUri).filter((f) => f.enabled);
  }

  async removePinnedFile(id: string): Promise<void> {
    const files = this.getPinnedFiles().filter((f) => f.id !== id);
    await this.updatePinnedFilesConfig({ files });
  }

  async setPinnedFileEnabled(id: string, enabled: boolean): Promise<void> {
    const files = this.getPinnedFiles().map((f) => (f.id === id ? { ...f, enabled } : f));
    await this.updatePinnedFilesConfig({ files });
  }

  async updatePinnedFilePath(id: string, newPath: string): Promise<void> {
    const files = this.getPinnedFiles().map((f) => (f.id === id ? { ...f, path: newPath } : f));
    await this.updatePinnedFilesConfig({ files });
  }

  async clearPinnedFiles(): Promise<void> {
    await this.updatePinnedFilesConfig({ files: [] });
  }

  isFilePinned(path: string): boolean {
    return this.getPinnedFiles().some((f) => f.path === path);
  }

  getPinnedFilesSectionTitle(): string {
    return this.getPinnedFilesConfig().sectionTitle || 'PINNED FILES CONTENT';
  }

  getSystemPromptConfig(): Readonly<SystemPromptConfig> {
    return this.settings.toolsConfig?.system_prompt || DEFAULT_SYSTEM_PROMPT_CONFIG;
  }

  async updateSystemPromptConfig(config: Partial<SystemPromptConfig>): Promise<void> {
    await this.updateToolsConfigEntry('system_prompt', this.getSystemPromptConfig(), config);
  }

  getPinnedPromptPresets(): PinnedPromptPreset[] {
    const presets = this.getSystemPromptConfig().pinnedPromptPresets;
    return Array.isArray(presets) ? presets : [];
  }

  async updatePinnedPromptPresets(presets: PinnedPromptPreset[]): Promise<void> {
    await this.updateSystemPromptConfig({ pinnedPromptPresets: presets });
  }

  getSystemPromptTemplate(): string {
    return this.getSystemPromptConfig().template;
  }

  getSystemPromptPrefix(): string {
    return this.getSystemPromptConfig().customPrefix;
  }

  getSystemPromptSuffix(): string {
    return this.getSystemPromptConfig().customSuffix;
  }

  getPinnedPromptWorkspaceDefault(workspaceUri: string): PinnedPromptWorkspaceDefault | null {
    const defaults = this.getSystemPromptConfig().pinnedPromptWorkspaceDefaults || {};
    return defaults[workspaceUri] || null;
  }

  async setPinnedPromptWorkspaceDefault(
    workspaceUri: string,
    value: PinnedPromptWorkspaceDefault | null
  ): Promise<void> {
    const nextDefaults = { ...(this.getSystemPromptConfig().pinnedPromptWorkspaceDefaults || {}) };

    if (value) {
      nextDefaults[workspaceUri] = value;
    } else {
      delete nextDefaults[workspaceUri];
    }

    await this.updateSystemPromptConfig({ pinnedPromptWorkspaceDefaults: nextDefaults });
  }

  getTokenCountConfig(): Readonly<TokenCountConfig> {
    return this.settings.toolsConfig?.token_count || DEFAULT_TOKEN_COUNT_CONFIG;
  }

  async updateTokenCountConfig(config: Partial<TokenCountConfig>): Promise<void> {
    await this.updateToolsConfigEntry('token_count', this.getTokenCountConfig(), config);
  }

  isTokenCountEnabled(channelType: 'gemini' | 'openai' | 'anthropic' | 'openai-responses'): boolean {
    const config = this.getTokenCountConfig();
    return config[channelType]?.enabled ?? false;
  }
}

