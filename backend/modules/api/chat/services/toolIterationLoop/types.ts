import type { BaseChannelConfig } from '../../../../config/configs/base';
import type { Content } from '../../../../conversation/types';

import type {
    ChatStreamChunkData,
    ChatStreamCompleteData,
    ChatStreamErrorData,
    ChatStreamToolIterationData,
    ChatStreamCheckpointsData,
    ChatStreamToolConfirmationData,
    ChatStreamToolsExecutingData
} from '../../types';

export interface ToolIterationLoopConfig {
    conversationId: string;
    configId: string;
    config: BaseChannelConfig;
    abortSignal?: AbortSignal;
    isFirstMessage?: boolean;
    maxIterations: number;
    startIteration?: number;
    createBeforeModelCheckpoint?: boolean;
}

export type ToolIterationLoopOutput =
    | ChatStreamChunkData
    | ChatStreamCompleteData
    | ChatStreamErrorData
    | ChatStreamToolIterationData
    | ChatStreamCheckpointsData
    | ChatStreamToolConfirmationData
    | ChatStreamToolsExecutingData;

export interface NonStreamToolLoopResult {
    content?: Content;
    exceededMaxIterations: boolean;
}

