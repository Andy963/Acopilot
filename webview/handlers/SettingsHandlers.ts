/**
 * 设置管理消息处理器
 */

import * as vscode from 'vscode';
import { t } from '../../backend/i18n';
import type { PinnedPromptPreset } from '../../backend/modules/settings/types';
import { testGenerateImageConnection as runGenerateImageConnectionTest } from '../../backend/tools/media/generateImageHelpers';
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

export const testGenerateImageConnection: MessageHandler = async (data, requestId, ctx) => {
  try {
    const currentConfig = ctx.settingsManager.getGenerateImageConfig();
    const incomingConfig = isRecord(data) && isRecord(data.config) ? data.config : {};
    const result = await runGenerateImageConnectionTest({
      ...currentConfig,
      ...incomingConfig,
      proxyUrl: ctx.settingsManager.getEffectiveProxyUrl()
    } as any);
    ctx.sendResponse(requestId, result);
  } catch (error: any) {
    ctx.sendResponse(requestId, {
      success: false,
      error: error.message || t('webview.errors.getGenerateImageConfigFailed')
    });
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizePinnedPromptPresets(raw: unknown): PinnedPromptPreset[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter(isRecord)
    .map((preset) => ({
      id: String(preset.id || '').trim(),
      name: String(preset.name || '').trim(),
      prompt: String(preset.prompt || ''),
      createdAt: typeof preset.createdAt === 'number' ? preset.createdAt : undefined,
      updatedAt: typeof preset.updatedAt === 'number' ? preset.updatedAt : undefined,
    }))
    .filter((preset) => preset.id && preset.name && preset.prompt.trim());
}

function slugifyPresetName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return base || 'prompt';
}

function uniquePresetId(existingPresets: PinnedPromptPreset[], name: string): string {
  const base = `prompt-${slugifyPresetName(name)}`;
  if (!existingPresets.some((preset) => preset.id === base)) return base;

  let suffix = 2;
  while (existingPresets.some((preset) => preset.id === `${base}-${suffix}`)) suffix++;
  return `${base}-${suffix}`;
}

export const pinnedPromptPresetsList: MessageHandler = async (data, requestId, ctx) => {
  try {
    const config = ctx.settingsManager.getSystemPromptConfig();
    ctx.sendResponse(requestId, { presets: normalizePinnedPromptPresets(config.pinnedPromptPresets) });
  } catch (error: any) {
    ctx.sendError(requestId, 'PINNED_PROMPT_PRESETS_LIST_ERROR', error.message || t('webview.errors.getSystemPromptConfigFailed'));
  }
};

export const pinnedPromptPresetsSave: MessageHandler = async (data, requestId, ctx) => {
  try {
    const rawPreset = isRecord(data) && isRecord(data.preset) ? data.preset : {};
    const name = String(rawPreset.name || '').trim();
    const prompt = String(rawPreset.prompt || '').trim();

    if (!name || !prompt) {
      ctx.sendError(requestId, 'PINNED_PROMPT_PRESETS_SAVE_ERROR', 'Preset name and prompt are required');
      return;
    }

    const existingPresets = normalizePinnedPromptPresets(ctx.settingsManager.getSystemPromptConfig().pinnedPromptPresets);
    const requestedId = String(rawPreset.id || '').trim();
    const now = Date.now();
    const existingIndex = requestedId
      ? existingPresets.findIndex((preset) => preset.id === requestedId)
      : -1;

    const preset: PinnedPromptPreset = {
      id: existingIndex >= 0 ? existingPresets[existingIndex].id : uniquePresetId(existingPresets, name),
      name,
      prompt,
      createdAt: existingIndex >= 0 ? existingPresets[existingIndex].createdAt : now,
      updatedAt: now,
    };

    const nextPresets = [...existingPresets];
    if (existingIndex >= 0) {
      nextPresets[existingIndex] = preset;
    } else {
      nextPresets.push(preset);
    }

    await ctx.settingsManager.updatePinnedPromptPresets(nextPresets);
    ctx.sendResponse(requestId, { preset, presets: nextPresets });
  } catch (error: any) {
    ctx.sendError(requestId, 'PINNED_PROMPT_PRESETS_SAVE_ERROR', error.message || t('webview.errors.updateSystemPromptConfigFailed'));
  }
};

export const pinnedPromptPresetsDelete: MessageHandler = async (data, requestId, ctx) => {
  try {
    const id = isRecord(data) ? String(data.id || '').trim() : '';
    if (!id) {
      ctx.sendError(requestId, 'PINNED_PROMPT_PRESETS_DELETE_ERROR', 'Preset id is required');
      return;
    }

    const existingPresets = normalizePinnedPromptPresets(ctx.settingsManager.getSystemPromptConfig().pinnedPromptPresets);
    const nextPresets = existingPresets.filter((preset) => preset.id !== id);
    await ctx.settingsManager.updatePinnedPromptPresets(nextPresets);
    ctx.sendResponse(requestId, { presets: nextPresets });
  } catch (error: any) {
    ctx.sendError(requestId, 'PINNED_PROMPT_PRESETS_DELETE_ERROR', error.message || t('webview.errors.updateSystemPromptConfigFailed'));
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
  registry.set('testGenerateImageConnection', testGenerateImageConnection);
  registry.set('getSystemPromptConfig', getSystemPromptConfig);
  registry.set('updateSystemPromptConfig', updateSystemPromptConfig);
  registry.set('countSystemPromptTokens', countSystemPromptTokens);
  registry.set('installSkillFromUrl', installSkillFromUrl);
  registry.set('skills.list', skillsList);
  registry.set('pinnedPromptPresets.list', pinnedPromptPresetsList);
  registry.set('pinnedPromptPresets.save', pinnedPromptPresetsSave);
  registry.set('pinnedPromptPresets.delete', pinnedPromptPresetsDelete);
  registry.set('getPinnedPromptWorkspaceDefault', getPinnedPromptWorkspaceDefault);
  registry.set('setPinnedPromptWorkspaceDefault', setPinnedPromptWorkspaceDefault);
}
