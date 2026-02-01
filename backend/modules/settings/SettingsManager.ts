
import type {
    GlobalSettings,
    SettingsChangeEvent,
    SettingsChangeListener,
    ToolsEnabledState,
    ToolAutoExecConfig,
    ProxySettings,
    ToolsConfig,
    ListFilesToolConfig,
    FindFilesToolConfig,
    SearchInFilesToolConfig,
    ApplyDiffToolConfig,
    DeleteFileToolConfig,
    LocateToolConfig,
    ExecuteCommandToolConfig,
    ShellConfig,
    CheckpointConfig,
    SummarizeConfig,
    GenerateImageToolConfig,
    RemoveBackgroundToolConfig,
    CropImageToolConfig,
    ResizeImageToolConfig,
    RotateImageToolConfig,
    ContextAwarenessConfig,
    DiagnosticsConfig,
    PinnedFilesConfig,
    PinnedFileItem,
    SystemPromptConfig,
    StoragePathConfig,
    StorageStats,
    TokenCountConfig
} from './types';
import {
    DEFAULT_GLOBAL_SETTINGS,
    DEFAULT_LIST_FILES_CONFIG,
    DEFAULT_FIND_FILES_CONFIG,
    DEFAULT_SEARCH_IN_FILES_CONFIG,
    DEFAULT_APPLY_DIFF_CONFIG,
    DEFAULT_DELETE_FILE_CONFIG,
    DEFAULT_LOCATE_CONFIG,
    DEFAULT_CHECKPOINT_CONFIG,
    DEFAULT_TOOL_AUTO_EXEC_CONFIG,
    DEFAULT_SUMMARIZE_CONFIG,
    DEFAULT_GENERATE_IMAGE_CONFIG,
    DEFAULT_REMOVE_BACKGROUND_CONFIG,
    DEFAULT_CROP_IMAGE_CONFIG,
    DEFAULT_RESIZE_IMAGE_CONFIG,
    DEFAULT_ROTATE_IMAGE_CONFIG,
    DEFAULT_CONTEXT_AWARENESS_CONFIG,
    DEFAULT_DIAGNOSTICS_CONFIG,
    DEFAULT_PINNED_FILES_CONFIG,
    DEFAULT_SYSTEM_PROMPT_CONFIG,
    DEFAULT_MAX_TOOL_ITERATIONS,
    DEFAULT_TOKEN_COUNT_CONFIG,
    getDefaultExecuteCommandConfig
} from './types';

export interface SettingsStorage {

    load(): Promise<GlobalSettings | null>;

    save(settings: GlobalSettings): Promise<void>;
}

export class SettingsManager {
    private settings: GlobalSettings;
    private listeners: Set<SettingsChangeListener> = new Set();
    private storage: SettingsStorage;

    constructor(storage: SettingsStorage) {
        this.storage = storage;
        this.settings = { ...DEFAULT_GLOBAL_SETTINGS };
    }

    private ensureToolsConfig(): ToolsConfig {
        if (!this.settings.toolsConfig) {
            this.settings.toolsConfig = {};
        }
        return this.settings.toolsConfig;
    }

    private async commitChange(event: Omit<SettingsChangeEvent, 'settings'>): Promise<void> {
        this.settings.lastUpdated = Date.now();
        await this.storage.save(this.settings);
        this.notifyChange({ ...event, settings: this.settings });
    }

    private async updateToolsConfigEntry<T extends Record<string, unknown>>(
        toolKey: string,
        oldConfig: T,
        updates: Partial<T>
    ): Promise<T> {
        const newConfig = {
            ...oldConfig,
            ...updates
        } as T;

        this.ensureToolsConfig()[toolKey] = newConfig as any;

        await this.commitChange({
            type: 'tools',
            path: `toolsConfig.${toolKey}`,
            oldValue: oldConfig,
            newValue: newConfig
        });

        return newConfig;
    }

    private static normalizeLocateConfig(config: LocateToolConfig): LocateToolConfig {
        const model = typeof config.model === 'string' ? config.model.trim() : '';
        const autoTriggerEnabled =
            typeof config.autoTriggerEnabled === 'boolean'
                ? config.autoTriggerEnabled
                : (DEFAULT_LOCATE_CONFIG.autoTriggerEnabled ?? true);

        const triggerKeywords = Array.isArray(config.triggerKeywords)
            ? Array.from(new Set(
                config.triggerKeywords
                    .map((k) => typeof k === 'string' ? k.trim() : '')
                    .filter(Boolean)
            )).slice(0, 200)
            : undefined;

        return {
            ...config,
            model,
            autoTriggerEnabled,
            triggerKeywords: triggerKeywords ?? [...(DEFAULT_LOCATE_CONFIG.triggerKeywords || [])]
        };
    }

    async initialize(): Promise<void> {
        const stored = await this.storage.load();
        if (stored) {
            this.settings = {
                ...DEFAULT_GLOBAL_SETTINGS,
                ...stored,
                toolsEnabled: {
                    ...DEFAULT_GLOBAL_SETTINGS.toolsEnabled,
                    ...stored.toolsEnabled
                },
                toolsConfig: {
                    ...DEFAULT_GLOBAL_SETTINGS.toolsConfig,
                    ...stored.toolsConfig
                }
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
            lastUpdated: Date.now()
        };

        await this.storage.save(this.settings);

        this.notifyChange({
            type: 'full',
            oldValue: oldSettings,
            newValue: this.settings,
            settings: this.settings
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
            ...states
        };

        await this.commitChange({
            type: 'tools',
            path: 'toolsEnabled',
            oldValue,
            newValue: this.settings.toolsEnabled,
        });
    }

    getEnabledTools(allTools: string[]): string[] {
        return allTools.filter(name => this.isToolEnabled(name));
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
            ...config
        };

        await this.commitChange({
            type: 'tools',
            path: 'toolAutoExec',
            oldValue: oldConfig,
            newValue: this.settings.toolAutoExec,
        });
    }

    getToolsRequiringConfirmation(allTools: string[]): string[] {
        return allTools.filter(name => !this.isToolAutoExec(name));
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
            ...(stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {})
        };
        return SettingsManager.normalizeLocateConfig(merged);
    }

    async updateLocateConfig(config: Partial<LocateToolConfig>): Promise<void> {
        const oldConfig = this.getLocateConfig();
        const newConfig = SettingsManager.normalizeLocateConfig({
            ...oldConfig,
            ...config
        });

        this.ensureToolsConfig().locate = newConfig as any;

        await this.commitChange({
            type: 'tools',
            path: 'toolsConfig.locate',
            oldValue: oldConfig,
            newValue: newConfig
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
        return this.getExecuteCommandConfig().shells.filter(shell => shell.enabled);
    }

    getDefaultShell(): string {
        return this.getExecuteCommandConfig().defaultShell;
    }

    async setDefaultShell(shellType: string): Promise<void> {
        await this.updateExecuteCommandConfig({ defaultShell: shellType });
    }

    async updateShellConfig(shellType: string, updates: Partial<ShellConfig>): Promise<void> {
        const config = this.getExecuteCommandConfig();
        const shells = config.shells.map(shell =>
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
            return Array.from(new Set(tools.map(t => this.normalizeCheckpointToolName(t)).filter(Boolean)));
        };

        return {
            ...config,
            beforeTools: normalizeList(config.beforeTools),
            afterTools: normalizeList(config.afterTools),
            messageCheckpoint: config.messageCheckpoint ? { ...config.messageCheckpoint } : undefined,
            customIgnorePatterns: config.customIgnorePatterns ? [...config.customIgnorePatterns] : []
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
            ...config
        };
        const newConfig = this.normalizeCheckpointConfig(mergedConfig);

        this.ensureToolsConfig().checkpoint = newConfig;
        await this.commitChange({
            type: 'tools',
            path: 'toolsConfig.checkpoint',
            oldValue: oldConfig,
            newValue: newConfig
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
            ...proxySettings
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

    async updateSummarizeConfig(config: Partial<SummarizeConfig>): Promise<void> {
        await this.updateToolsConfigEntry('summarize', this.getSummarizeConfig(), config);
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
            ...config
        };

        await this.updateContextAwarenessConfig({
            ...contextConfig,
            diagnostics: newConfig
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
        return this.getPinnedFiles().filter(file => file.enabled);
    }

    async addPinnedFile(path: string, workspaceUri: string): Promise<PinnedFileItem> {
        const files = [...this.getPinnedFiles()];

        if (files.some(f => f.path === path && f.workspaceUri === workspaceUri)) {
            throw new Error(`File already pinned: ${path}`);
        }

        const newFile: PinnedFileItem = {
            id: `pinned_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            path,
            workspaceUri,
            enabled: true,
            addedAt: Date.now()
        };

        files.push(newFile);
        await this.updatePinnedFilesConfig({ files });

        return newFile;
    }

    getPinnedFilesForWorkspace(workspaceUri: string): PinnedFileItem[] {
        return this.getPinnedFiles().filter(f => f.workspaceUri === workspaceUri);
    }

    getEnabledPinnedFilesForWorkspace(workspaceUri: string): PinnedFileItem[] {
        return this.getPinnedFilesForWorkspace(workspaceUri).filter(f => f.enabled);
    }

    async removePinnedFile(id: string): Promise<void> {
        const files = this.getPinnedFiles().filter(f => f.id !== id);
        await this.updatePinnedFilesConfig({ files });
    }

    async setPinnedFileEnabled(id: string, enabled: boolean): Promise<void> {
        const files = this.getPinnedFiles().map(f =>
            f.id === id ? { ...f, enabled } : f
        );
        await this.updatePinnedFilesConfig({ files });
    }

    async updatePinnedFilePath(id: string, newPath: string): Promise<void> {
        const files = this.getPinnedFiles().map(f =>
            f.id === id ? { ...f, path: newPath } : f
        );
        await this.updatePinnedFilesConfig({ files });
    }

    async clearPinnedFiles(): Promise<void> {
        await this.updatePinnedFilesConfig({ files: [] });
    }

    isFilePinned(path: string): boolean {
        return this.getPinnedFiles().some(f => f.path === path);
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

    getSystemPromptTemplate(): string {
        return this.getSystemPromptConfig().template;
    }

    getSystemPromptPrefix(): string {
        return this.getSystemPromptConfig().customPrefix;
    }

    getSystemPromptSuffix(): string {
        return this.getSystemPromptConfig().customSuffix;
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

    getUISettings() {
        return this.settings.ui || {};
    }

    async updateUISettings(uiSettings: Partial<NonNullable<GlobalSettings['ui']>>): Promise<void> {
        const oldValue = this.settings.ui;
        this.settings.ui = {
            ...this.settings.ui,
            ...uiSettings
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
            Promise.resolve(listener(event)).catch(error => {
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
            ...config
        };

        this.settings.storagePath = newConfig;

        await this.commitChange({
            type: 'full',
            path: 'storagePath',
            oldValue: oldConfig,
            newValue: newConfig,
        });
    }

    async setCustomDataPath(path: string | undefined): Promise<void> {
        await this.updateStoragePathConfig({
            customDataPath: path,
            migrationStatus: path ? 'pending' : 'none'
        });
    }

    async markMigrationStarted(): Promise<void> {
        await this.updateStoragePathConfig({
            migrationStatus: 'in_progress'
        });
    }

    async markMigrationCompleted(): Promise<void> {
        await this.updateStoragePathConfig({
            migrationStatus: 'completed',
            lastMigrationAt: Date.now(),
            migrationError: undefined
        });
    }

    async markMigrationFailed(error: string): Promise<void> {
        await this.updateStoragePathConfig({
            migrationStatus: 'failed',
            migrationError: error
        });
    }

    async reset(): Promise<void> {
        const oldSettings = { ...this.settings };
        this.settings = {
            ...DEFAULT_GLOBAL_SETTINGS,
            lastUpdated: Date.now()
        };

        await this.storage.save(this.settings);

        this.notifyChange({
            type: 'full',
            oldValue: oldSettings,
            newValue: this.settings,
            settings: this.settings
        });
    }
}
