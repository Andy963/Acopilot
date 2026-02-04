import type { ConfigManager } from '../../../../config/ConfigManager';
import type { ConversationManager } from '../../../../conversation/ConversationManager';
import type { SettingsManager } from '../../../../settings/SettingsManager';

import type { MessageBuilderService } from '../MessageBuilderService';
import type { TokenEstimationService } from '../TokenEstimationService';
import type { ToolIterationLoopService } from '../ToolIterationLoopService';
import type { CheckpointService } from '../CheckpointService';
import type { DiffInterruptService } from '../DiffInterruptService';
import type { OrphanedToolCallService } from '../OrphanedToolCallService';
import type { ToolExecutionService } from '../ToolExecutionService';
import type { ToolCallParserService } from '../ToolCallParserService';

export const OPENAI_RESPONSES_CONTINUATION_KEY = 'openaiResponsesContinuation';

export type ChatFlowContext = {
  configManager: ConfigManager;
  conversationManager: ConversationManager;
  settingsManager: SettingsManager | undefined;
  messageBuilderService: MessageBuilderService;
  tokenEstimationService: TokenEstimationService;
  toolIterationLoopService: ToolIterationLoopService;
  checkpointService: CheckpointService;
  diffInterruptService: DiffInterruptService;
  orphanedToolCallService: OrphanedToolCallService;
  toolExecutionService: ToolExecutionService;
  toolCallParserService: ToolCallParserService;
};

export async function ensureConversation(ctx: Pick<ChatFlowContext, 'conversationManager'>, conversationId: string): Promise<void> {
  await ctx.conversationManager.getHistory(conversationId);
}

export function getMaxToolIterations(ctx: Pick<ChatFlowContext, 'settingsManager'>): number {
  return ctx.settingsManager?.getMaxToolIterations() ?? 20;
}
