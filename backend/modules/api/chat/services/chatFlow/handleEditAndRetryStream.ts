import { t } from '../../../../../i18n';
import type { EditAndRetryRequestData, ChatStreamCheckpointsData } from '../../types';
import type { ChatFlowContext } from './context';
import {
  ensureConversation,
  getMaxToolIterations,
  OPENAI_RESPONSES_CONTINUATION_KEY,
} from './context';
import type { ChatStreamOutput } from './types';

export async function* handleEditAndRetryStream(
  ctx: ChatFlowContext,
  request: EditAndRetryRequestData,
): AsyncGenerator<ChatStreamOutput> {
  const { conversationId, messageIndex, newMessage, configId } = request;

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

  const message = await ctx.conversationManager.getMessage(conversationId, messageIndex);
  if (!message) {
    yield {
      conversationId,
      error: {
        code: 'MESSAGE_NOT_FOUND',
        message: t('modules.api.chat.errors.messageNotFound', { messageIndex }),
      },
    };
    return;
  }

  if (message.role !== 'user') {
    yield {
      conversationId,
      error: {
        code: 'INVALID_MESSAGE_ROLE',
        message: t('modules.api.chat.errors.canOnlyEditUserMessage', { role: message.role }),
      },
    };
    return;
  }

  ctx.diffInterruptService.markUserInterrupt();

  await ctx.checkpointService.deleteCheckpointsFromIndex(conversationId, messageIndex);

  const beforeEditCheckpoint = await ctx.checkpointService.createUserMessageCheckpoint(
    conversationId,
    'before',
    messageIndex,
  );
  if (beforeEditCheckpoint) {
    yield {
      conversationId,
      checkpoints: [beforeEditCheckpoint],
      checkpointOnly: true as const,
    } satisfies ChatStreamCheckpointsData;
  }

  const editParts = ctx.messageBuilderService.buildUserMessageParts(newMessage, request.attachments);
  await ctx.conversationManager.updateMessage(conversationId, messageIndex, {
    parts: editParts,
  });

  await ctx.tokenEstimationService.preCountUserMessageTokens(conversationId, config.type, messageIndex, true);

  const historyRef = await ctx.conversationManager.getHistoryRef(conversationId);
  if (messageIndex + 1 < historyRef.length) {
    await ctx.conversationManager.deleteToMessage(conversationId, messageIndex + 1);
  }

  await ctx.conversationManager.setCustomMetadata(
    conversationId,
    OPENAI_RESPONSES_CONTINUATION_KEY,
    null,
  );

  const afterEditCheckpoint = await ctx.checkpointService.createUserMessageCheckpoint(
    conversationId,
    'after',
    messageIndex,
  );
  if (afterEditCheckpoint) {
    yield {
      conversationId,
      checkpoints: [afterEditCheckpoint],
      checkpointOnly: true as const,
    } satisfies ChatStreamCheckpointsData;
  }

  ctx.diffInterruptService.resetUserInterrupt();

  const isEditFirstMessage = messageIndex === 0;
  const maxToolIterations = getMaxToolIterations(ctx);

  for await (const output of ctx.toolIterationLoopService.runToolLoop({
    conversationId,
    configId,
    config,
    abortSignal: request.abortSignal,
    isFirstMessage: isEditFirstMessage,
    maxIterations: maxToolIterations,
  })) {
    yield output as ChatStreamOutput;
  }
}

