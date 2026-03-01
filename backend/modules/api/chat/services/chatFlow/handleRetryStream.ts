import { t } from '../../../../../i18n';
import type { RetryRequestData, ChatStreamToolIterationData } from '../../types';
import type { ChatFlowContext } from './context';
import {
  ensureConversation,
  getMaxToolIterations,
  OPENAI_RESPONSES_CONTINUATION_KEY,
} from './context';
import type { ChatStreamOutput } from './types';

export async function* handleRetryStream(
  ctx: ChatFlowContext,
  request: RetryRequestData,
): AsyncGenerator<ChatStreamOutput> {
  const { conversationId, configId } = request;

  await ensureConversation(ctx, conversationId);

  const config = await ctx.configManager.getConfig(configId);
  if (!config) {
    yield {
      conversationId,
      error: {
        code: 'CONFIG_NOT_FOUND',
        message: t('modules.api.chat.errors.configNotFound', { configId }),
      },
    };
    return;
  }

  if (!config.enabled) {
    yield {
      conversationId,
      error: {
        code: 'CONFIG_DISABLED',
        message: t('modules.api.chat.errors.configDisabled', { configId }),
      },
    };
    return;
  }

  ctx.diffInterruptService.markUserInterrupt();

  const orphanedFunctionCalls = await ctx.orphanedToolCallService.checkAndExecuteOrphanedFunctionCalls(
    conversationId,
  );
  if (orphanedFunctionCalls) {
    await ctx.tokenEstimationService.preCountUserMessageTokens(conversationId, config.type);

    yield {
      conversationId,
      content: orphanedFunctionCalls.functionCallContent,
      toolIteration: true as const,
      toolResults: orphanedFunctionCalls.toolResults,
    } satisfies ChatStreamToolIterationData;
  }

  ctx.diffInterruptService.resetUserInterrupt();

  const retryHistoryCheck = await ctx.conversationManager.getHistoryRef(conversationId);
  const isRetryFirstMessage = retryHistoryCheck.length === 1 && retryHistoryCheck[0].role === 'user';

  await ctx.conversationManager.setCustomMetadata(
    conversationId,
    OPENAI_RESPONSES_CONTINUATION_KEY,
    null,
  );

  const maxToolIterations = getMaxToolIterations(ctx);

  for await (const output of ctx.toolIterationLoopService.runToolLoop({
    conversationId,
    configId,
    config,
    abortSignal: request.abortSignal,
    isFirstMessage: isRetryFirstMessage,
    maxIterations: maxToolIterations,
    createBeforeModelCheckpoint: false,
  })) {
    yield output as ChatStreamOutput;
  }
}

