import type {
  DeleteToMessageErrorData,
  DeleteToMessageRequestData,
  DeleteToMessageSuccessData,
} from '../../types';
import type { ChatFlowContext } from './context';
import {
  ensureConversation,
  OPENAI_RESPONSES_CONTINUATION_KEY,
} from './context';

export async function handleDeleteToMessage(
  ctx: ChatFlowContext,
  request: DeleteToMessageRequestData,
): Promise<DeleteToMessageSuccessData | DeleteToMessageErrorData> {
  const { conversationId, targetIndex } = request;

  await ensureConversation(ctx, conversationId);

  ctx.diffInterruptService.markUserInterrupt();

  try {
    await ctx.checkpointService.deleteCheckpointsFromIndex(conversationId, targetIndex);

    const deletedCount = await ctx.conversationManager.deleteToMessage(conversationId, targetIndex);

    await ctx.conversationManager.setCustomMetadata(
      conversationId,
      OPENAI_RESPONSES_CONTINUATION_KEY,
      null,
    );

    return {
      success: true,
      deletedCount,
    };
  } finally {
    ctx.diffInterruptService.resetUserInterrupt();
  }
}

