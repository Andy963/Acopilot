import type { Content } from '../../../../conversation/types';

import type { ToolIterationLoopDeps } from './deps';
import {
    OPENAI_RESPONSES_CONTINUATION_KEY,
    OPENAI_RESPONSES_FEATURES_KEY,
    OPENAI_RESPONSES_PROMPT_CACHE_STATE_KEY,
    createOpenAIResponsesPromptCacheKey,
    findLastOpenAIResponsesStatefulMarker,
    type OpenAIResponsesFeatures,
    type OpenAIResponsesPromptCacheState
} from './helpers';

export async function loadOpenAIResponsesState(params: {
    deps: ToolIterationLoopDeps;
    conversationId: string;
    configId: string;
    configType: string;
    fullHistory: Content[];
    history: Content[];
    trimStartIndex: number;
}): Promise<{
    openaiResponsesFeatures: OpenAIResponsesFeatures | null;
    promptCacheKey?: string;
    previousResponseId?: string;
    history: Content[];
}> {
    const { deps, conversationId, configId, configType, fullHistory, trimStartIndex } = params;
    let history = params.history;

    let openaiResponsesFeatures: OpenAIResponsesFeatures | null = null;
    if (configType === 'openai-responses') {
        const rawFeatures = await deps.conversationManager.getCustomMetadata(conversationId, OPENAI_RESPONSES_FEATURES_KEY);
        const f = (rawFeatures && typeof rawFeatures === 'object') ? (rawFeatures as any) : null;

        if (f && typeof f.configId === 'string' && f.configId !== configId) {
            await deps.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_FEATURES_KEY, null);
        } else if (f && typeof f.configId === 'string' && f.configId === configId) {
            openaiResponsesFeatures = {
                configId: f.configId,
                disablePreviousResponseId: f.disablePreviousResponseId === true,
                disablePromptCacheKey: f.disablePromptCacheKey === true
            };
        }
    }

    let promptCacheKey: string | undefined;
    if (configType === 'openai-responses' && !openaiResponsesFeatures?.disablePromptCacheKey) {
        const rawPromptCache = await deps.conversationManager.getCustomMetadata(conversationId, OPENAI_RESPONSES_PROMPT_CACHE_STATE_KEY);
        const s = (rawPromptCache && typeof rawPromptCache === 'object') ? (rawPromptCache as any) : null;

        if (s && typeof s.configId === 'string' && s.configId !== configId) {
            await deps.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_PROMPT_CACHE_STATE_KEY, null);
        } else if (s && s.configId === configId && typeof s.promptCacheKey === 'string' && s.promptCacheKey.trim()) {
            promptCacheKey = s.promptCacheKey;
        }

        if (!promptCacheKey) {
            const marker = findLastOpenAIResponsesStatefulMarker(fullHistory, configId);
            if (marker?.marker.promptCacheKey) {
                promptCacheKey = marker.marker.promptCacheKey;
                const nextState: OpenAIResponsesPromptCacheState = { configId, promptCacheKey };
                await deps.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_PROMPT_CACHE_STATE_KEY, nextState);
            }
        }

        if (!promptCacheKey) {
            promptCacheKey = createOpenAIResponsesPromptCacheKey(conversationId, configId);
            const nextState: OpenAIResponsesPromptCacheState = { configId, promptCacheKey };
            await deps.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_PROMPT_CACHE_STATE_KEY, nextState);
        }
    }

    let previousResponseId: string | undefined;
    if (configType === 'openai-responses' && !openaiResponsesFeatures?.disablePreviousResponseId) {
        const rawState = await deps.conversationManager.getCustomMetadata(conversationId, OPENAI_RESPONSES_CONTINUATION_KEY);
        const state = (rawState && typeof rawState === 'object') ? (rawState as any) : null;

        if (state?.configId && state.configId !== configId) {
            await deps.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_CONTINUATION_KEY, null);
            await deps.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_PROMPT_CACHE_STATE_KEY, null);
        } else if (typeof state?.previousResponseId === 'string' && typeof state?.lastSyncedHistoryLength === 'number') {
            const lastSyncedHistoryLength = state.lastSyncedHistoryLength;
            if (lastSyncedHistoryLength > fullHistory.length) {
                await deps.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_CONTINUATION_KEY, null);
                await deps.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_PROMPT_CACHE_STATE_KEY, null);
            } else if (lastSyncedHistoryLength > 0 && lastSyncedHistoryLength < fullHistory.length) {
                const relativeStart = Math.max(0, lastSyncedHistoryLength - trimStartIndex);
                const deltaHistory = history.slice(relativeStart);
                if (deltaHistory.length > 0 && isDeltaHistoryComplete(deltaHistory)) {
                    previousResponseId = state.previousResponseId;
                    history = deltaHistory;
                }
            }
        }
    }

    return {
        openaiResponsesFeatures,
        promptCacheKey,
        previousResponseId,
        history
    };
}

/**
 * Verify that the delta history is self-contained: every function_call_output
 * must have a matching function_call within the same delta. If not, the delta
 * is incomplete and we should fall back to sending the full history.
 */
function isDeltaHistoryComplete(delta: Content[]): boolean {
    const callIds = new Set<string>();
    for (const content of delta) {
        for (const part of content.parts) {
            if (part.functionCall?.id) {
                callIds.add(part.functionCall.id);
            }
        }
    }
    for (const content of delta) {
        for (const part of content.parts) {
            if (part.functionResponse?.id && !callIds.has(part.functionResponse.id)) {
                return false;
            }
        }
    }
    return true;
}
