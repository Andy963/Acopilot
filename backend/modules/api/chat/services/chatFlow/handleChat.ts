import { t } from '../../../../../i18n';
import type { ChatErrorData, ChatRequestData, ChatSuccessData } from '../../types';
import { resolveLocateModeParams } from '../locateMode';
import { buildOpenFileContextBlock } from '../openFileContext';
import { resolveChatModePolicy } from '../chatMode';
import type { ChatFlowContext } from './context';
import { ensureConversation, getMaxToolIterations } from './context';

export async function handleChat(
  ctx: ChatFlowContext,
  request: ChatRequestData,
): Promise<ChatSuccessData | ChatErrorData> {
  const { conversationId, configId, message } = request;

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
    return { success: false, error: locate.error };
  }

  const { effectiveMessage, effectiveContextOverrides, effectiveTaskContext } = locate;

  const openFileContext =
    chatModePolicy.chatMode === 'chat'
      ? await buildOpenFileContextBlock(request.openFiles, {
          ignorePatterns: ctx.settingsManager?.getContextIgnorePatterns?.() ?? [],
        })
      : undefined;

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

  const maxToolIterations = chatModePolicy.maxToolIterations ?? getMaxToolIterations(ctx);
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

