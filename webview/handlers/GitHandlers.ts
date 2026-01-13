/**
 * Git 相关处理器
 *
 * 目标：为“差异/补丁工作流”提供最小化的 git 联动能力：
 * - 查询指定文件的 git 状态
 * - stage / unstage 指定文件
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as cp from 'child_process';
import { t } from '../../backend/i18n';
import type { MessageHandler } from '../types';

type GitFileStatus = {
  /** 两字符 porcelain 状态，如 " M" / "M " / "??" */
  xy: string;
  staged: boolean;
  unstaged: boolean;
  untracked: boolean;
  renamed?: boolean;
  path?: string;
};

function execGit(args: string[], cwd: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    cp.execFile('git', args, { cwd, encoding: 'utf8' }, (error, stdout, stderr) => {
      const anyErr = error as any;
      const code = typeof anyErr?.code === 'number' ? anyErr.code : 0;
      if (error && anyErr?.code === 'ENOENT') {
        reject(new Error('git not found'));
        return;
      }
      resolve({ stdout: stdout || '', stderr: stderr || '', code: typeof code === 'number' ? code : 0 });
    });
  });
}

async function resolveWorkspaceFileUri(filePath: string): Promise<vscode.Uri> {
  if (!filePath) {
    throw new Error('path is required');
  }

  if (filePath.startsWith('file://')) {
    return vscode.Uri.parse(filePath);
  }

  if (path.isAbsolute(filePath)) {
    return vscode.Uri.file(filePath);
  }

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    throw new Error(t('webview.errors.noWorkspaceOpen'));
  }

  const normalized = filePath.replace(/\\/g, '/');

  // 支持 multi-root：workspace_name/path 前缀
  for (const folder of workspaceFolders) {
    const prefix = `${folder.name}/`;
    if (normalized.startsWith(prefix)) {
      return vscode.Uri.joinPath(folder.uri, normalized.slice(prefix.length));
    }
  }

  return vscode.Uri.joinPath(workspaceFolders[0].uri, normalized);
}

async function getRepoRoot(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await execGit(['rev-parse', '--show-toplevel'], cwd);
    const root = stdout.trim();
    return root ? root : null;
  } catch {
    return null;
  }
}

function toGitPath(p: string): string {
  return p.replace(/\\/g, '/');
}

function parsePorcelainZ(output: string): Map<string, GitFileStatus> {
  const map = new Map<string, GitFileStatus>();
  const parts = output.split('\0').filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const entry = parts[i];
    if (entry.length < 3) continue;

    const xy = entry.slice(0, 2);
    const rest = entry.slice(3);

    const untracked = xy === '??';
    const staged = !untracked && xy[0] !== ' ';
    const unstaged = !untracked && xy[1] !== ' ';
    const renamed = (!untracked) && (xy[0] === 'R' || xy[1] === 'R' || xy[0] === 'C' || xy[1] === 'C');

    if (renamed && i + 1 < parts.length) {
      const newPath = parts[i + 1];
      map.set(newPath, { xy, staged, unstaged, untracked, renamed: true, path: newPath });
      i++;
      continue;
    }

    map.set(rest, { xy, staged, unstaged, untracked, path: rest });
  }
  return map;
}

export const getGitStatusForPaths: MessageHandler = async (data, requestId, ctx) => {
  try {
    const paths = Array.isArray(data?.paths) ? data.paths.map((p: any) => String(p || '').trim()).filter(Boolean) : [];
    if (paths.length === 0) {
      ctx.sendResponse(requestId, { success: true, statuses: {} });
      return;
    }

    const statuses: Record<string, GitFileStatus | { error: string }> = {};

    // 逐个文件获取状态（减少实现复杂度，已足够满足“仅展示本次改动文件”）
    for (const filePath of paths) {
      try {
        const uri = await resolveWorkspaceFileUri(filePath);
        const folder = vscode.workspace.getWorkspaceFolder(uri) || vscode.workspace.workspaceFolders?.[0];
        if (!folder) {
          statuses[filePath] = { error: t('webview.errors.noWorkspaceOpen') };
          continue;
        }

        const repoRoot = await getRepoRoot(folder.uri.fsPath);
        if (!repoRoot) {
          statuses[filePath] = { error: 'not a git repo' };
          continue;
        }

        const rel = path.relative(repoRoot, uri.fsPath);
        if (!rel || rel.startsWith('..')) {
          statuses[filePath] = { error: 'file not in repo' };
          continue;
        }

        const relGit = toGitPath(rel);
        const { stdout } = await execGit(['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', relGit], repoRoot);
        const map = parsePorcelainZ(stdout);
        statuses[filePath] = map.get(relGit) || { xy: '  ', staged: false, unstaged: false, untracked: false, path: relGit };
      } catch (e: any) {
        statuses[filePath] = { error: e?.message || String(e) };
      }
    }

    ctx.sendResponse(requestId, { success: true, statuses });
  } catch (error: any) {
    ctx.sendError(requestId, 'GET_GIT_STATUS_ERROR', error.message || 'Failed to get git status');
  }
};

export const stageGitFile: MessageHandler = async (data, requestId, ctx) => {
  try {
    const filePath = String(data?.path || '').trim();
    if (!filePath) {
      throw new Error('path is required');
    }

    const uri = await resolveWorkspaceFileUri(filePath);
    const folder = vscode.workspace.getWorkspaceFolder(uri) || vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      throw new Error(t('webview.errors.noWorkspaceOpen'));
    }

    const repoRoot = await getRepoRoot(folder.uri.fsPath);
    if (!repoRoot) {
      throw new Error('not a git repo');
    }

    const rel = path.relative(repoRoot, uri.fsPath);
    if (!rel || rel.startsWith('..')) {
      throw new Error('file not in repo');
    }

    const relGit = toGitPath(rel);
    await execGit(['add', '--', relGit], repoRoot);

    ctx.sendResponse(requestId, { success: true });
  } catch (error: any) {
    ctx.sendError(requestId, 'GIT_STAGE_FILE_ERROR', error.message || 'Failed to stage file');
  }
};

export const unstageGitFile: MessageHandler = async (data, requestId, ctx) => {
  try {
    const filePath = String(data?.path || '').trim();
    if (!filePath) {
      throw new Error('path is required');
    }

    const uri = await resolveWorkspaceFileUri(filePath);
    const folder = vscode.workspace.getWorkspaceFolder(uri) || vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      throw new Error(t('webview.errors.noWorkspaceOpen'));
    }

    const repoRoot = await getRepoRoot(folder.uri.fsPath);
    if (!repoRoot) {
      throw new Error('not a git repo');
    }

    const rel = path.relative(repoRoot, uri.fsPath);
    if (!rel || rel.startsWith('..')) {
      throw new Error('file not in repo');
    }

    const relGit = toGitPath(rel);

    // git restore --staged 在较新版本可用；失败则回退到 reset
    const restore = await execGit(['restore', '--staged', '--', relGit], repoRoot);
    if (restore.code !== 0) {
      await execGit(['reset', 'HEAD', '--', relGit], repoRoot);
    }

    ctx.sendResponse(requestId, { success: true });
  } catch (error: any) {
    ctx.sendError(requestId, 'GIT_UNSTAGE_FILE_ERROR', error.message || 'Failed to unstage file');
  }
};

export function registerGitHandlers(registry: Map<string, MessageHandler>): void {
  registry.set('git.getStatusForPaths', getGitStatusForPaths);
  registry.set('git.stageFile', stageGitFile);
  registry.set('git.unstageFile', unstageGitFile);
}
