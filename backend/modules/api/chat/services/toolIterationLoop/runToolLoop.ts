import type { CheckpointRecord } from '../../../../checkpoint';
import type { Content } from '../../../../conversation/types';
import type { GenerateResponse } from '../../../../channel/types';
import { ChannelError, ErrorType } from '../../../../channel/types';

import { t } from '../../../../../i18n';

import type { PendingToolCall } from '../../types';
import { StreamResponseProcessor, isAsyncGenerator } from '../../handlers/StreamResponseProcessor';

import type { ToolIterationLoopDeps } from './deps';
import type { ToolIterationLoopConfig, ToolIterationLoopOutput } from './types';
import { buildPromptAndSnapshot } from './buildPromptAndSnapshot';
import {
    OPENAI_RESPONSES_CONTINUATION_KEY,
    OPENAI_RESPONSES_FEATURES_KEY,
    OPENAI_RESPONSES_PROMPT_CACHE_STATE_KEY,
    appendOpenAIResponsesStatefulMarker,
    getApiErrorText,
    getGeminiToolLoopDelayMs,
    getLastUserContextOverrides,
    getLastUserSelectionReferences,
    getLastUserTaskContext,
    getLastUserOpenFileContext,
    injectOpenFileContextIntoHistory,
    injectSelectionReferencesIntoHistory,
    injectTaskContextIntoHistory,
    isOpenAIResponsesContinuationError,
    isOpenAIResponsesPromptCacheKeyError,
    type OpenAIResponsesContinuationState,
    type OpenAIResponsesFeatures,
    type OpenAIResponsesPromptCacheState
} from './helpers';
import { loadOpenAIResponsesState } from './openaiResponsesState';
import { handleIncompleteStream, type IncompleteStreamState } from './handleIncompleteStream';

export async function* runToolLoop(
    deps: ToolIterationLoopDeps,
    loopConfig: ToolIterationLoopConfig
): AsyncGenerator<ToolIterationLoopOutput> {
    const {
        conversationId,
        configId,
        config,
        abortSignal,
        isFirstMessage = false,
        maxIterations,
        startIteration = 0,
        createBeforeModelCheckpoint = true
    } = loopConfig;

    let iteration = startIteration;
    let didAutoSummarizeThisTurn = false;

    while (maxIterations === -1 || iteration < maxIterations) {
        iteration++;

        if (abortSignal?.aborted) {
            yield {
                conversationId,
                cancelled: true as const
            } as any;
            return;
        }

        if (config.type === 'gemini') {
            await deps.delay(getGeminiToolLoopDelayMs(iteration), abortSignal);
            if (abortSignal?.aborted) {
                yield {
                    conversationId,
                    cancelled: true as const
                } as any;
                return;
            }
        }

        if (createBeforeModelCheckpoint) {
            const checkpointData = await deps.createBeforeModelCheckpoint(
                conversationId,
                iteration
            );
            if (checkpointData) {
                yield checkpointData;
            }
        }

        const historyOptions = deps.messageBuilderService.buildHistoryOptions(config);
        let fullHistory = await deps.conversationManager.getHistoryRef(conversationId);

        let contextOverrides = getLastUserContextOverrides(fullHistory);
        let selectionReferences = getLastUserSelectionReferences(fullHistory);
        let taskContext = getLastUserTaskContext(fullHistory);
        let openFileContext = getLastUserOpenFileContext(fullHistory);
        let toolsEnabled = contextOverrides?.includeTools !== false;
        let pinnedPromptEnabled = contextOverrides?.includePinnedPrompt !== false;

        let toolAllowList = Array.isArray(contextOverrides?.toolAllowList)
            ? contextOverrides!.toolAllowList!.filter((n) => typeof n === 'string' && n.trim()).map((n) => n.trim())
            : undefined;
        let modelOverride = typeof contextOverrides?.modelOverride === 'string' && contextOverrides.modelOverride.trim()
            ? contextOverrides.modelOverride.trim()
            : undefined;
        let isLocateMode = contextOverrides?.mode === 'locate';

        let { history, trimStartIndex, estimatedTotalTokens, maxContextTokens } = await deps.contextTrimService.getHistoryWithContextTrimInfo(
            conversationId,
            config,
            historyOptions,
            contextOverrides
        );

        if (!didAutoSummarizeThisTurn) {
            const didAutoSummarize = await deps.maybeAutoSummarizeIfNeeded({
                conversationId,
                configId,
                config,
                abortSignal,
                isLocateMode,
                estimatedTotalTokens,
                maxContextTokens,
                fullHistoryLength: fullHistory.length,
            });

            if (didAutoSummarize) {
                didAutoSummarizeThisTurn = true;

                fullHistory = await deps.conversationManager.getHistoryRef(conversationId);
                contextOverrides = getLastUserContextOverrides(fullHistory);
                selectionReferences = getLastUserSelectionReferences(fullHistory);
                taskContext = getLastUserTaskContext(fullHistory);
                openFileContext = getLastUserOpenFileContext(fullHistory);
                toolsEnabled = contextOverrides?.includeTools !== false;
                pinnedPromptEnabled = contextOverrides?.includePinnedPrompt !== false;
                toolAllowList = Array.isArray(contextOverrides?.toolAllowList)
                    ? contextOverrides!.toolAllowList!.filter((n) => typeof n === 'string' && n.trim()).map((n) => n.trim())
                    : undefined;
                modelOverride = typeof contextOverrides?.modelOverride === 'string' && contextOverrides.modelOverride.trim()
                    ? contextOverrides.modelOverride.trim()
                    : undefined;
                isLocateMode = contextOverrides?.mode === 'locate';

                ({ history, trimStartIndex } = await deps.contextTrimService.getHistoryWithContextTrimInfo(
                    conversationId,
                    config,
                    historyOptions,
                    contextOverrides
                ));
            }
        }

        const historyForFullRetry = history;

        const openaiState = await loadOpenAIResponsesState({
            deps,
            conversationId,
            configId,
            configType: config.type,
            fullHistory,
            history,
            trimStartIndex,
        });
        let openaiResponsesFeatures: OpenAIResponsesFeatures | null = openaiState.openaiResponsesFeatures;
        let promptCacheKey: string | undefined = openaiState.promptCacheKey;
        let previousResponseId: string | undefined = openaiState.previousResponseId;
        history = openaiState.history;

        const { dynamicSystemPrompt, toolMode, contextSnapshot } = await buildPromptAndSnapshot({
            deps,
            loopConfig,
            iteration,
            history,
            fullHistory,
            trimStartIndex,
            contextOverrides,
            selectionReferences,
            toolsEnabled,
            pinnedPromptEnabled,
            toolAllowList,
        });

        let finalContent: Content;
        let openaiResponseId: string | undefined;

        let requestHistory = history;
        let requestPreviousResponseId = modelOverride ? undefined : previousResponseId;
        let requestPromptCacheKey = modelOverride ? undefined : promptCacheKey;
        let fallbackCount = 0;
        let openaiResponsesStreamNoDoneRetryCount = 0;
        let streamNoDoneRetryCount = 0;
        let shouldPersistOpenAIResponsesContinuation = !modelOverride;

        while (true) {
            const requestStartTime = Date.now();

            shouldPersistOpenAIResponsesContinuation = !modelOverride;

            let sawAnyChunk = false;
            try {
                const response = await deps.channelManager.generate({
                    configId,
                    history: injectSelectionReferencesIntoHistory(
                        injectOpenFileContextIntoHistory(
                            injectTaskContextIntoHistory(requestHistory, taskContext),
                            openFileContext
                        ),
                        selectionReferences
                    ),
                    abortSignal,
                    dynamicSystemPrompt,
                    previousResponseId: requestPreviousResponseId,
                    promptCacheKey: requestPromptCacheKey,
                    skipTools: !toolsEnabled,
                    modelOverride,
                    toolAllowList
                });

                if (isAsyncGenerator(response)) {
                    const processor = new StreamResponseProcessor({
                        requestStartTime,
                        providerType: config.type as 'gemini' | 'openai' | 'anthropic' | 'openai-responses' | 'custom',
                        toolMode,
                        abortSignal,
                        conversationId
                    });

                    for await (const chunkData of processor.processStream(response)) {
                        sawAnyChunk = true;
                        if (chunkData.chunk.responseId) {
                            openaiResponseId = chunkData.chunk.responseId;
                        }
                        yield chunkData;
                    }

                    if (processor.isCancelled()) {
                        const partialContent = processor.getContent();
                        if (partialContent.parts.length > 0) {
                            await deps.conversationManager.addContent(conversationId, partialContent);
                        }
                        yield processor.getCancelledData() as any;
                        return;
                    }

                    finalContent = processor.getContent();

                    if (!processor.isCompleted()) {
                        const state: IncompleteStreamState = {
                            openaiResponsesStreamNoDoneRetryCount,
                            streamNoDoneRetryCount,
                            shouldPersistOpenAIResponsesContinuation,
                            openaiResponseId,
                            requestHistory,
                            requestPreviousResponseId,
                        };

                        const action = await handleIncompleteStream({
                            deps,
                            conversationId,
                            providerType: config.type,
                            abortSignal,
                            finalContent,
                            historyForFullRetry,
                            state,
                        });

                        openaiResponsesStreamNoDoneRetryCount = state.openaiResponsesStreamNoDoneRetryCount;
                        streamNoDoneRetryCount = state.streamNoDoneRetryCount;
                        shouldPersistOpenAIResponsesContinuation = state.shouldPersistOpenAIResponsesContinuation;
                        openaiResponseId = state.openaiResponseId;
                        requestHistory = state.requestHistory;
                        requestPreviousResponseId = state.requestPreviousResponseId;

                        if (action === 'retry') {
                            continue;
                        }
                    }

                } else {
                    const processor = new StreamResponseProcessor({
                        requestStartTime,
                        providerType: config.type as 'gemini' | 'openai' | 'anthropic' | 'openai-responses' | 'custom',
                        toolMode,
                        abortSignal,
                        conversationId
                    });

                    const generateResponse = response as GenerateResponse;
                    if (config.type === 'openai-responses') {
                        openaiResponseId = (generateResponse.raw as any)?.id;
                    }

                    const { content, chunkData } = processor.processNonStream(generateResponse);
                    finalContent = content;
                    sawAnyChunk = true;
                    yield chunkData;
                }

                break;
            } catch (error) {
                const canFallback = config.type === 'openai-responses' &&
                    !sawAnyChunk &&
                    fallbackCount < 2 &&
                    (
                        (!!requestPreviousResponseId && isOpenAIResponsesContinuationError(error)) ||
                        (!!requestPromptCacheKey && isOpenAIResponsesPromptCacheKeyError(error))
                    );

                if (canFallback) {
                    fallbackCount++;

                    let changed = false;

                    if (requestPreviousResponseId && isOpenAIResponsesContinuationError(error)) {
                        if (!openaiResponsesFeatures || openaiResponsesFeatures.configId !== configId) {
                            openaiResponsesFeatures = { configId };
                        }
                        if (openaiResponsesFeatures.disablePreviousResponseId !== true) {
                            openaiResponsesFeatures.disablePreviousResponseId = true;
                            await deps.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_FEATURES_KEY, openaiResponsesFeatures);
                        }

                        await deps.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_CONTINUATION_KEY, null);
                        requestHistory = historyForFullRetry;
                        requestPreviousResponseId = undefined;
                        changed = true;
                    }

                    if (requestPromptCacheKey && isOpenAIResponsesPromptCacheKeyError(error)) {
                        if (!openaiResponsesFeatures || openaiResponsesFeatures.configId !== configId) {
                            openaiResponsesFeatures = { configId };
                        }
                        if (openaiResponsesFeatures.disablePromptCacheKey !== true) {
                            openaiResponsesFeatures.disablePromptCacheKey = true;
                            await deps.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_FEATURES_KEY, openaiResponsesFeatures);
                        }

                        await deps.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_PROMPT_CACHE_STATE_KEY, null);
                        requestPromptCacheKey = undefined;
                        changed = true;
                    }

                    if (changed) {
                        continue;
                    }
                }

                throw error;
            }
        }

        if (toolsEnabled) {
            deps.toolCallParserService.convertXMLToolCallsToFunctionCalls(finalContent);
            deps.toolCallParserService.ensureFunctionCallIds(finalContent);
        }

        (finalContent as any).contextSnapshot = contextSnapshot;

        if (finalContent.parts.length > 0) {
            if (config.type === 'openai-responses') {
                appendOpenAIResponsesStatefulMarker(finalContent, {
                    configId,
                    previousResponseId: shouldPersistOpenAIResponsesContinuation ? openaiResponseId : undefined,
                    promptCacheKey: requestPromptCacheKey
                });
            }
            await deps.conversationManager.addContent(conversationId, finalContent);
        }

        if (config.type === 'openai-responses') {
            if (openaiResponsesFeatures?.disablePreviousResponseId || !shouldPersistOpenAIResponsesContinuation) {
                await deps.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_CONTINUATION_KEY, null);
            } else if (openaiResponseId) {
                const syncedHistory = await deps.conversationManager.getHistoryRef(conversationId);
                const state: OpenAIResponsesContinuationState = {
                    configId,
                    previousResponseId: openaiResponseId,
                    lastSyncedHistoryLength: syncedHistory.length
                };
                await deps.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_CONTINUATION_KEY, state);
            } else {
                await deps.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_CONTINUATION_KEY, null);
            }
        }

        const functionCalls = toolsEnabled
            ? deps.toolCallParserService.extractFunctionCalls(finalContent)
            : [];

        if (functionCalls.length === 0) {
            const modelMessageCheckpoints: CheckpointRecord[] = [];
            const checkpoint = await deps.checkpointService.createModelMessageCheckpoint(
                conversationId,
                'after'
            );
            if (checkpoint) {
                modelMessageCheckpoints.push(checkpoint);
            }

            yield {
                conversationId,
                content: finalContent,
                checkpoints: modelMessageCheckpoints
            };
            return;
        }

        const toolsNeedingConfirmation = deps.toolExecutionService.getToolsNeedingConfirmation(functionCalls);

        if (toolsNeedingConfirmation.length > 0) {
            const pendingToolCalls: PendingToolCall[] = toolsNeedingConfirmation.map(call => ({
                id: call.id,
                name: call.name,
                args: call.args
            }));

            yield {
                conversationId,
                pendingToolCalls,
                content: finalContent,
                awaitingConfirmation: true as const
            };

            return;
        }

        const currentHistory = await deps.conversationManager.getHistoryRef(conversationId);
        const messageIndex = currentHistory.length - 1;

        yield {
            conversationId,
            content: finalContent,
            toolsExecuting: true as const,
            pendingToolCalls: functionCalls.map(call => ({
                id: call.id,
                name: call.name,
                args: call.args
            }))
        };

        const executionResult = await deps.toolExecutionService.executeFunctionCallsWithResults(
            functionCalls,
            conversationId,
            messageIndex,
            config,
            abortSignal,
            toolAllowList
        );

        await deps.updateLocateCarryoverFromOpenFileCalls(conversationId, isLocateMode, functionCalls as any);

        const functionResponseParts = executionResult.multimodalAttachments
            ? [...executionResult.multimodalAttachments, ...executionResult.responseParts]
            : executionResult.responseParts;

        await deps.conversationManager.addContent(conversationId, {
            role: 'user',
            parts: functionResponseParts,
            isFunctionResponse: true
        });

        await deps.tokenEstimationService.preCountUserMessageTokens(conversationId, config.type);

        const hasCancelled = executionResult.toolResults.some(r => (r.result as any).cancelled);
        if (hasCancelled) {
            yield {
                conversationId,
                content: finalContent,
                toolIteration: true as const,
                toolResults: executionResult.toolResults,
                checkpoints: executionResult.checkpoints
            };
            return;
        }

        yield {
            conversationId,
            content: finalContent,
            toolIteration: true as const,
            toolResults: executionResult.toolResults,
            checkpoints: executionResult.checkpoints
        };

    }

    yield {
        conversationId,
        error: {
            code: 'MAX_TOOL_ITERATIONS',
            message: t('modules.api.chat.errors.maxToolIterations', { maxIterations })
        }
    };
}
