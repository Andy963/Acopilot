import type { ChannelManager } from '../../../../channel/ChannelManager';
import type { ConversationManager } from '../../../../conversation/ConversationManager';
import type { BaseChannelConfig } from '../../../../config/configs/base';
import type { SettingsManager } from '../../../../settings/SettingsManager';
import type { PromptManager } from '../../../../prompt';

import type { ChatStreamCheckpointsData } from '../../types';

import type { ToolCallParserService } from '../ToolCallParserService';
import type { MessageBuilderService } from '../MessageBuilderService';
import type { TokenEstimationService } from '../TokenEstimationService';
import type { ContextTrimService } from '../ContextTrimService';
import type { ToolExecutionService } from '../ToolExecutionService';
import type { SummarizeService } from '../SummarizeService';
import type { CheckpointService } from '../CheckpointService';

export type MaybeAutoSummarizeOpts = {
    conversationId: string;
    configId: string;
    config: BaseChannelConfig;
    abortSignal?: AbortSignal;
    isLocateMode: boolean;
    estimatedTotalTokens?: number;
    maxContextTokens?: number;
    fullHistoryLength: number;
};

export type ToolIterationLoopDeps = {
    channelManager: ChannelManager;
    conversationManager: ConversationManager;
    toolCallParserService: ToolCallParserService;
    messageBuilderService: MessageBuilderService;
    tokenEstimationService: TokenEstimationService;
    contextTrimService: ContextTrimService;
    toolExecutionService: ToolExecutionService;
    summarizeService: SummarizeService;
    checkpointService: CheckpointService;

    promptManager: PromptManager;
    settingsManager?: SettingsManager;

    delay: (ms: number, signal?: AbortSignal) => Promise<void>;
    maybeAutoSummarizeIfNeeded: (opts: MaybeAutoSummarizeOpts) => Promise<boolean>;
    resetOpenAIResponsesContinuationState: (conversationId: string, configId: string) => Promise<void>;
    updateLocateCarryoverFromOpenFileCalls: (
        conversationId: string,
        enabled: boolean,
        calls: Array<{ name: string; args: Record<string, unknown> }>
    ) => Promise<void>;
    createBeforeModelCheckpoint: (conversationId: string, iteration: number) => Promise<ChatStreamCheckpointsData | null>;
};

