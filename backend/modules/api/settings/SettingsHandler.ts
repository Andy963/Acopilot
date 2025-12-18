/**
 * LimCode - 设置处理器
 *
 * 负责处理设置相关的所有请求
 */

import { t } from '../../../i18n';
import type { SettingsManager } from '../../settings/SettingsManager';
import type { ToolRegistry } from '../../../tools/ToolRegistry';
import type {
    GetSettingsRequest,
    GetSettingsResponse,
    UpdateSettingsRequest,
    UpdateSettingsResponse,
    SetActiveChannelRequest,
    SetToolEnabledRequest,
    SetToolsEnabledRequest,
    SetDefaultToolModeRequest,
    UpdateUISettingsRequest,
    UpdateProxySettingsRequest,
    ResetSettingsRequest,
    GetToolsListRequest,
    GetToolsListResponse,
    ToolInfo,
    GetToolConfigRequest,
    GetToolConfigResponse,
    UpdateToolConfigRequest,
    UpdateToolConfigResponse,
    UpdateListFilesConfigRequest,
    UpdateApplyDiffConfigRequest
} from './types';

/**
 * 设置处理器
 * 
 * 职责：
 * 1. 获取和更新全局设置
 * 2. 管理工具启用状态
 * 3. 管理活动渠道
 * 4. 处理 UI 设置
 */
export class SettingsHandler {
    constructor(
        private settingsManager: SettingsManager,
        private toolRegistry?: ToolRegistry
    ) {}
    
    /**
     * 获取设置
     */
    async getSettings(request: GetSettingsRequest): Promise<GetSettingsResponse> {
        try {
            const settings = this.settingsManager.getSettings();
            
            return {
                success: true,
                settings
            };
        } catch (error) {
            const err = error as any;
            return {
                success: false,
                error: {
                    code: err.code || 'UNKNOWN_ERROR',
                    message: err.message || t('modules.api.settings.errors.getSettingsFailed')
                }
            };
        }
    }
    
    /**
     * 更新设置
     */
    async updateSettings(request: UpdateSettingsRequest): Promise<UpdateSettingsResponse> {
        try {
            await this.settingsManager.updateSettings(request.settings);
            const settings = this.settingsManager.getSettings();
            
            return {
                success: true,
                settings
            };
        } catch (error) {
            const err = error as any;
            return {
                success: false,
                error: {
                    code: err.code || 'UNKNOWN_ERROR',
                    message: err.message || t('modules.api.settings.errors.updateSettingsFailed')
                }
            };
        }
    }
    
    /**
     * 设置活动渠道
     */
    async setActiveChannel(request: SetActiveChannelRequest): Promise<UpdateSettingsResponse> {
        try {
            await this.settingsManager.setActiveChannelId(request.channelId);
            const settings = this.settingsManager.getSettings();
            
            return {
                success: true,
                settings
            };
        } catch (error) {
            const err = error as any;
            return {
                success: false,
                error: {
                    code: err.code || 'UNKNOWN_ERROR',
                    message: err.message || t('modules.api.settings.errors.setActiveChannelFailed')
                }
            };
        }
    }
    
    /**
     * 设置单个工具启用状态
     */
    async setToolEnabled(request: SetToolEnabledRequest): Promise<UpdateSettingsResponse> {
        try {
            await this.settingsManager.setToolEnabled(request.toolName, request.enabled);
            const settings = this.settingsManager.getSettings();
            
            return {
                success: true,
                settings
            };
        } catch (error) {
            const err = error as any;
            return {
                success: false,
                error: {
                    code: err.code || 'UNKNOWN_ERROR',
                    message: err.message || t('modules.api.settings.errors.setToolStatusFailed')
                }
            };
        }
    }
    
    /**
     * 批量设置工具启用状态
     */
    async setToolsEnabled(request: SetToolsEnabledRequest): Promise<UpdateSettingsResponse> {
        try {
            await this.settingsManager.setToolsEnabled(request.toolsEnabled);
            const settings = this.settingsManager.getSettings();
            
            return {
                success: true,
                settings
            };
        } catch (error) {
            const err = error as any;
            return {
                success: false,
                error: {
                    code: err.code || 'UNKNOWN_ERROR',
                    message: err.message || t('modules.api.settings.errors.batchSetToolStatusFailed')
                }
            };
        }
    }
    
    /**
     * 设置默认工具模式
     */
    async setDefaultToolMode(request: SetDefaultToolModeRequest): Promise<UpdateSettingsResponse> {
        try {
            await this.settingsManager.setDefaultToolMode(request.mode);
            const settings = this.settingsManager.getSettings();
            
            return {
                success: true,
                settings
            };
        } catch (error) {
            const err = error as any;
            return {
                success: false,
                error: {
                    code: err.code || 'UNKNOWN_ERROR',
                    message: err.message || t('modules.api.settings.errors.setDefaultToolModeFailed')
                }
            };
        }
    }
    
    /**
     * 更新 UI 设置
     */
    async updateUISettings(request: UpdateUISettingsRequest): Promise<UpdateSettingsResponse> {
        try {
            await this.settingsManager.updateUISettings(request.uiSettings);
            const settings = this.settingsManager.getSettings();
            
            return {
                success: true,
                settings
            };
        } catch (error) {
            const err = error as any;
            return {
                success: false,
                error: {
                    code: err.code || 'UNKNOWN_ERROR',
                    message: err.message || t('modules.api.settings.errors.updateUISettingsFailed')
                }
            };
        }
    }
    
    /**
     * 更新代理设置
     */
    async updateProxySettings(request: UpdateProxySettingsRequest): Promise<UpdateSettingsResponse> {
        try {
            await this.settingsManager.updateProxySettings(request.proxySettings);
            const settings = this.settingsManager.getSettings();
            
            return {
                success: true,
                settings
            };
        } catch (error) {
            const err = error as any;
            return {
                success: false,
                error: {
                    code: err.code || 'UNKNOWN_ERROR',
                    message: err.message || t('modules.api.settings.errors.updateProxySettingsFailed')
                }
            };
        }
    }
    
    /**
     * 重置设置
     */
    async resetSettings(request: ResetSettingsRequest): Promise<UpdateSettingsResponse> {
        try {
            await this.settingsManager.reset();
            const settings = this.settingsManager.getSettings();
            
            return {
                success: true,
                settings
            };
        } catch (error) {
            const err = error as any;
            return {
                success: false,
                error: {
                    code: err.code || 'UNKNOWN_ERROR',
                    message: err.message || t('modules.api.settings.errors.resetSettingsFailed')
                }
            };
        }
    }
    
    /**
     * 获取工具列表
     */
    async getToolsList(request: GetToolsListRequest): Promise<GetToolsListResponse> {
        try {
            if (!this.toolRegistry) {
                return {
                    success: false,
                    error: {
                        code: 'TOOL_REGISTRY_NOT_AVAILABLE',
                        message: t('modules.api.settings.errors.toolRegistryNotAvailable')
                    }
                };
            }
            
            // 获取所有工具
            const allTools = this.toolRegistry.getAllTools();
            
            // 构建工具信息列表
            const tools: ToolInfo[] = allTools.map(tool => ({
                name: tool.declaration.name,
                description: tool.declaration.description,
                enabled: this.settingsManager.isToolEnabled(tool.declaration.name),
                category: tool.declaration.category
            }));
            
            return {
                success: true,
                tools
            };
        } catch (error) {
            const err = error as any;
            return {
                success: false,
                error: {
                    code: err.code || 'UNKNOWN_ERROR',
                    message: err.message || t('modules.api.settings.errors.getToolsListFailed')
                }
            };
        }
    }
    
    /**
     * 获取工具配置
     */
    async getToolConfig(request: GetToolConfigRequest): Promise<GetToolConfigResponse> {
        try {
            const { toolName } = request;
            
            if (toolName === 'list_files') {
                const config = this.settingsManager.getListFilesConfig();
                return {
                    success: true,
                    config
                };
            }
            
            if (toolName === 'apply_diff') {
                const config = this.settingsManager.getApplyDiffConfig();
                return {
                    success: true,
                    config
                };
            }
            
            if (toolName === 'delete_file') {
                const config = this.settingsManager.getDeleteFileConfig();
                return {
                    success: true,
                    config
                };
            }
            
            // 获取通用工具配置
            const toolsConfig = this.settingsManager.getToolsConfig();
            const config = toolsConfig[toolName] || {};
            
            return {
                success: true,
                config
            };
        } catch (error) {
            const err = error as any;
            return {
                success: false,
                error: {
                    code: err.code || 'UNKNOWN_ERROR',
                    message: err.message || t('modules.api.settings.errors.getToolConfigFailed')
                }
            };
        }
    }
    
    /**
     * 更新工具配置
     */
    async updateToolConfig(request: UpdateToolConfigRequest): Promise<UpdateToolConfigResponse> {
        try {
            const { toolName, config } = request;
            
            await this.settingsManager.updateToolConfig(toolName, config);
            const settings = this.settingsManager.getSettings();
            
            return {
                success: true,
                settings
            };
        } catch (error) {
            const err = error as any;
            return {
                success: false,
                error: {
                    code: err.code || 'UNKNOWN_ERROR',
                    message: err.message || t('modules.api.settings.errors.updateToolConfigFailed')
                }
            };
        }
    }
    
    /**
     * 更新 list_files 配置
     */
    async updateListFilesConfig(request: UpdateListFilesConfigRequest): Promise<UpdateToolConfigResponse> {
        try {
            await this.settingsManager.updateListFilesConfig(request.config);
            const settings = this.settingsManager.getSettings();
            
            return {
                success: true,
                settings
            };
        } catch (error) {
            const err = error as any;
            return {
                success: false,
                error: {
                    code: err.code || 'UNKNOWN_ERROR',
                    message: err.message || t('modules.api.settings.errors.updateListFilesConfigFailed')
                }
            };
        }
    }
    
    /**
     * 更新 apply_diff 配置
     */
    async updateApplyDiffConfig(request: UpdateApplyDiffConfigRequest): Promise<UpdateToolConfigResponse> {
        try {
            await this.settingsManager.updateApplyDiffConfig(request.config);
            const settings = this.settingsManager.getSettings();
            
            return {
                success: true,
                settings
            };
        } catch (error) {
            const err = error as any;
            return {
                success: false,
                error: {
                    code: err.code || 'UNKNOWN_ERROR',
                    message: err.message || t('modules.api.settings.errors.updateApplyDiffConfigFailed')
                }
            };
        }
    }
    
    /**
     * 获取存档点配置
     */
    async getCheckpointConfig(): Promise<GetToolConfigResponse> {
        try {
            const config = this.settingsManager.getCheckpointConfig();
            return {
                success: true,
                config
            };
        } catch (error) {
            const err = error as any;
            return {
                success: false,
                error: {
                    code: err.code || 'UNKNOWN_ERROR',
                    message: err.message || t('modules.api.settings.errors.getCheckpointConfigFailed')
                }
            };
        }
    }
    
    /**
     * 更新存档点配置
     */
    async updateCheckpointConfig(request: { config: any }): Promise<UpdateToolConfigResponse> {
        try {
            await this.settingsManager.updateCheckpointConfig(request.config);
            const settings = this.settingsManager.getSettings();
            
            return {
                success: true,
                settings
            };
        } catch (error) {
            const err = error as any;
            return {
                success: false,
                error: {
                    code: err.code || 'UNKNOWN_ERROR',
                    message: err.message || t('modules.api.settings.errors.updateCheckpointConfigFailed')
                }
            };
        }
    }
    
    /**
     * 获取总结配置
     */
    async getSummarizeConfig(): Promise<GetToolConfigResponse> {
        try {
            const config = this.settingsManager.getSummarizeConfig();
            return {
                success: true,
                config
            };
        } catch (error) {
            const err = error as any;
            return {
                success: false,
                error: {
                    code: err.code || 'UNKNOWN_ERROR',
                    message: err.message || t('modules.api.settings.errors.getSummarizeConfigFailed')
                }
            };
        }
    }
    
    /**
     * 更新总结配置
     */
    async updateSummarizeConfig(request: { config: any }): Promise<UpdateToolConfigResponse> {
        try {
            await this.settingsManager.updateSummarizeConfig(request.config);
            const settings = this.settingsManager.getSettings();
            
            return {
                success: true,
                settings
            };
        } catch (error) {
            const err = error as any;
            return {
                success: false,
                error: {
                    code: err.code || 'UNKNOWN_ERROR',
                    message: err.message || t('modules.api.settings.errors.updateSummarizeConfigFailed')
                }
            };
        }
    }
    
    /**
     * 获取图像生成配置
     */
    async getGenerateImageConfig(): Promise<GetToolConfigResponse> {
        try {
            const config = this.settingsManager.getGenerateImageConfig();
            return {
                success: true,
                config
            };
        } catch (error) {
            const err = error as any;
            return {
                success: false,
                error: {
                    code: err.code || 'UNKNOWN_ERROR',
                    message: err.message || t('modules.api.settings.errors.getGenerateImageConfigFailed')
                }
            };
        }
    }
    
    /**
     * 更新图像生成配置
     */
    async updateGenerateImageConfig(request: { config: any }): Promise<UpdateToolConfigResponse> {
        try {
            await this.settingsManager.updateGenerateImageConfig(request.config);
            const settings = this.settingsManager.getSettings();
            
            return {
                success: true,
                settings
            };
        } catch (error) {
            const err = error as any;
            return {
                success: false,
                error: {
                    code: err.code || 'UNKNOWN_ERROR',
                    message: err.message || t('modules.api.settings.errors.updateGenerateImageConfigFailed')
                }
            };
        }
    }
}