import { t } from '../../../../../i18n';
import type { ChatErrorData, ChatSuccessData, RetryRequestData } from '../../types';
import type { ChatFlowContext } from './context';
import {
  ensureConversation,
  getMaxToolIterations,
  OPENAI_RESPONSES_CONTINUATION_KEY,
} from './context';

export async function handleRetry(
  ctx: ChatFlowContext,
  request: RetryRequestData,
): Promise<ChatSuccessData | ChatErrorData> {
  const { conversationId, configId } = request;

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

