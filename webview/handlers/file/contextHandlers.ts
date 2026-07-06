import { t } from '../../../backend/i18n';
import type { MessageHandler } from '../../types';

export const summarizeContext: MessageHandler = async (data, requestId, ctx) => {
  try {
    const result = await ctx.chatHandler.handleSummarizeContext({
      conversationId: data.conversationId,
      configId: data.configId,
      regenerateSummaryIndex: data.regenerateSummaryIndex
    });
    ctx.sendResponse(requestId, result);
  } catch (error: any) {
    ctx.sendError(requestId, 'SUMMARIZE_ERROR', error.message || t('webview.errors.summarizeFailed'));
  }
};

