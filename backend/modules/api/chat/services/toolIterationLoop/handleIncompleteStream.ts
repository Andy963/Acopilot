import type { Content } from '../../../../conversation/types';
import { ChannelError, ErrorType } from '../../../../channel/types';

import { t } from '../../../../../i18n';

import type { ToolIterationLoopDeps } from './deps';
import { OPENAI_RESPONSES_CONTINUATION_KEY } from './helpers';

export interface IncompleteStreamState {
    openaiResponsesStreamNoDoneRetryCount: number;
    streamNoDoneRetryCount: number;
    shouldPersistOpenAIResponsesContinuation: boolean;
    openaiResponseId?: string;
    requestHistory: Content[];
    requestPreviousResponseId?: string;
}

export async function handleIncompleteStream(params: {
    deps: ToolIterationLoopDeps;
    conversationId: string;
    providerType: string;
    abortSignal?: AbortSignal;
    finalContent: any;
    historyForFullRetry: Content[];
    state: IncompleteStreamState;
}): Promise<'retry' | 'continue'> {
    const { deps, conversationId, providerType, abortSignal, finalContent, historyForFullRetry, state } = params;

    const parts = Array.isArray(finalContent?.parts) ? finalContent.parts : [];
    const hasParts = parts.length > 0;

    const hasNonThoughtText = hasParts && parts.some((p: any) =>
        typeof p?.text === 'string' &&
        p.text.trim().length > 0 &&
        p.thought !== true
    );
    const hasToolCall = hasParts && parts.some((p: any) => !!p?.functionCall);

    const canRetry = !abortSignal?.aborted;

    if (providerType === 'openai-responses') {
        const shouldRetry = canRetry &&
            state.openaiResponsesStreamNoDoneRetryCount < 1 &&
            (!hasParts || (!hasNonThoughtText && !hasToolCall));

        if (shouldRetry) {
            state.openaiResponsesStreamNoDoneRetryCount++;
            state.shouldPersistOpenAIResponsesContinuation = false;
            state.openaiResponseId = undefined;
            await deps.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_CONTINUATION_KEY, null);
            state.requestHistory = historyForFullRetry;
            state.requestPreviousResponseId = undefined;
            return 'retry';
        }

        if (!hasParts) {
            throw new ChannelError(
                ErrorType.NETWORK_ERROR,
                t('modules.api.chat.errors.streamEndedUnexpectedly'),
                {
                    providerType,
                    chunkCount: finalContent?.chunkCount,
                    responseDuration: finalContent?.responseDuration,
                    hasUsageMetadata: !!finalContent?.usageMetadata
                }
            );
        }

        state.shouldPersistOpenAIResponsesContinuation = false;
        if (!finalContent.finishReason) {
            finalContent.finishReason = 'stream_closed';
        }

        return 'continue';
    }

    const shouldRetry = canRetry &&
        state.streamNoDoneRetryCount < 1 &&
        (!hasParts || (!hasNonThoughtText && !hasToolCall));

    if (shouldRetry) {
        state.streamNoDoneRetryCount++;
        state.openaiResponseId = undefined;
        return 'retry';
    }

    if (hasParts) {
        await deps.conversationManager.addContent(conversationId, finalContent);
    }

    throw new ChannelError(
        ErrorType.NETWORK_ERROR,
        t('modules.api.chat.errors.streamEndedUnexpectedly'),
        {
            providerType,
            chunkCount: finalContent?.chunkCount,
            responseDuration: finalContent?.responseDuration,
            hasUsageMetadata: !!finalContent?.usageMetadata
        }
    );
}

