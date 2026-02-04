/**
 * Acopilot - 配置管理器
 *
 * 核心配置管理类，提供完整的 CRUD 和管理功能
 */

import { t } from '../../i18n';
import type {
    ChannelConfig,
    ChannelType,
    CreateConfigInput,
    UpdateConfigInput,
    ConfigStats,
    ValidationResult,
    ExportOptions,
    ImportOptions,
    ConfigFilter,
    ConfigSortOptions,
    GeminiConfig,
} from './types';
import type { ConfigStorageAdapter } from './storage';
import { nanoid } from 'nanoid';
import { getDefaultConfig as getDefaultConfigImpl } from './configDefaults';
import {
    getApiKeySecretKey,
    hydrateAndMigrateApiKey,
    stripApiKeyForStorage,
    tryDeleteSecret,
    tryStoreSecret,
    type SecretStorage
} from './configSecrets';
import { applyFilter, applySort } from './configQuery';
import { validateGeminiConfig, validateOpenAIConfig } from './configValidation';

/**
 * 配置管理器
 * 
 * 提供统一的配置管理接口，支持多种 LLM API 格式
 */
export class ConfigManager {
    /** 配置缓存（用于快速访问） */
    private configCache: Map<string, ChannelConfig> = new Map();
    
    /** 是否已加载 */
    private loaded: boolean = false;
    
    constructor(
        private storageAdapter: ConfigStorageAdapter,
        private secretStorage?: SecretStorage
    ) {}
    
    /**
     * 初始化管理器（加载所有配置到缓存）
     */
    private async ensureLoaded(): Promise<void> {
        if (this.loaded) {
            return;
        }
        
        const configIds = await this.storageAdapter.list();
        
        for (const id of configIds) {
            const config = await this.storageAdapter.load(id);
            if (config) {
                const hydrated = await hydrateAndMigrateApiKey({
                    config,
                    storageAdapter: this.storageAdapter,
                    secretStorage: this.secretStorage
                });
                this.configCache.set(id, hydrated);
            }
        }
        
        this.loaded = true;
    }
    
    // ========== CRUD 操作 ==========
    
    /**
     * 获取指定类型的默认配置
     *
     * @param type 渠道类型
     * @returns 默认配置（不含 id、createdAt、updatedAt）
     */
    getDefaultConfig(type: ChannelType): Record<string, any> {
        return getDefaultConfigImpl(type);
    }
    
    /**
     * 创建配置
     *
     * @param input 配置输入（不含 id、createdAt、updatedAt）
     * @returns 创建的配置 ID
     *
     * @example
     * ```typescript
     * const configId = await manager.createConfig({
     *     name: 'Gemini 2.5 Flash',
     *     type: 'gemini',
     *     enabled: true
     * });
     * ```
     */
    async createConfig(input: CreateConfigInput): Promise<string> {
        await this.ensureLoaded();
        
        // 生成唯一 ID
        const id = nanoid();
        const now = Date.now();
        
        // 获取默认配置并与输入合并
        const defaults = this.getDefaultConfig(input.type);
        
        // 构建完整配置（输入值覆盖默认值）
        const config: ChannelConfig = {
            ...defaults,
            ...input,
            id,
            createdAt: now,
            updatedAt: now
        } as ChannelConfig;

        const rawApiKey = typeof (config as any).apiKey === 'string' ? String((config as any).apiKey) : '';
        let canStripApiKey = Boolean(this.secretStorage);
        if (this.secretStorage && rawApiKey.trim().length > 0 && rawApiKey !== '***REDACTED***') {
            canStripApiKey = await tryStoreSecret(this.secretStorage, getApiKeySecretKey(id), rawApiKey);
        }

        // Save without apiKey when SecretStorage is available.
        await this.storageAdapter.save(canStripApiKey ? stripApiKeyForStorage(config, this.secretStorage) : config);
        this.configCache.set(id, config);
        
        return id;
    }
    
    /**
     * 获取配置
     * 
     * @param configId 配置 ID
     * @returns 配置对象，如果不存在返回 null
     */
    async getConfig(configId: string): Promise<ChannelConfig | null> {
        await this.ensureLoaded();
        
        const config = this.configCache.get(configId);
        return config ? JSON.parse(JSON.stringify(config)) : null;
    }
    
    /**
     * 更新配置
     * 
     * @param configId 配置 ID
     * @param updates 要更新的字段
     * 
     * @example
     * ```typescript
     * await manager.updateConfig('config-123', {
     *     name: '新名称',
     *     options: {
     *         temperature: 0.9
     *     }
     * });
     * ```
     */
    async updateConfig(configId: string, updates: UpdateConfigInput): Promise<void> {
        await this.ensureLoaded();
        
        const existing = this.configCache.get(configId);
        if (!existing) {
            throw new Error(t('modules.config.errors.configNotFound', { configId }));
        }

        const updatesCopy: Record<string, unknown> = { ...(updates as any) };
        const hasApiKeyUpdate = Object.prototype.hasOwnProperty.call(updatesCopy, 'apiKey');
        const apiKeyUpdate = hasApiKeyUpdate ? updatesCopy.apiKey : undefined;

        // Ignore redacted placeholder during import.
        if (apiKeyUpdate === '***REDACTED***') {
            delete updatesCopy.apiKey;
        }

        if (hasApiKeyUpdate && typeof apiKeyUpdate !== 'string') {
            delete updatesCopy.apiKey;
        }
        
        // 合并更新
        const updated: ChannelConfig = {
            ...existing,
            ...updatesCopy,
            id: configId,  // 保持 ID 不变
            type: existing.type,  // 保持类型不变
            createdAt: existing.createdAt,  // 保持创建时间
            updatedAt: Date.now()  // 更新时间
        } as ChannelConfig;

        let canStripApiKey = Boolean(this.secretStorage);
        if (this.secretStorage && hasApiKeyUpdate && apiKeyUpdate !== '***REDACTED***') {
            const secretKey = getApiKeySecretKey(configId);
            if (typeof apiKeyUpdate === 'string') {
                if (apiKeyUpdate.trim().length === 0) {
                    await tryDeleteSecret(this.secretStorage, secretKey);
                } else {
                    canStripApiKey = await tryStoreSecret(this.secretStorage, secretKey, apiKeyUpdate);
                }
            }
        }
        
        // 保存（不验证配置）
        await this.storageAdapter.save(canStripApiKey ? stripApiKeyForStorage(updated, this.secretStorage) : updated);
        this.configCache.set(configId, updated);
    }
    
    /**
     * 删除配置
     * 
     * @param configId 配置 ID
     */
    async deleteConfig(configId: string): Promise<void> {
        await this.ensureLoaded();
        
        if (!this.configCache.has(configId)) {
            throw new Error(t('modules.config.errors.configNotFound', { configId }));
        }

        await tryDeleteSecret(this.secretStorage, getApiKeySecretKey(configId));
        
        await this.storageAdapter.delete(configId);
        this.configCache.delete(configId);
    }
    
    /**
     * 列出所有配置
     * 
     * @param filter 过滤条件（可选）
     * @param sort 排序选项（可选）
     * @returns 配置列表
     */
    async listConfigs(
        filter?: ConfigFilter,
        sort?: ConfigSortOptions
    ): Promise<ChannelConfig[]> {
        await this.ensureLoaded();
        
        let configs = Array.from(this.configCache.values());
        
        // 应用过滤
        if (filter) {
            configs = applyFilter(configs, filter);
        }
        
        // 应用排序
        if (sort) {
            configs = applySort(configs, sort);
        }
        
        // 返回深拷贝
        return JSON.parse(JSON.stringify(configs));
    }
    
    /**
     * 按类型列出配置
     * 
     * @param type 渠道类型
     * @returns 配置列表
     */
    async listConfigsByType(type: ChannelType): Promise<ChannelConfig[]> {
        return this.listConfigs({ type });
    }
    
    /**
     * 列出启用的配置
     * 
     * @returns 配置列表
     */
    async listEnabledConfigs(): Promise<ChannelConfig[]> {
        return this.listConfigs({ enabled: true });
    }
    
    // ========== 配置管理 ==========
    
    /**
     * 启用/禁用配置
     * 
     * @param configId 配置 ID
     * @param enabled 是否启用
     */
    async setConfigEnabled(configId: string, enabled: boolean): Promise<void> {
        await this.updateConfig(configId, { enabled });
    }
    
    /**
     * 验证配置
     * 
     * @param config 要验证的配置
     * @returns 验证结果
     */
    async validateConfig(config: ChannelConfig): Promise<ValidationResult> {
        const errors: string[] = [];
        const warnings: string[] = [];
        
        // 基础字段验证
        if (!config.name || config.name.trim().length === 0) {
            errors.push(t('modules.config.validation.nameRequired'));
        }
        
        if (!config.type) {
            errors.push(t('modules.config.validation.typeRequired'));
        }
        
        // 根据类型进行特定验证
        switch (config.type) {
            case 'gemini':
                validateGeminiConfig(config as GeminiConfig, errors, warnings);
                break;
            
            case 'openai':
                validateOpenAIConfig(config as any, errors, warnings);
                break;
            
            case 'openai-responses':
                validateOpenAIConfig(config as any, errors, warnings);
                break;
            
            case 'anthropic':
                // TODO: 实现 Anthropic 验证
                warnings.push(t('modules.config.validation.anthropicNotImplemented'));
                break;
        }
        
        return {
            valid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
            warnings: warnings.length > 0 ? warnings : undefined
        };
    }
    
    /**
     * 获取统计信息
     * 
     * @returns 统计信息
     */
    async getStats(): Promise<ConfigStats> {
        await this.ensureLoaded();
        
        const configs = Array.from(this.configCache.values());
        
        // 计数
        const totalConfigs = configs.length;
        const enabledConfigs = configs.filter(c => c.enabled).length;
        const disabledConfigs = totalConfigs - enabledConfigs;
        
        // 按类型统计
        const byType: Record<ChannelType, number> = {
            gemini: 0,
            openai: 0,
            anthropic: 0,
            'openai-responses': 0
        };
        
        for (const config of configs) {
            byType[config.type]++;
        }
        
        // 最近创建的配置
        const sorted = [...configs].sort((a, b) => b.createdAt - a.createdAt);
        const recentConfigs = sorted.slice(0, 5).map(c => ({
            id: c.id,
            name: c.name,
            type: c.type,
            createdAt: c.createdAt
        }));
        
        return {
            totalConfigs,
            enabledConfigs,
            disabledConfigs,
            byType,
            recentConfigs
        };
    }
    
    /**
     * 导出配置
     * 
     * @param configId 配置 ID
     * @param options 导出选项
     * @returns 导出的 JSON 对象
     */
    async exportConfig(
        configId: string,
        options: ExportOptions = {}
    ): Promise<any> {
        const config = await this.getConfig(configId);
        if (!config) {
            throw new Error(t('modules.config.errors.configNotFound', { configId }));
        }
        
        const exported = { ...config };
        
        // 移除敏感信息
        if (!options.includeSensitive) {
            if ('apiKey' in exported) {
                (exported as any).apiKey = '***REDACTED***';
            }
        }
        
        return exported;
    }
    
    /**
     * 导入配置
     * 
     * @param configData 配置数据
     * @param options 导入选项
     * @returns 导入的配置 ID
     */
    async importConfig(
        configData: any,
        options: ImportOptions = {}
    ): Promise<string> {
        await this.ensureLoaded();

        const normalized = { ...(configData || {}) };
        if (normalized.apiKey === '***REDACTED***') {
            delete normalized.apiKey;
        }
        
        // 检查是否已存在
        if (normalized.id && this.configCache.has(normalized.id)) {
            if (!options.overwrite) {
                throw new Error(t('modules.config.errors.configExists', { configId: normalized.id }));
            }
            
            // 覆盖现有配置
            const { id, createdAt, ...updates } = normalized;
            await this.updateConfig(id, updates);
            return id;
        }
        
        // 创建新配置
        const { id, createdAt, updatedAt, ...input } = normalized;
        return this.createConfig(input);
    }
    
    /**
     * 检查配置是否存在
     * 
     * @param configId 配置 ID
     * @returns 是否存在
     */
    async exists(configId: string): Promise<boolean> {
        await this.ensureLoaded();
        return this.configCache.has(configId);
    }
}
