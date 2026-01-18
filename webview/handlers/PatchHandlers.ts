/**
 * Patch / 文件改动审阅相关处理器
 *
 * 提供给前端用于：
 * - 获取工作区文件当前状态（hash/dirty）
 * - 应用指定内容到工作区文件（用于 hunk 级 apply/undo）
 * - 保存文件
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';
import { t } from '../../backend/i18n';
import { applyReplaceBlock } from '../../backend/tools/file/replaceBlock';
import type { MessageHandler } from '../types';

function hashContent(content: string): string {
  return crypto.createHash('sha1').update(content, 'utf8').digest('hex');
}

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
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

  // 尝试在所有工作区下查找该相对路径
  for (const folder of workspaceFolders) {
    const candidate = vscode.Uri.joinPath(folder.uri, normalized);
    try {
      const stat = await vscode.workspace.fs.stat(candidate);
      if (stat.type === vscode.FileType.File) {
        return candidate;
      }
    } catch {
      // ignore
    }
  }

  // 回退到第一个工作区
  return vscode.Uri.joinPath(workspaceFolders[0].uri, normalized);
}

export const getWorkspaceFileState: MessageHandler = async (data, requestId, ctx) => {
  try {
    const filePath = String(data?.path || '').trim();
    if (!filePath) {
      throw new Error('path is required');
    }

    const uri = await resolveWorkspaceFileUri(filePath);

    let exists = true;
    try {
      await vscode.workspace.fs.stat(uri);
    } catch {
      exists = false;
    }

    if (!exists) {
      ctx.sendResponse(requestId, { success: true, exists: false });
      return;
    }

    const openDoc = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri.toString());
    const content = openDoc ? openDoc.getText() : new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));

    ctx.sendResponse(requestId, {
      success: true,
      exists: true,
      isDirty: openDoc ? openDoc.isDirty : false,
      hash: hashContent(content),
      lineCount: content.split('\n').length,
      charCount: content.length
    });
  } catch (error: any) {
    ctx.sendError(requestId, 'GET_WORKSPACE_FILE_STATE_ERROR', error.message || t('webview.errors.openFileFailed'));
  }
};

export const applyWorkspaceFileContent: MessageHandler = async (data, requestId, ctx) => {
  try {
    const filePath = String(data?.path || '').trim();
    const content = typeof data?.content === 'string' ? data.content : '';
    const save = Boolean(data?.save);

    if (!filePath) {
      throw new Error('path is required');
    }

    const uri = await resolveWorkspaceFileUri(filePath);

    // 确保文件存在（新文件场景）
    try {
      await vscode.workspace.fs.stat(uri);
    } catch {
      const dir = path.dirname(uri.fsPath);
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(dir));
      await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(''));
    }

    const doc = await vscode.workspace.openTextDocument(uri);
    const currentText = doc.getText();
    const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(currentText.length));

    const edit = new vscode.WorkspaceEdit();
    edit.replace(uri, fullRange, content);
    await vscode.workspace.applyEdit(edit);

    if (save) {
      await doc.save();
    }

    ctx.sendResponse(requestId, { success: true });
  } catch (error: any) {
    ctx.sendError(requestId, 'APPLY_WORKSPACE_FILE_CONTENT_ERROR', error.message || t('webview.errors.openFileFailed'));
  }
};

export const applyWorkspaceFileDiffBlock: MessageHandler = async (data, requestId, ctx) => {
  try {
    const filePath = String(data?.path || '').trim();
    const from = typeof data?.from === 'string' ? data.from : '';
    const to = typeof data?.to === 'string' ? data.to : '';
    const startLine = data?.startLine === undefined ? undefined : Number(data.startLine);
    const save = Boolean(data?.save);

    if (!filePath) throw new Error('path is required');
    if (!from) throw new Error('from is required');

    const uri = await resolveWorkspaceFileUri(filePath);

    try {
      await vscode.workspace.fs.stat(uri);
    } catch {
      throw new Error(t('webview.errors.fileNotExists'));
    }

    const doc = await vscode.workspace.openTextDocument(uri);
    const currentText = doc.getText();

    const applied = applyReplaceBlock(currentText, from, to, { startLine });

    if (!applied.success) {
      ctx.sendResponse(requestId, {
        success: false,
        error: applied.error || 'Failed to apply diff block',
        matchCount: applied.matchCount
      });
      return;
    }

    const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(currentText.length));
    const edit = new vscode.WorkspaceEdit();
    edit.replace(uri, fullRange, applied.result);
    await vscode.workspace.applyEdit(edit);

    if (save) {
      await doc.save();
    }

    ctx.sendResponse(requestId, {
      success: true,
      matchedLine: applied.matchedLine,
      hash: hashContent(applied.result)
    });
  } catch (error: any) {
    ctx.sendError(requestId, 'APPLY_WORKSPACE_FILE_DIFF_BLOCK_ERROR', error.message || t('webview.errors.openFileFailed'));
  }
};

export const saveWorkspaceFile: MessageHandler = async (data, requestId, ctx) => {
  try {
    const filePath = String(data?.path || '').trim();
    if (!filePath) {
      throw new Error('path is required');
    }

    const uri = await resolveWorkspaceFileUri(filePath);
    const doc = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri.toString())
      || await vscode.workspace.openTextDocument(uri);

    const ok = await doc.save();
    ctx.sendResponse(requestId, { success: ok });
  } catch (error: any) {
    ctx.sendError(requestId, 'SAVE_WORKSPACE_FILE_ERROR', error.message || t('webview.errors.openFileFailed'));
  }
};

export const deleteWorkspaceFile: MessageHandler = async (data, requestId, ctx) => {
  try {
    const filePath = String(data?.path || '').trim();
    if (!filePath) {
      throw new Error('path is required');
    }

    const uri = await resolveWorkspaceFileUri(filePath);

    try {
      await vscode.workspace.fs.stat(uri);
    } catch {
      ctx.sendResponse(requestId, { success: true, deleted: false });
      return;
    }

    await vscode.workspace.fs.delete(uri, { recursive: false, useTrash: true });
    ctx.sendResponse(requestId, { success: true, deleted: true });
  } catch (error: any) {
    ctx.sendError(requestId, 'DELETE_WORKSPACE_FILE_ERROR', error.message || t('webview.errors.openFileFailed'));
  }
};

export function registerPatchHandlers(registry: Map<string, MessageHandler>): void {
  registry.set('patch.getWorkspaceFileState', getWorkspaceFileState);
  registry.set('patch.applyWorkspaceFileContent', applyWorkspaceFileContent);
  registry.set('patch.applyWorkspaceFileDiffBlock', applyWorkspaceFileDiffBlock);
  registry.set('patch.saveWorkspaceFile', saveWorkspaceFile);
  registry.set('patch.deleteWorkspaceFile', deleteWorkspaceFile);
}
