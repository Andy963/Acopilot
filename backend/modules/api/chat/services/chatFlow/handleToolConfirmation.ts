import { t } from '../../../../../i18n';
import type { ContentPart, ContextInjectionOverrides } from '../../../../conversation/types';
import type { CheckpointRecord } from '../../../../checkpoint';
import type {
  ToolConfirmationResponseData,
  ChatStreamToolIterationData,
  ChatStreamToolsExecutingData,
} from '../../types';
import type { ChatFlowContext } from './context';
import { ensureConversation, getMaxToolIterations } from './context';
import type { ChatStreamOutput } from './types';

export async function* handleToolConfirmation(
  ctx: ChatFlowContext,
  request: ToolConfirmationResponseData,
): AsyncGenerator<ChatStreamOutput> {
  const { conversationId, configId, toolResponses } = request;

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

  const history = await ctx.conversationManager.getHistoryRef(conversationId);
  if (history.length === 0) {
    yield {
      conversationId,
      error: {
        code: 'NO_HISTORY',
        message: t('modules.api.chat.errors.noHistory'),
      },
    };
    return;
  }

  const lastMessage = history[history.length - 1];
  if (lastMessage.role !== 'model') {
    yield {
      conversationId,
      error: {
        code: 'INVALID_STATE',
        message: t('modules.api.chat.errors.lastMessageNotModel'),
      },
    };
    return;
  }

  let lastUserContextOverrides: ContextInjectionOverrides | undefined;
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i] as any;
    if (!msg || msg.role !== 'user') continue;
    if (msg.isFunctionResponse === true) continue;
    if (msg.isSummary === true) continue;
    lastUserContextOverrides = msg.contextOverrides as ContextInjectionOverrides | undefined;
    break;
  }

  const functionCalls = ctx.toolCallParserService.extractFunctionCalls(lastMessage);
  if (functionCalls.length === 0) {
    yield {
      conversationId,
      error: {
        code: 'NO_FUNCTION_CALLS',
        message: t('modules.api.chat.errors.noFunctionCalls'),
      },
    };
    return;
  }

  const confirmedCalls = functionCalls.filter((call) => {
    const response = toolResponses.find((r) => r.id === call.id);
    return response?.confirmed;
  });
  const rejectedCalls = functionCalls.filter((call) => {
    const response = toolResponses.find((r) => r.id === call.id);
    return !response?.confirmed;
  });

  const messageIndex = history.length - 1;

  let confirmedResult: {
    responseParts: ContentPart[];
    toolResults: Array<{ id: string; name: string; result: Record<string, unknown> }>;
    checkpoints: CheckpointRecord[];
    multimodalAttachments?: ContentPart[];
  } = {
    responseParts: [],
    toolResults: [],
    checkpoints: [],
  };

  if (confirmedCalls.length > 0) {
    yield {
      conversationId,
      content: lastMessage,
      toolsExecuting: true as const,
      pendingToolCalls: confirmedCalls.map((call) => ({
        id: call.id,
        name: call.name,
        args: call.args,
      })),
    } satisfies ChatStreamToolsExecutingData;

    confirmedResult = await ctx.toolExecutionService.executeFunctionCallsWithResults(
      confirmedCalls,
      conversationId,
      messageIndex,
      config,
      request.abortSignal,
    );
  }

  const rejectedParts: ContentPart[] = [];
  const rejectedResults: Array<{ id: string; name: string; result: Record<string, unknown> }> = [];

  for (const call of rejectedCalls) {
    const rejectionResponse = {
      success: false,
      error: t('modules.api.chat.errors.userRejectedTool'),
      rejected: true,
    };

    rejectedResults.push({
      id: call.id,
      name: call.name,
      result: rejectionResponse,
    });

    rejectedParts.push({
      functionResponse: {
        name: call.name,
        response: rejectionResponse,
        id: call.id,
      },
    });
  }

  const allToolResults = [...confirmedResult.toolResults, ...rejectedResults];
  const allResponseParts = [...confirmedResult.responseParts, ...rejectedParts];
  const allCheckpoints = confirmedResult.checkpoints;

  yield {
    conversationId,
    content: lastMessage,
    toolIteration: true as const,
    toolResults: allToolResults,
    checkpoints: allCheckpoints,
  } satisfies ChatStreamToolIterationData;

  const confirmFunctionResponseParts =
    confirmedResult.multimodalAttachments && confirmedResult.multimodalAttachments.length > 0
      ? [...confirmedResult.multimodalAttachments, ...allResponseParts]
      : allResponseParts;

  await ctx.conversationManager.addContent(conversationId, {
    role: 'user',
    parts: confirmFunctionResponseParts,
    isFunctionResponse: true,
  });

  await ctx.tokenEstimationService.preCountUserMessageTokens(conversationId, config.type);

  if (request.annotation && request.annotation.trim()) {
    await ctx.conversationManager.addContent(conversationId, {
      role: 'user',
      parts: [{ text: request.annotation.trim() }],
      contextOverrides: lastUserContextOverrides,
    });
    await ctx.tokenEstimationService.preCountUserMessageTokens(conversationId, config.type);
  }

  const maxToolIterations = getMaxToolIterations(ctx);

  for await (const output of ctx.toolIterationLoopService.runToolLoop({
    conversationId,
    configId,
    config,
    abortSignal: request.abortSignal,
    isFirstMessage: false,
    maxIterations: maxToolIterations,
    createBeforeModelCheckpoint: false,
  })) {
    yield output as ChatStreamOutput;
  }
}

