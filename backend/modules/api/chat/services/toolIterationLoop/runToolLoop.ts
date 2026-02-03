import type { CheckpointRecord } from '../../../../checkpoint';
import type { Content, ContextSnapshot, ContextSnapshotTools, ContextSnapshotTrim } from '../../../../conversation/types';
import type { GenerateResponse } from '../../../../channel/types';
import { ChannelError, ErrorType } from '../../../../channel/types';

import { t } from '../../../../../i18n';
import { convertToolsToJSON } from '../../../../../tools/jsonFormatter';
import { convertToolsToXML } from '../../../../../tools/xmlFormatter';

import type { PendingToolCall } from '../../types';
import { StreamResponseProcessor, isAsyncGenerator } from '../../handlers/StreamResponseProcessor';

import type { ToolIterationLoopDeps } from './deps';
import type { ToolIterationLoopConfig, ToolIterationLoopOutput } from './types';
import {
    OPENAI_RESPONSES_CONTINUATION_KEY,
    OPENAI_RESPONSES_FEATURES_KEY,
    OPENAI_RESPONSES_PROMPT_CACHE_STATE_KEY,
    appendOpenAIResponsesStatefulMarker,
    buildSnapshotModules,
    countMcpTools,
    createOpenAIResponsesPromptCacheKey,
    findLastOpenAIResponsesStatefulMarker,
    getApiErrorText,
    getGeminiToolLoopDelayMs,
    getLastUserContextOverrides,
    getLastUserSelectionReferences,
    getLastUserTaskContext,
    getLastUserOpenFileContext,
    getOrInitConversationStartTime,
    injectOpenFileContextIntoHistory,
    injectSelectionReferencesIntoHistory,
    injectTaskContextIntoHistory,
    isOpenAIResponsesContinuationError,
    isOpenAIResponsesPromptCacheKeyError,
    truncatePreview,
    type OpenAIResponsesContinuationState,
    type OpenAIResponsesFeatures,
    type OpenAIResponsesPromptCacheState
} from './helpers';

import { getPinnedPromptBlock, getPinnedPromptInjectedInfo } from '../pinnedPrompt';
import { getSelectionReferencesInjectedInfo } from '../selectionReferences';
import { buildLastMessageAttachmentsInjectedInfo, buildPinnedFilesInjectedInfo } from '../contextInjectionInfo';

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

        let openaiResponsesFeatures: OpenAIResponsesFeatures | null = null;
        if (config.type === 'openai-responses') {
            const rawFeatures = await deps.conversationManager.getCustomMetadata(
                conversationId,
                OPENAI_RESPONSES_FEATURES_KEY
            );
            const f = (rawFeatures && typeof rawFeatures === 'object')
                ? (rawFeatures as any)
                : null;

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
        if (config.type === 'openai-responses' && !openaiResponsesFeatures?.disablePromptCacheKey) {
            const rawPromptCache = await deps.conversationManager.getCustomMetadata(
                conversationId,
                OPENAI_RESPONSES_PROMPT_CACHE_STATE_KEY
            );
            const s = (rawPromptCache && typeof rawPromptCache === 'object')
                ? (rawPromptCache as any)
                : null;

            if (s && typeof s.configId === 'string' && s.configId !== configId) {
                await deps.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_PROMPT_CACHE_STATE_KEY, null);
            } else if (s && s.configId === configId && typeof s.promptCacheKey === 'string' && s.promptCacheKey.trim()) {
                promptCacheKey = s.promptCacheKey;
            }

            if (!promptCacheKey) {
                const marker = findLastOpenAIResponsesStatefulMarker(fullHistory, configId);
                if (marker?.marker.promptCacheKey) {
                    promptCacheKey = marker.marker.promptCacheKey;
                    const nextState: OpenAIResponsesPromptCacheState = {
                        configId,
                        promptCacheKey
                    };
                    await deps.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_PROMPT_CACHE_STATE_KEY, nextState);
                }
            }

            if (!promptCacheKey) {
                promptCacheKey = createOpenAIResponsesPromptCacheKey(conversationId, configId);
                const nextState: OpenAIResponsesPromptCacheState = {
                    configId,
                    promptCacheKey
                };
                await deps.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_PROMPT_CACHE_STATE_KEY, nextState);
            }
        }

        let previousResponseId: string | undefined;
        if (config.type === 'openai-responses' && !openaiResponsesFeatures?.disablePreviousResponseId) {
            const rawState = await deps.conversationManager.getCustomMetadata(
                conversationId,
                OPENAI_RESPONSES_CONTINUATION_KEY
            );
            const state = (rawState && typeof rawState === 'object')
                ? (rawState as any)
                : null;

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
                    if (deltaHistory.length > 0) {
                        previousResponseId = state.previousResponseId;
                        history = deltaHistory;
                    }
                }
            }
        }

        const baseSystemPrompt = (isFirstMessage && iteration === 1)
            ? deps.promptManager.refreshAndGetPrompt(contextOverrides)
            : deps.promptManager.getSystemPrompt(true, contextOverrides);

        const pinnedPromptBlock = pinnedPromptEnabled
            ? await getPinnedPromptBlock(deps.conversationManager, conversationId)
            : '';
        let dynamicSystemPrompt = [pinnedPromptBlock, baseSystemPrompt]
            .filter(Boolean)
            .join('\n\n');

        if (isFirstMessage && iteration === 1) {
            const startTime = await getOrInitConversationStartTime(deps.conversationManager, conversationId);
            dynamicSystemPrompt = [dynamicSystemPrompt, `====\n\nSESSION\n\nConversation Start Time: ${startTime}`]
                .filter(Boolean)
                .join('\n\n');
        }

        const toolMode = ((config.toolMode || 'function_call') as ContextSnapshotTools['toolMode']);
        let declarations = toolsEnabled
            ? deps.channelManager.getToolDeclarationsForPreview(config as any)
            : [];
        if (Array.isArray(toolAllowList) && toolAllowList.length > 0) {
            const allowSet = new Set(toolAllowList);
            declarations = declarations.filter((d) => allowSet.has(d.name));
        }
        const mcpCount = countMcpTools(declarations);

        let toolsDefinition = '';
        if (toolMode === 'xml') {
            toolsDefinition = convertToolsToXML(declarations);
        } else if (toolMode === 'json') {
            toolsDefinition = convertToolsToJSON(declarations);
        }

        let systemInstruction = (config.systemInstruction as string | undefined) || '';
        if (dynamicSystemPrompt) {
            systemInstruction = systemInstruction
                ? `${systemInstruction}\n\n${dynamicSystemPrompt}`
                : dynamicSystemPrompt;
        }

        const mcpToolsDefinition = '';
        if (systemInstruction && (systemInstruction.includes('{{$TOOLS}}') || systemInstruction.includes('{{$MCP_TOOLS}}'))) {
            systemInstruction = systemInstruction.replace(/\{\{\$TOOLS\}\}/g, toolsDefinition);
            systemInstruction = systemInstruction.replace(/\{\{\$MCP_TOOLS\}\}/g, mcpToolsDefinition);
        } else if (toolsDefinition) {
            systemInstruction = systemInstruction
                ? `${systemInstruction}\n\n${toolsDefinition}`
                : toolsDefinition;
        }

        const sysPreview = truncatePreview(systemInstruction, 25000);
        const toolDefPreview = toolsDefinition
            ? truncatePreview(toolsDefinition, 12000)
            : null;

        let lastSummaryIndex = -1;
        for (let i = fullHistory.length - 1; i >= 0; i--) {
            if ((fullHistory[i] as any).isSummary === true) {
                lastSummaryIndex = i;
                break;
            }
        }
        const effectiveStartIndex = lastSummaryIndex >= 0 ? lastSummaryIndex : 0;

        const injected = {
            pinnedFiles: contextOverrides?.includePinnedFiles === false
                ? undefined
                : buildPinnedFilesInjectedInfo(),
            pinnedPrompt: pinnedPromptEnabled
                ? await getPinnedPromptInjectedInfo(deps.conversationManager, conversationId)
                : { mode: 'none' as const },
            attachments: buildLastMessageAttachmentsInjectedInfo(history),
            pinnedSelections: getSelectionReferencesInjectedInfo(selectionReferences),
        };
        const hasInjected = Boolean(
            injected.pinnedFiles ||
            injected.attachments ||
            injected.pinnedSelections ||
            (injected.pinnedPrompt && injected.pinnedPrompt.mode !== 'none')
        );

        const contextSnapshot: ContextSnapshot = {
            generatedAt: Date.now(),
            conversationId,
            configId,
            providerType: config.type,
            model: (config as any).model || '',
            tools: {
                toolMode,
                total: declarations.length,
                mcp: mcpCount,
                definitionPreview: toolDefPreview?.preview,
                definitionCharCount: toolDefPreview?.charCount,
                definitionTruncated: toolDefPreview?.truncated,
            } as ContextSnapshotTools,
            systemInstructionPreview: sysPreview.preview,
            systemInstructionCharCount: sysPreview.charCount,
            systemInstructionTruncated: sysPreview.truncated,
            modules: buildSnapshotModules(systemInstruction, 6000),
            injected: hasInjected ? injected : undefined,
            trim: {
                fullHistoryCount: fullHistory.length,
                trimmedHistoryCount: history.length,
                trimStartIndex,
                lastSummaryIndex,
                effectiveStartIndex,
            } as ContextSnapshotTrim,
        };

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
    	                            if (finalContent.parts.length > 0) {
    	                                const hasNonThoughtText = finalContent.parts.some((p: any) =>
    	                                    typeof p?.text === 'string' &&
    	                                    p.text.trim().length > 0 &&
    	                                    p.thought !== true
    	                                );
    	                                const hasToolCall = finalContent.parts.some((p: any) => !!p?.functionCall);

    	                                if (
    	                                    config.type === 'openai-responses' &&
    	                                    !hasNonThoughtText &&
    	                                    !hasToolCall &&
    	                                    openaiResponsesStreamNoDoneRetryCount < 1 &&
    	                                    !abortSignal?.aborted
    	                                ) {
    	                                    openaiResponsesStreamNoDoneRetryCount++;
    	                                    shouldPersistOpenAIResponsesContinuation = false;
    	                                    openaiResponseId = undefined;
    	                                    await deps.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_CONTINUATION_KEY, null);
    	                                    requestHistory = historyForFullRetry;
    	                                    requestPreviousResponseId = undefined;
    	                                    continue;
    	                                }

    	                                if (
    	                                    config.type !== 'openai-responses' &&
    	                                    !hasNonThoughtText &&
    	                                    !hasToolCall &&
    	                                    streamNoDoneRetryCount < 1 &&
    	                                    !abortSignal?.aborted
    	                                ) {
    	                                    streamNoDoneRetryCount++;
    	                                    openaiResponseId = undefined;
    	                                    continue;
    	                                }

    	                                if (config.type === 'openai-responses') {
    	                                    shouldPersistOpenAIResponsesContinuation = false;
    	                                }
    	                                if (!finalContent.finishReason) {
    	                                    finalContent.finishReason = 'stream_closed';
    	                                }
    	                            } else if (
    	                                config.type === 'openai-responses' &&
    	                                finalContent.parts.length === 0 &&
                            openaiResponsesStreamNoDoneRetryCount < 1 &&
                            !abortSignal?.aborted
                        ) {
                            openaiResponsesStreamNoDoneRetryCount++;
                            shouldPersistOpenAIResponsesContinuation = false;
                            openaiResponseId = undefined;
                            await deps.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_CONTINUATION_KEY, null);
                            requestHistory = historyForFullRetry;
                            requestPreviousResponseId = undefined;
                            continue;
                        } else if (
                            config.type !== 'openai-responses' &&
                            finalContent.parts.length === 0 &&
                            streamNoDoneRetryCount < 1 &&
                            !abortSignal?.aborted
                        ) {
                            streamNoDoneRetryCount++;
                            openaiResponseId = undefined;
                            continue;
                        } else {
                            if (finalContent.parts.length > 0) {
                                await deps.conversationManager.addContent(conversationId, finalContent);
                            }
                            throw new ChannelError(
                                ErrorType.NETWORK_ERROR,
                                t('modules.api.chat.errors.streamEndedUnexpectedly'),
                                {
                                    providerType: config.type,
                                    chunkCount: finalContent.chunkCount,
                                    responseDuration: finalContent.responseDuration,
                                    hasUsageMetadata: !!finalContent.usageMetadata
                                }
                            );
                        }
                    }
                } else {
                    const processor = new StreamResponseProcessor({
                        requestStartTime,
                        providerType: config.type as 'gemini' | 'openai' | 'anthropic' | 'openai-responses' | 'custom',
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
