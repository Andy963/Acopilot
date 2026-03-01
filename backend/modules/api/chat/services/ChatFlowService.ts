/**
 * Acopilot - Chat flow orchestration service.
 *
 * This file intentionally stays small and delegates the detailed flows to
 * `./chatFlow/*` to keep single-file size under control.
 */

import type { ConfigManager } from '../../../config/ConfigManager';
import type { ConversationManager } from '../../../conversation/ConversationManager';
import type { SettingsManager } from '../../../settings/SettingsManager';
import type {
  ChatErrorData,
  ChatRequestData,
  ChatSuccessData,
  DeleteToMessageErrorData,
  DeleteToMessageRequestData,
  DeleteToMessageSuccessData,
  EditAndRetryRequestData,
  RetryRequestData,
  ToolConfirmationResponseData,
} from '../types';
import type { MessageBuilderService } from './MessageBuilderService';
import type { TokenEstimationService } from './TokenEstimationService';
import type { ToolIterationLoopService } from './ToolIterationLoopService';
import type { CheckpointService } from './CheckpointService';
import type { DiffInterruptService } from './DiffInterruptService';
import type { OrphanedToolCallService } from './OrphanedToolCallService';
import type { ToolExecutionService } from './ToolExecutionService';
import type { ToolCallParserService } from './ToolCallParserService';
import type { ChatFlowContext } from './chatFlow/context';
import type { ChatStreamOutput } from './chatFlow/types';
import { handleChat } from './chatFlow/handleChat';
import { handleRetry } from './chatFlow/handleRetry';
import { handleEditAndRetry } from './chatFlow/handleEditAndRetry';
import { handleChatStream as handleChatStreamImpl } from './chatFlow/handleChatStream';
import { handleRetryStream as handleRetryStreamImpl } from './chatFlow/handleRetryStream';
import { handleEditAndRetryStream as handleEditAndRetryStreamImpl } from './chatFlow/handleEditAndRetryStream';
import { handleToolConfirmation as handleToolConfirmationImpl } from './chatFlow/handleToolConfirmation';
import { handleDeleteToMessage as handleDeleteToMessageImpl } from './chatFlow/handleDeleteToMessage';

export type { ChatStreamOutput } from './chatFlow/types';

export class ChatFlowService {
  constructor(
    private configManager: ConfigManager,
    private conversationManager: ConversationManager,
    private settingsManager: SettingsManager | undefined,
    private messageBuilderService: MessageBuilderService,
    private tokenEstimationService: TokenEstimationService,
    private toolIterationLoopService: ToolIterationLoopService,
    private checkpointService: CheckpointService,
    private diffInterruptService: DiffInterruptService,
    private orphanedToolCallService: OrphanedToolCallService,
    private toolExecutionService: ToolExecutionService,
    private toolCallParserService: ToolCallParserService,
  ) {}

  private ctx(): ChatFlowContext {
    return {
      configManager: this.configManager,
      conversationManager: this.conversationManager,
      settingsManager: this.settingsManager,
      messageBuilderService: this.messageBuilderService,
      tokenEstimationService: this.tokenEstimationService,
      toolIterationLoopService: this.toolIterationLoopService,
      checkpointService: this.checkpointService,
      diffInterruptService: this.diffInterruptService,
      orphanedToolCallService: this.orphanedToolCallService,
      toolExecutionService: this.toolExecutionService,
      toolCallParserService: this.toolCallParserService,
    };
  }

  async handleChat(request: ChatRequestData): Promise<ChatSuccessData | ChatErrorData> {
    return handleChat(this.ctx(), request);
  }

  async handleRetry(request: RetryRequestData): Promise<ChatSuccessData | ChatErrorData> {
    return handleRetry(this.ctx(), request);
  }

  async handleEditAndRetry(request: EditAndRetryRequestData): Promise<ChatSuccessData | ChatErrorData> {
    return handleEditAndRetry(this.ctx(), request);
  }

  async *handleChatStream(request: ChatRequestData): AsyncGenerator<ChatStreamOutput> {
    yield* handleChatStreamImpl(this.ctx(), request);
  }

  async *handleRetryStream(request: RetryRequestData): AsyncGenerator<ChatStreamOutput> {
    yield* handleRetryStreamImpl(this.ctx(), request);
  }

  async *handleEditAndRetryStream(request: EditAndRetryRequestData): AsyncGenerator<ChatStreamOutput> {
    yield* handleEditAndRetryStreamImpl(this.ctx(), request);
  }

  async *handleToolConfirmation(request: ToolConfirmationResponseData): AsyncGenerator<ChatStreamOutput> {
    yield* handleToolConfirmationImpl(this.ctx(), request);
  }

  async handleDeleteToMessage(
    request: DeleteToMessageRequestData,
  ): Promise<DeleteToMessageSuccessData | DeleteToMessageErrorData> {
    return handleDeleteToMessageImpl(this.ctx(), request);
  }
}
