import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { t } from '../../../backend/i18n';
import type { MessageHandler } from '../../types';

export const previewAttachment: MessageHandler = async (data, requestId, ctx) => {
  try {
    const { name, data: base64Data } = data;

    const tempDir = path.join(os.tmpdir(), 'acopilot-preview');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const timestamp = Date.now();
    const safeFileName = String(name || 'attachment').replace(/[<>:"/\\|?*]/g, '_');
    const tempFilePath = path.join(tempDir, `${timestamp}_${safeFileName}`);

    const buffer = Buffer.from(String(base64Data || ''), 'base64');
    fs.writeFileSync(tempFilePath, buffer);

    await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(tempFilePath));
    ctx.sendResponse(requestId, { success: true });
  } catch (error: any) {
    ctx.sendError(requestId, 'PREVIEW_ATTACHMENT_ERROR', error.message || t('webview.errors.previewAttachmentFailed'));
  }
};

export const readWorkspaceImage: MessageHandler = async (data, requestId, ctx) => {
  try {
    const imgPath = String(data?.path || '').trim();

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      ctx.sendResponse(requestId, { success: false, error: t('webview.errors.noWorkspaceOpen') });
      return;
    }

    const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, imgPath);
    const content = await vscode.workspace.fs.readFile(fileUri);

    const ext = path.extname(imgPath).toLowerCase();
    let mimeType = 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') {
      mimeType = 'image/jpeg';
    } else if (ext === '.gif') {
      mimeType = 'image/gif';
    } else if (ext === '.webp') {
      mimeType = 'image/webp';
    } else if (ext === '.svg') {
      mimeType = 'image/svg+xml';
    } else if (ext === '.bmp') {
      mimeType = 'image/bmp';
    }

    const base64 = Buffer.from(content).toString('base64');

    ctx.sendResponse(requestId, { success: true, data: base64, mimeType });
  } catch (error: any) {
    ctx.sendResponse(requestId, { success: false, error: `Cannot read image: ${error.message}` });
  }
};

export const openWorkspaceFile: MessageHandler = async (data, requestId, ctx) => {
  try {
    const fileUri = await resolveWorkspaceFileUri(String(data?.path || ''));

    try {
      await vscode.workspace.fs.stat(fileUri);
    } catch {
      throw new Error(t('webview.errors.fileNotExists'));
    }

    await vscode.commands.executeCommand('vscode.open', fileUri);
    ctx.sendResponse(requestId, { success: true });
  } catch (error: any) {
    ctx.sendError(requestId, 'OPEN_WORKSPACE_FILE_ERROR', error.message || t('webview.errors.openFileFailed'));
  }
};

export const openWorkspaceFileAtLocation: MessageHandler = async (data, requestId, ctx) => {
  try {
    const filePath = String(data?.path || '').trim();
    const line = Number(data?.line);
    const column = data?.column === undefined ? 1 : Number(data?.column);

    if (!filePath) {
      throw new Error('path is required');
    }
    if (!Number.isFinite(line) || line <= 0) {
      throw new Error('line must be a positive number');
    }
    if (!Number.isFinite(column) || column <= 0) {
      throw new Error('column must be a positive number');
    }

    const fileUri = await resolveWorkspaceFileUri(filePath);

    try {
      await vscode.workspace.fs.stat(fileUri);
    } catch {
      throw new Error(t('webview.errors.fileNotExists'));
    }

    const doc = await vscode.workspace.openTextDocument(fileUri);
    const editor = await vscode.window.showTextDocument(doc, { preview: false });

    const lineIndex = Math.min(Math.max(line - 1, 0), Math.max(0, doc.lineCount - 1));
    const lineText = doc.lineAt(lineIndex).text;
    const colIndex = Math.min(Math.max(column - 1, 0), lineText.length);

    const pos = new vscode.Position(lineIndex, colIndex);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);

    ctx.sendResponse(requestId, { success: true });
  } catch (error: any) {
    ctx.sendError(requestId, 'OPEN_WORKSPACE_FILE_AT_LOCATION_ERROR', error.message || t('webview.errors.openFileFailed'));
  }
};

export const saveImageToPath: MessageHandler = async (data, requestId, ctx) => {
  try {
    const base64Data = String(data?.data || '');
    const imgPath = String(data?.path || '');

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error(t('webview.errors.noWorkspaceOpen'));
    }

    const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, imgPath);

    try {
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(fileUri.fsPath)));
    } catch {
      // ignore
    }

    const buffer = Buffer.from(base64Data, 'base64');
    await vscode.workspace.fs.writeFile(fileUri, buffer);

    ctx.sendResponse(requestId, { success: true });
  } catch (error: any) {
    ctx.sendResponse(requestId, { success: false, error: error.message || t('webview.errors.saveImageFailed') });
  }
};

async function resolveWorkspaceFileUri(filePath: string): Promise<vscode.Uri> {
  const trimmed = String(filePath || '').trim();
  if (!trimmed) {
    throw new Error('path is required');
  }

  if (trimmed.startsWith('file://')) {
    return vscode.Uri.parse(trimmed);
  }

  if (path.isAbsolute(trimmed)) {
    return vscode.Uri.file(trimmed);
  }

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    throw new Error(t('webview.errors.noWorkspaceOpen'));
  }

  const normalized = trimmed.replace(/\\/g, '/');

  // Support multi-root workspaces: `<workspace_name>/path/to/file`
  for (const folder of workspaceFolders) {
    const prefix = `${folder.name}/`;
    if (normalized.startsWith(prefix)) {
      return vscode.Uri.joinPath(folder.uri, normalized.slice(prefix.length));
    }
  }

  // Try to locate the file in each workspace folder.
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

  // Fallback to the first workspace folder (matches historical behavior).
  return vscode.Uri.joinPath(workspaceFolders[0].uri, normalized);
}

