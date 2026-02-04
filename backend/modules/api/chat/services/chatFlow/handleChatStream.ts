import { t } from '../../../../../i18n';
import type { ChatRequestData, ChatStreamCheckpointsData } from '../../types';
import { resolveLocateModeParams } from '../locateMode';
import { buildOpenFileContextBlock } from '../openFileContext';
import { resolveChatModePolicy } from '../chatMode';
import type { ChatFlowContext } from './context';
import { ensureConversation, getMaxToolIterations } from './context';
import type { ChatStreamOutput } from './types';

export async function* handleChatStream(
  ctx: ChatFlowContext,
  request: ChatRequestData,
): AsyncGenerator<ChatStreamOutput> {
  const { conversationId, configId, message } = request;

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

  const chatModePolicy = resolveChatModePolicy({
    chatMode: request.chatMode ?? 'chat',
    contextOverrides: request.contextOverrides,
    taskContext: request.taskContext,
  });

  const locate = await resolveLocateModeParams({
    conversationManager: ctx.conversationManager,
    settingsManager: ctx.settingsManager,
    conversationId,
    message,
    contextOverrides: chatModePolicy.effectiveContextOverrides,
    taskContext: chatModePolicy.effectiveTaskContext,
  });

  if (locate.ok === false) {
    yield { conversationId, error: locate.error };
    return;
  }

  const { effectiveMessage, effectiveContextOverrides, effectiveTaskContext } = locate;

  const openFileContext =
    chatModePolicy.chatMode === 'chat'
      ? await buildOpenFileContextBlock(request.openFiles, {
          ignorePatterns: ctx.settingsManager?.getContextIgnorePatterns?.() ?? [],
        })
      : undefined;

  ctx.diffInterruptService.markUserInterrupt();

  const beforeUserCheckpoint = await ctx.checkpointService.createUserMessageCheckpoint(conversationId, 'before');
  if (beforeUserCheckpoint) {
    yield {
      conversationId,
      checkpoints: [beforeUserCheckpoint],
      checkpointOnly: true as const,
    } satisfies ChatStreamCheckpointsData;
  }

  const userParts = ctx.messageBuilderService.buildUserMessageParts(effectiveMessage, request.attachments);
  await ctx.conversationManager.addContent(conversationId, {
    role: 'user',
    parts: userParts,
    selectionReferences: request.selectionReferences,
    taskContext:
      typeof effectiveTaskContext === 'string' && effectiveTaskContext.trim() ? effectiveTaskContext : undefined,
    openFileContext,
    contextOverrides: effectiveContextOverrides,
  });

  await ctx.tokenEstimationService.preCountUserMessageTokens(conversationId, config.type);

  const afterUserCheckpoint = await ctx.checkpointService.createUserMessageCheckpoint(conversationId, 'after');
  if (afterUserCheckpoint) {
    yield {
      conversationId,
      checkpoints: [afterUserCheckpoint],
      checkpointOnly: true as const,
    } satisfies ChatStreamCheckpointsData;
  }

  ctx.diffInterruptService.resetUserInterrupt();

  const currentHistoryCheck = await ctx.conversationManager.getHistoryRef(conversationId);
  const isFirstMessage = currentHistoryCheck.length === 1;

  const maxToolIterations = chatModePolicy.maxToolIterations ?? getMaxToolIterations(ctx);

  for await (const output of ctx.toolIterationLoopService.runToolLoop({
    conversationId,
    configId,
    config,
    abortSignal: request.abortSignal,
    isFirstMessage,
    maxIterations: maxToolIterations,
  })) {
    yield output as ChatStreamOutput;
  }
}

