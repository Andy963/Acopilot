/**
 * 设置管理消息处理器
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { t } from '../../backend/i18n';
import type { HandlerContext, MessageHandler } from '../types';

interface SkillDefinition {
  id: string;
  name: string;
  description?: string;
  prompt: string;
}

interface InstallSkillsSummary {
  found: number;
  installed: number;
  skippedExisting: number;
  invalid: number;
}

interface InstallSkillsFromUrlResult {
  skills: SkillDefinition[];
  summary: InstallSkillsSummary;
  skippedExisting: string[];
}

type GitHubContentItem = {
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  name: string;
  path: string;
  download_url?: string | null;
  url: string;
};

function getGitHubAuthHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

function encodeGitHubPath(p: string): string {
  return p
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
}

async function fetchGitHubJson<T = any>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Acopilot',
      'X-GitHub-Api-Version': '2022-11-28',
      ...getGitHubAuthHeaders()
    }
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`GitHub API error ${response.status}: ${text || response.statusText}`);
  }

  return (await response.json()) as T;
}

async function fetchGitHubBinary(url: string): Promise<Uint8Array> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/octet-stream',
      'User-Agent': 'Acopilot',
      ...getGitHubAuthHeaders()
    }
  });

  if (!response.ok) {
    throw new Error(`Download failed ${response.status}: ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

function parseGitHubUrl(input: string): { owner: string; repo: string; ref?: string; subPath?: string } {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error('Invalid URL');
  }

  if (url.hostname !== 'github.com') {
    throw new Error('Only github.com URLs are supported');
  }

  const parts = url.pathname.split('/').filter(Boolean);
  const owner = parts[0] || '';
  const repo = (parts[1] || '').replace(/\.git$/i, '');

  if (!owner || !repo) {
    throw new Error('Invalid GitHub repository URL');
  }

  const kind = parts[2];
  if (kind === 'tree' || kind === 'blob') {
    const ref = parts[3] || '';
    const subPath = parts.slice(4).join('/');
    return { owner, repo, ref: ref || undefined, subPath: subPath || undefined };
  }

  return { owner, repo };
}

async function getDefaultBranch(owner: string, repo: string): Promise<string> {
  const info = await fetchGitHubJson<{ default_branch?: string }>(`https://api.github.com/repos/${owner}/${repo}`);
  return info.default_branch || 'main';
}

async function listGitHubDirectory(owner: string, repo: string, ref: string, dirPath: string): Promise<GitHubContentItem[]> {
  const encoded = encodeGitHubPath(dirPath);
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encoded}?ref=${encodeURIComponent(ref)}`;
  const data = await fetchGitHubJson<any>(url);

  if (!Array.isArray(data)) {
    throw new Error(`Expected a directory at ${dirPath}`);
  }

  return data as GitHubContentItem[];
}

async function ensureDir(dirPath: string): Promise<void> {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

async function downloadGitHubDirectory(
  owner: string,
  repo: string,
  ref: string,
  remoteDirPath: string,
  localDirPath: string
): Promise<void> {
  const entries = await listGitHubDirectory(owner, repo, ref, remoteDirPath);
  await ensureDir(localDirPath);

  for (const entry of entries) {
    if (entry.type === 'dir') {
      await downloadGitHubDirectory(
        owner,
        repo,
        ref,
        entry.path,
        path.join(localDirPath, entry.name)
      );
      continue;
    }

    if (entry.type === 'file') {
      if (!entry.download_url) {
        continue;
      }

      const bytes = await fetchGitHubBinary(entry.download_url);
      const outPath = path.join(localDirPath, entry.name);
      await ensureDir(path.dirname(outPath));
      await fs.promises.writeFile(outPath, bytes);
    }
  }
}

function splitFrontMatter(markdown: string): { frontMatter: string; body: string } {
  const trimmed = markdown || '';
  if (!trimmed.startsWith('---')) {
    return { frontMatter: '', body: trimmed };
  }

  const match = trimmed.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) {
    return { frontMatter: '', body: trimmed };
  }

  return { frontMatter: match[1] || '', body: match[2] || '' };
}

function parseSimpleYaml(frontMatter: string): Record<string, string> {
  const out: Record<string, string> = {};

  for (const line of frontMatter.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const idx = trimmed.indexOf(':');
    if (idx === -1) continue;

    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();

    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (key) {
      out[key] = value;
    }
  }

  return out;
}

function normalizeSkillMarkdownPaths(skillDirName: string, markdown: string): string {
  // Some repos ship scripts inside `.codex/skills/<skill>/scripts/*` but the prompt refers to `.codex/scripts/*`.
  const targetPrefix = `.codex/skills/${skillDirName}/scripts`;
  return markdown
    .replace(/\.codex[\\/]scripts[\\/]/g, `${targetPrefix}/`)
    .replace(/\.codex[\\/]scripts\b/g, targetPrefix);
}

async function patchInstalledSkillMarkdown(localSkillDir: string): Promise<void> {
  const skillFilePath = path.join(localSkillDir, 'SKILL.md');

  try {
    const skillDirName = path.basename(localSkillDir);
    const scriptsDir = path.join(localSkillDir, 'scripts');

    if (!fs.existsSync(scriptsDir)) {
      return;
    }

    const stats = await fs.promises.stat(scriptsDir).catch(() => null);
    if (!stats || !stats.isDirectory()) {
      return;
    }

    const original = await fs.promises.readFile(skillFilePath, 'utf-8');
    const patched = normalizeSkillMarkdownPaths(skillDirName, original);

    if (patched !== original) {
      await fs.promises.writeFile(skillFilePath, patched, 'utf-8');
    }
  } catch {
    // ignore
  }
}

async function readInstalledSkill(localSkillDir: string): Promise<SkillDefinition | null> {
  const skillFilePath = path.join(localSkillDir, 'SKILL.md');
  try {
    const content = await fs.promises.readFile(skillFilePath, 'utf-8');
    const { frontMatter, body } = splitFrontMatter(content);
    const meta = frontMatter ? parseSimpleYaml(frontMatter) : {};

    const skillDirName = path.basename(localSkillDir);
    const id = (meta.name || skillDirName).trim();
    const name = (meta.name || id).trim();
    const description = (meta.description || '').trim();
    const promptSource = body.trim() || content.trim();
    const prompt = normalizeSkillMarkdownPaths(skillDirName, promptSource);

    return {
      id,
      name,
      description: description || undefined,
      prompt
    };
  } catch {
    return null;
  }
}

async function installCodexSkillsFromGitHubUrl(url: string, workspaceFsPath: string): Promise<InstallSkillsFromUrlResult> {
  const parsed = parseGitHubUrl(url);
  const ref = parsed.ref || await getDefaultBranch(parsed.owner, parsed.repo);

  let candidateBase = (parsed.subPath || '').replace(/^\/+/, '').replace(/\/+$/, '');
  if (candidateBase.endsWith('SKILL.md')) {
    candidateBase = path.posix.dirname(candidateBase).replace(/^\/+/, '').replace(/\/+$/, '');
  }

  const candidates: string[] = [];
  if (candidateBase) {
    candidates.push(candidateBase);
    candidates.push(`${candidateBase}/.codex/skills`);
    candidates.push(`${candidateBase}/.codex`);
  }
  candidates.push('.codex/skills');
  candidates.push('.codex');

  let remoteSkillsRoot: string | null = null;
  for (const candidate of candidates) {
    try {
      const entries = await listGitHubDirectory(parsed.owner, parsed.repo, ref, candidate);
      // If this directory contains SKILL.md, treat it as a single skill dir.
      if (entries.some(e => e.type === 'file' && e.name === 'SKILL.md')) {
        remoteSkillsRoot = candidate;
        break;
      }

      // Only treat `.codex/skills` as a skills root directory (avoid false positives on arbitrary paths).
      if (/(^|\/)\.codex\/skills$/.test(candidate)) {
        remoteSkillsRoot = candidate;
        break;
      }

      // Fallback: some repos put skills directly under `.codex/<skill>/SKILL.md` (no `skills/` subdir).
      if (/(^|\/)\.codex$/.test(candidate)) {
        remoteSkillsRoot = candidate;
        break;
      }
    } catch {
      // ignore and try next
    }
  }

  if (!remoteSkillsRoot) {
    throw new Error('NO_SKILLS_DIR');
  }

  const remoteEntries = await listGitHubDirectory(parsed.owner, parsed.repo, ref, remoteSkillsRoot);

  const localSkillsRoot = path.join(workspaceFsPath, '.codex', 'skills');
  await ensureDir(localSkillsRoot);

  const summary: InstallSkillsSummary = {
    found: 0,
    installed: 0,
    skippedExisting: 0,
    invalid: 0
  };
  const skippedExisting: string[] = [];
  const skillsById = new Map<string, SkillDefinition>();

  const isSingleSkillDir = remoteEntries.some(e => e.type === 'file' && e.name === 'SKILL.md');
  if (isSingleSkillDir) {
    const skillName = path.basename(remoteSkillsRoot);
    const localSkillDir = path.join(localSkillsRoot, skillName);

    summary.found = 1;

    if (fs.existsSync(localSkillDir)) {
      const existing = await readInstalledSkill(localSkillDir);
      if (existing) {
        skillsById.set(existing.id, existing);
        summary.skippedExisting += 1;
        skippedExisting.push(skillName);
      } else {
        summary.invalid += 1;
      }

      if (summary.installed === 0 && summary.skippedExisting === 0) {
        throw new Error('NO_VALID_SKILLS');
      }

      return { skills: Array.from(skillsById.values()), summary, skippedExisting };
    }

    await downloadGitHubDirectory(parsed.owner, parsed.repo, ref, remoteSkillsRoot, localSkillDir);
    await patchInstalledSkillMarkdown(localSkillDir);
    const skill = await readInstalledSkill(localSkillDir);
    if (skill) {
      skillsById.set(skill.id, skill);
      summary.installed += 1;
    } else {
      summary.invalid += 1;
    }

    if (summary.installed === 0 && summary.skippedExisting === 0) {
      throw new Error('NO_VALID_SKILLS');
    }

    return { skills: Array.from(skillsById.values()), summary, skippedExisting };
  }

  const skillDirs = remoteEntries.filter(e => e.type === 'dir');
  const isCodexRoot = /(^|\/)\.codex$/.test(remoteSkillsRoot);
  summary.found = isCodexRoot ? 0 : skillDirs.length;

  for (const dir of skillDirs) {
    const localSkillDir = path.join(localSkillsRoot, dir.name);
    const localExists = fs.existsSync(localSkillDir);

    // `.codex` root may contain non-skill folders; only treat dirs with SKILL.md as skills.
    if (isCodexRoot || !localExists) {
      const remoteDirEntries = await listGitHubDirectory(parsed.owner, parsed.repo, ref, dir.path).catch(() => null);
      if (!remoteDirEntries || !remoteDirEntries.some(e => e.type === 'file' && e.name === 'SKILL.md')) {
        // `.codex/skills` is an explicit skills root: mark missing SKILL.md as invalid.
        if (!isCodexRoot) {
          summary.invalid += 1;
        }
        continue;
      }

      if (isCodexRoot) {
        summary.found += 1;
      }
    }

    if (localExists) {
      // Skip existing skill directories (idempotent), but return the local SKILL.md if available.
      const existing = await readInstalledSkill(localSkillDir);
      if (existing) {
        skillsById.set(existing.id, existing);
        summary.skippedExisting += 1;
        skippedExisting.push(dir.name);
      } else {
        summary.invalid += 1;
      }
      continue;
    }

    await downloadGitHubDirectory(parsed.owner, parsed.repo, ref, dir.path, localSkillDir);
    await patchInstalledSkillMarkdown(localSkillDir);
    const skill = await readInstalledSkill(localSkillDir);
    if (skill) {
      skillsById.set(skill.id, skill);
      summary.installed += 1;
    } else {
      summary.invalid += 1;
    }
  }

  if (summary.found === 0) {
    throw new Error('NO_VALID_SKILLS');
  }

  if (summary.installed === 0 && summary.skippedExisting === 0) {
    throw new Error('NO_VALID_SKILLS');
  }

  return { skills: Array.from(skillsById.values()), summary, skippedExisting };
}

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
}
