import * as vscode from 'vscode';
import { t } from '../../../backend/i18n';
import type { MessageHandler } from '../../types';

export const showNotification: MessageHandler = async (data, requestId, ctx) => {
  try {
    const { message, type } = data;

    switch (type) {
      case 'error':
        vscode.window.showErrorMessage(message);
        break;
      case 'warning':
        vscode.window.showWarningMessage(message);
        break;
      case 'info':
      default:
        vscode.window.showInformationMessage(message);
        break;
    }

    ctx.sendResponse(requestId, { success: true });
  } catch (error: any) {
    ctx.sendError(requestId, 'SHOW_NOTIFICATION_ERROR', error.message || t('webview.errors.showNotificationFailed'));
  }
};

