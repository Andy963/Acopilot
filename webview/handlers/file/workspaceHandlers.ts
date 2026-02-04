import * as vscode from 'vscode';
import { t } from '../../../backend/i18n';
import type { MessageHandler } from '../../types';
import { getRelativePathFromAbsolute } from '../../utils/WorkspaceUtils';

export const getWorkspaceUri: MessageHandler = async (_data, requestId, ctx) => {
  const uri = ctx.getCurrentWorkspaceUri();
  ctx.sendResponse(requestId, uri);
};

export const getRelativePath: MessageHandler = async (data, requestId, ctx) => {
  try {
    const { absolutePath } = data;
    const relativePath = getRelativePathFromAbsolute(absolutePath);

    let isDirectory = false;
    try {
      let filePath = absolutePath;
      if (typeof absolutePath === 'string' && absolutePath.startsWith('file://')) {
        filePath = vscode.Uri.parse(absolutePath).fsPath;
      }

      const stat = await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
      isDirectory = stat.type === vscode.FileType.Directory;
    } catch {
      // ignore
    }

    ctx.sendResponse(requestId, { relativePath, isDirectory });
  } catch (error: any) {
    ctx.sendError(requestId, 'GET_RELATIVE_PATH_ERROR', error.message || t('webview.errors.getRelativePathFailed'));
  }
};

