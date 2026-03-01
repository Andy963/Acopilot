import * as vscode from 'vscode';
import * as path from 'path';
import { t } from '../../../backend/i18n';
import type { MessageHandler } from '../../types';

export const revealConversationInExplorer: MessageHandler = async (data, requestId, ctx) => {
  try {
    const { conversationId } = data;
    const conversationsDir = ctx.storagePathManager.getConversationsPath();
    const conversationFile = vscode.Uri.file(path.join(conversationsDir, `${conversationId}.json`));

    try {
      await vscode.workspace.fs.stat(conversationFile);
    } catch {
      throw new Error(t('webview.errors.conversationFileNotExists'));
    }

    await vscode.commands.executeCommand('revealFileInOS', conversationFile);
    ctx.sendResponse(requestId, { success: true });
  } catch (error: any) {
    ctx.sendError(requestId, 'REVEAL_IN_EXPLORER_ERROR', error.message || t('webview.errors.cannotRevealInExplorer'));
  }
};

