import { t } from '../../../../../i18n';
import type {
  ChatErrorData,
  ChatSuccessData,
  EditAndRetryRequestData,
} from '../../types';
import type { ChatFlowContext } from './context';
import {
  ensureConversation,
  getMaxToolIterations,
  OPENAI_RESPONSES_CONTINUATION_KEY,
} from './context';

export async function handleEditAndRetry(
  ctx: ChatFlowContext,
  request: EditAndRetryRequestData,
): Promise<ChatSuccessData | ChatErrorData> {
  const { conversationId, messageIndex, newMessage, configId } = request;

  await ensureConversation(ctx, conversationId);

  const config = await ctx.configManager.getConfig(configId);
  if (!config) {
    return {
      success: false,
      error: {
        code: 'CONFIG_NOT_FOUND',
        message: t('modules.api.chat.errors.configNotFound', { configId }),
      },
    };
  }

  if (!config.enabled) {
    return {
      success: false,
      error: {
        code: 'CONFIG_DISABLED',
        message: t('modules.api.chat.errors.configDisabled', { configId }),
      },
    };
  }

  const message = await ctx.conversationManager.getMessage(conversationId, messageIndex);
  if (!message) {
    return {
      success: false,
      error: {
        code: 'MESSAGE_NOT_FOUND',
        message: t('modules.api.chat.errors.messageNotFound', { messageIndex }),
      },
    };
  }

  if (message.role !== 'user') {
    return {
      success: false,
      error: {
        code: 'INVALID_MESSAGE_ROLE',
        message: t('modules.api.chat.errors.canOnlyEditUserMessage', { role: message.role }),
      },
    };
  }

  await ctx.conversationManager.updateMessage(conversationId, messageIndex, {
    parts: [{ text: newMessage }],
  });

  await ctx.tokenEstimationService.preCountUserMessageTokens(
    conversationId,
    config.type,
    messageIndex,
    true,
  );

  const historyRef = await ctx.conversationManager.getHistoryRef(conversationId);
  if (messageIndex + 1 < historyRef.length) {
    await ctx.checkpointService.deleteCheckpointsFromIndex(conversationId, messageIndex + 1);
    await ctx.conversationManager.deleteToMessage(conversationId, messageIndex + 1);
  }

  await ctx.conversationManager.setCustomMetadata(
    conversationId,
    OPENAI_RESPONSES_CONTINUATION_KEY,
    null,
  );

  const maxToolIterations = getMaxToolIterations(ctx);
  const loopResult = await ctx.toolIterationLoopService.runNonStreamLoop(
    conversationId,
    configId,
    config,
    maxToolIterations,
  );

  if (loopResult.exceededMaxIterations) {
    return {
      success: false,
      error: {
        code: 'MAX_TOOL_ITERATIONS',
        message: t('modules.api.chat.errors.maxToolIterations', { maxIterations: maxToolIterations }),
      },
    };
  }

  return {
    success: true,
    content: loopResult.content!,
  };
}

