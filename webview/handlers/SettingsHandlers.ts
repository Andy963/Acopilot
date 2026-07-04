/**
 * 设置管理消息处理器
 */

import * as vscode from 'vscode';
import { t } from '../../backend/i18n';
import type { HandlerContext, MessageHandler } from '../types';
import { installCodexSkillsFromGitHubUrl } from './codexSkillInstaller';

/**
 * 获取设置
 */
export const getSettings: MessageHandler = async (data, requestId, ctx) => {
  const result = await ctx.settingsHandler.getSettings({});
  ctx.sendResponse(requestId, result);
};

/**
 * 更新设置
 */
export const updateSettings: MessageHandler = async (data, requestId, ctx) => {
  const result = await ctx.settingsHandler.updateSettings(data);
  ctx.sendResponse(requestId, result);
};

/**
 * 更新代理设置
 */
export const updateProxySettings: MessageHandler = async (data, requestId, ctx) => {
  const result = await ctx.settingsHandler.updateProxySettings(data);
  ctx.sendResponse(requestId, result);
};

/**
 * 更新 UI 设置
 */
export const updateUISettings: MessageHandler = async (data, requestId, ctx) => {
  try {
    const { ui } = data;
    await ctx.settingsManager.updateUISettings(ui);
    
    // 如果语言设置变更，同步到后端 i18n
    if (ui.language) {
      ctx.syncLanguageToBackend();
    }
    
    ctx.sendResponse(requestId, { success: true });
  } catch (error: any) {
    ctx.sendError(requestId, 'UPDATE_UI_SETTINGS_ERROR', error.message || t('webview.errors.updateUISettingsFailed'));
  }
};

/**
 * 获取活动渠道 ID
 */
export const getActiveChannelId: MessageHandler = async (data, requestId, ctx) => {
  const channelId = ctx.settingsManager.getActiveChannelId();
  ctx.sendResponse(requestId, { channelId });
};

/**
 * 设置活动渠道 ID
 */
export const setActiveChannelId: MessageHandler = async (data, requestId, ctx) => {
  try {
    const { channelId } = data;
    await ctx.settingsManager.setActiveChannelId(channelId);
    ctx.sendResponse(requestId, { success: true });
  } catch (error: any) {
    ctx.sendError(requestId, 'SET_ACTIVE_CHANNEL_ERROR', error.message || t('webview.errors.setActiveChannelFailed'));
  }
};

/**
 * 获取总结配置
 */
export const getSummarizeConfig: MessageHandler = async (data, requestId, ctx) => {
  try {
    const config = ctx.settingsManager.getSummarizeConfig();
    ctx.sendResponse(requestId, config);
  } catch (error: any) {
    ctx.sendError(requestId, 'GET_SUMMARIZE_CONFIG_ERROR', error.message || t('webview.errors.getSummarizeConfigFailed'));
  }
};

/**
 * 更新总结配置
 */
export const updateSummarizeConfig: MessageHandler = async (data, requestId, ctx) => {
  try {
    const { config } = data;
    await ctx.settingsManager.updateSummarizeConfig(config);
    ctx.sendResponse(requestId, { success: true });
  } catch (error: any) {
    ctx.sendError(requestId, 'UPDATE_SUMMARIZE_CONFIG_ERROR', error.message || t('webview.errors.updateSummarizeConfigFailed'));
  }
};

/**
 * 获取图像生成配置
 */
export const getGenerateImageConfig: MessageHandler = async (data, requestId, ctx) => {
  try {
    const config = ctx.settingsManager.getGenerateImageConfig();
    ctx.sendResponse(requestId, config);
  } catch (error: any) {
    ctx.sendError(requestId, 'GET_GENERATE_IMAGE_CONFIG_ERROR', error.message || t('webview.errors.getGenerateImageConfigFailed'));
  }
};

/**
 * 更新图像生成配置
 */
export const updateGenerateImageConfig: MessageHandler = async (data, requestId, ctx) => {
  try {
    const { config } = data;
    await ctx.settingsManager.updateGenerateImageConfig(config);
    ctx.sendResponse(requestId, { success: true });
  } catch (error: any) {
    ctx.sendError(requestId, 'UPDATE_GENERATE_IMAGE_CONFIG_ERROR', error.message || t('webview.errors.updateGenerateImageConfigFailed'));
  }
};

/**
 * 获取系统提示词配置
 */
export const getSystemPromptConfig: MessageHandler = async (data, requestId, ctx) => {
  try {
    const config = ctx.settingsManager.getSystemPromptConfig();
    ctx.sendResponse(requestId, config);
  } catch (error: any) {
    ctx.sendError(requestId, 'GET_SYSTEM_PROMPT_CONFIG_ERROR', error.message || t('webview.errors.getSystemPromptConfigFailed'));
  }
};

/**
 * 更新系统提示词配置
 */
export const updateSystemPromptConfig: MessageHandler = async (data, requestId, ctx) => {
  try {
    const { config } = data;
    await ctx.settingsManager.updateSystemPromptConfig(config);
    ctx.sendResponse(requestId, { success: true });
  } catch (error: any) {
    ctx.sendError(requestId, 'UPDATE_SYSTEM_PROMPT_CONFIG_ERROR', error.message || t('webview.errors.updateSystemPromptConfigFailed'));
  }
};

/**
 * 获取可复用的 skills 列表（全局持久化，跨对话/跨项目共享）
 */
export const skillsList: MessageHandler = async (data, requestId, ctx) => {
  try {
    const config = ctx.settingsManager.getSystemPromptConfig();
    ctx.sendResponse(requestId, { skills: config.skills || [] });
  } catch (error: any) {
    ctx.sendError(requestId, 'SKILLS_LIST_ERROR', error.message || t('webview.errors.getSystemPromptConfigFailed'));
  }
};

/**
 * 获取当前 workspace 记住的固定提示词选择（用于新建对话时自动带入）
 */
export const getPinnedPromptWorkspaceDefault: MessageHandler = async (data, requestId, ctx) => {
  try {
    const workspaceUri = ctx.getCurrentWorkspaceUri();
    if (!workspaceUri) {
      ctx.sendResponse(requestId, { default: null });
      return;
    }

    const value = ctx.settingsManager.getPinnedPromptWorkspaceDefault(workspaceUri);
    ctx.sendResponse(requestId, { default: value });
  } catch (error: any) {
    ctx.sendError(requestId, 'GET_PINNED_PROMPT_WORKSPACE_DEFAULT_ERROR', error.message || t('webview.errors.getSystemPromptConfigFailed'));
  }
};

/**
 * 更新/清除当前 workspace 记住的固定提示词选择
 */
export const setPinnedPromptWorkspaceDefault: MessageHandler = async (data, requestId, ctx) => {
  try {
    const workspaceUri = ctx.getCurrentWorkspaceUri();
    if (!workspaceUri) {
      ctx.sendResponse(requestId, { success: false });
      return;
    }

    const { value } = data || {};
    await ctx.settingsManager.setPinnedPromptWorkspaceDefault(workspaceUri, value ?? null);
    ctx.sendResponse(requestId, { success: true });
  } catch (error: any) {
    ctx.sendError(requestId, 'SET_PINNED_PROMPT_WORKSPACE_DEFAULT_ERROR', error.message || t('webview.errors.updateSystemPromptConfigFailed'));
  }
};

/**
 * 计算系统提示词 Token 数
 */
export const countSystemPromptTokens: MessageHandler = async (data, requestId, ctx) => {
  try {
    const { text, channelType } = data;
    const result = await ctx.settingsHandler.countSystemPromptTokens({ text, channelType });
    if (result.success) {
      ctx.sendResponse(requestId, { success: true, totalTokens: result.totalTokens });
    } else {
      ctx.sendResponse(requestId, { success: false, error: result.error?.message });
    }
  } catch (error: any) {
    ctx.sendResponse(requestId, { success: false, error: error.message || 'Token count failed' });
  }
};

/**
 * 从 GitHub URL 安装 Codex skills（写入工作区 `.codex/skills`）
 */
export const installSkillFromUrl: MessageHandler = async (data, requestId, ctx) => {
  try {
    const { url } = data || {};
    if (!url || typeof url !== 'string') {
      ctx.sendError(requestId, 'INSTALL_SKILL_FROM_URL_ERROR', 'Invalid URL');
      return;
    }

    const workspaceUri = ctx.getCurrentWorkspaceUri();
    if (!workspaceUri) {
      ctx.sendError(requestId, 'INSTALL_SKILL_FROM_URL_ERROR', t('webview.errors.noWorkspaceOpen'));
      return;
    }

    const workspaceFsPath = vscode.Uri.parse(workspaceUri).fsPath;
    const result = await installCodexSkillsFromGitHubUrl(url, workspaceFsPath);
    ctx.sendResponse(requestId, { success: true, ...result });
  } catch (error: any) {
    ctx.sendError(requestId, 'INSTALL_SKILL_FROM_URL_ERROR', error.message || 'Install failed');
  }
};

/**
 * 注册设置管理处理器
 */
export function registerSettingsHandlers(registry: Map<string, MessageHandler>): void {
  registry.set('getSettings', getSettings);
  registry.set('updateSettings', updateSettings);
  registry.set('updateProxySettings', updateProxySettings);
  registry.set('updateUISettings', updateUISettings);
  registry.set('settings.getActiveChannelId', getActiveChannelId);
  registry.set('settings.setActiveChannelId', setActiveChannelId);
  registry.set('getSummarizeConfig', getSummarizeConfig);
  registry.set('updateSummarizeConfig', updateSummarizeConfig);
  registry.set('getGenerateImageConfig', getGenerateImageConfig);
  registry.set('updateGenerateImageConfig', updateGenerateImageConfig);
  registry.set('getSystemPromptConfig', getSystemPromptConfig);
  registry.set('updateSystemPromptConfig', updateSystemPromptConfig);
  registry.set('countSystemPromptTokens', countSystemPromptTokens);
  registry.set('installSkillFromUrl', installSkillFromUrl);
  registry.set('skills.list', skillsList);
  registry.set('getPinnedPromptWorkspaceDefault', getPinnedPromptWorkspaceDefault);
  registry.set('setPinnedPromptWorkspaceDefault', setPinnedPromptWorkspaceDefault);
}
