/**
 * Acopilot - 设置处理器
 *
 * 负责处理设置相关的所有请求
 */

import { t } from '../../../i18n';
import type { SettingsManager } from '../../settings/SettingsManager';
import type { ToolRegistry } from '../../../tools/ToolRegistry';
import { TokenCountService } from '../../channel/TokenCountService';
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
    private tokenCountService: TokenCountService;
    
    constructor(
        private settingsManager: SettingsManager,
        private toolRegistry?: ToolRegistry
    ) {
        const proxySettings = this.settingsManager.getProxySettings();
        this.tokenCountService = new TokenCountService(
            proxySettings?.enabled ? proxySettings.url : undefined
        );
    }
    
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

            if (toolName === 'generate_image') {
                const config = this.settingsManager.getGenerateImageConfig();
                return {
                    success: true,
                    config
                };
            }

            if (toolName === 'remove_background') {
                const config = this.settingsManager.getRemoveBackgroundConfig();
                return {
                    success: true,
                    config
                };
            }

            if (toolName === 'crop_image') {
                const config = this.settingsManager.getCropImageConfig();
                return {
                    success: true,
                    config
                };
            }

            if (toolName === 'resize_image') {
                const config = this.settingsManager.getResizeImageConfig();
                return {
                    success: true,
                    config
                };
            }

            if (toolName === 'rotate_image') {
                const config = this.settingsManager.getRotateImageConfig();
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
            
            // 优先使用特定更新方法
            if (toolName === 'list_files') {
                await this.settingsManager.updateListFilesConfig(config);
            } else if (toolName === 'find_files') {
                await this.settingsManager.updateFindFilesConfig(config);
            } else if (toolName === 'search_in_files') {
                await this.settingsManager.updateSearchInFilesConfig(config);
            } else if (toolName === 'apply_diff') {
                await this.settingsManager.updateApplyDiffConfig(config);
            } else if (toolName === 'delete_file') {
                await this.settingsManager.updateDeleteFileConfig(config);
            } else if (toolName === 'execute_command') {
                await this.settingsManager.updateExecuteCommandConfig(config);
            } else if (toolName === 'checkpoint') {
                await this.settingsManager.updateCheckpointConfig(config);
            } else if (toolName === 'summarize') {
                await this.settingsManager.updateSummarizeConfig(config);
            } else if (toolName === 'generate_image') {
                await this.settingsManager.updateGenerateImageConfig(config);
            } else if (toolName === 'remove_background') {
                await this.settingsManager.updateRemoveBackgroundConfig(config);
            } else if (toolName === 'crop_image') {
                await this.settingsManager.updateCropImageConfig(config);
            } else if (toolName === 'resize_image') {
                await this.settingsManager.updateResizeImageConfig(config);
            } else if (toolName === 'rotate_image') {
                await this.settingsManager.updateRotateImageConfig(config);
            } else if (toolName === 'context_awareness') {
                await this.settingsManager.updateContextAwarenessConfig(config);
            } else if (toolName === 'pinned_files') {
                await this.settingsManager.updatePinnedFilesConfig(config);
            } else if (toolName === 'system_prompt') {
                await this.settingsManager.updateSystemPromptConfig(config);
            } else if (toolName === 'token_count') {
                await this.settingsManager.updateTokenCountConfig(config);
            } else {
                // 通用更新
                await this.settingsManager.updateToolConfig(toolName, config);
            }
            
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
    
    /**
     * 计算系统提示词的 token 数
     *
     * @param request 包含文本内容和渠道类型
     * @returns token 计数结果
     */
    async countSystemPromptTokens(request: {
        text: string;
        channelType: 'gemini' | 'openai' | 'anthropic';
    }): Promise<{
        success: boolean;
        totalTokens?: number;
        error?: { code: string; message: string };
    }> {
        try {
            const { text, channelType } = request;
            
            // 获取 token 计数配置
            const tokenCountConfig = this.settingsManager.getTokenCountConfig();
            
            // 更新代理设置
            const proxySettings = this.settingsManager.getProxySettings();
            this.tokenCountService.setProxyUrl(
                proxySettings?.enabled ? proxySettings.url : undefined
            );
            
            // 构建一个简单的 Content 对象
            const contents = [{
                role: 'user' as const,
                parts: [{ text }]
            }];
            
            // 调用 token 计数服务
            const result = await this.tokenCountService.countTokens(
                channelType,
                tokenCountConfig,
                contents
            );
            
            if (result.success) {
                return {
                    success: true,
                    totalTokens: result.totalTokens
                };
            } else {
                return {
                    success: false,
                    error: {
                        code: 'TOKEN_COUNT_FAILED',
                        message: result.error || 'Token count failed'
                    }
                };
            }
        } catch (error) {
            const err = error as any;
            return {
                success: false,
                error: {
                    code: err.code || 'UNKNOWN_ERROR',
                    message: err.message || 'Token count failed'
                }
            };
        }
    }
}