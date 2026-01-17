/**
 * Acopilot - 工具迭代循环服务
 *
 * 封装工具调用循环的核心逻辑，统一处理：
 * - handleChatStream
 * - handleToolConfirmation
 * - handleRetryStream
 * - handleEditAndRetryStream
 * 中的工具调用循环部分
 */

import type { ChannelManager } from '../../../channel/ChannelManager';
import type { ConversationManager } from '../../../conversation/ConversationManager';
import type { CheckpointRecord } from '../../../checkpoint';
import type { Content, ContextInjectionOverrides, ContextSnapshot, ContextSnapshotModule, ContextSnapshotTools, ContextSnapshotTrim, SelectionReference } from '../../../conversation/types';
import type { BaseChannelConfig } from '../../../config/configs/base';
import type { GenerateResponse } from '../../../channel/types';
import { ChannelError, ErrorType } from '../../../channel/types';
import { PromptManager } from '../../../prompt';
import { t } from '../../../../i18n';
import { convertToolsToJSON } from '../../../../tools/jsonFormatter';
import { convertToolsToXML } from '../../../../tools/xmlFormatter';
import {
    decodeOpenAIResponsesStatefulMarker,
    encodeOpenAIResponsesStatefulMarker,
    OPENAI_RESPONSES_STATEFUL_MARKER_MIME,
    type OpenAIResponsesStatefulMarkerPayload
} from '../../../conversation/internalMarkers';
import { nanoid } from 'nanoid';
import type { CheckpointService } from './CheckpointService';

import type {
    ChatStreamChunkData,
    ChatStreamCompleteData,
    ChatStreamErrorData,
    ChatStreamToolIterationData,
    ChatStreamCheckpointsData,
    ChatStreamToolConfirmationData,
    ChatStreamToolsExecutingData,
    PendingToolCall
} from '../types';

import { StreamResponseProcessor, isAsyncGenerator, type ProcessedChunkData } from '../handlers/StreamResponseProcessor';
import type { ToolCallParserService } from './ToolCallParserService';
import type { MessageBuilderService } from './MessageBuilderService';
import type { TokenEstimationService } from './TokenEstimationService';
import type { ContextTrimService } from './ContextTrimService';
import type { ToolExecutionService, ToolExecutionFullResult } from './ToolExecutionService';
import { getPinnedPromptBlock, getPinnedPromptInjectedInfo } from './pinnedPrompt';
import { getSelectionReferencesBlock, getSelectionReferencesInjectedInfo } from './selectionReferences';
import { buildLastMessageAttachmentsInjectedInfo, buildPinnedFilesInjectedInfo } from './contextInjectionInfo';

const OPENAI_RESPONSES_CONTINUATION_KEY = 'openaiResponsesContinuation';
const OPENAI_RESPONSES_FEATURES_KEY = 'openaiResponsesFeatures';
const OPENAI_RESPONSES_PROMPT_CACHE_STATE_KEY = 'openaiResponsesPromptCacheKey';

// Gemini 很容易在“工具循环”里触发 429：工具执行通常很快，导致下一次模型请求紧随其后发出。
// 这里对工具迭代后的后续轮次做轻量限速，避免短时间内连续请求。
const GEMINI_TOOL_LOOP_MIN_INTERVAL_MS = 200;
const GEMINI_TOOL_LOOP_JITTER_MS = 200;

type OpenAIResponsesContinuationState = {
    configId: string;
    previousResponseId: string;
    lastSyncedHistoryLength: number;
};

type OpenAIResponsesFeatures = {
    configId: string;
    disablePreviousResponseId?: boolean;
    disablePromptCacheKey?: boolean;
};

type OpenAIResponsesPromptCacheState = {
    configId: string;
    promptCacheKey: string;
};

function createOpenAIResponsesPromptCacheKey(conversationId: string, configId: string): string {
    return `acopilot:${configId}:${conversationId}:${nanoid(10)}`;
}

function getApiErrorText(error: ChannelError): string {
    const rawDetails = error.details as any;
    const details = (rawDetails &&
        typeof rawDetails === 'object' &&
        !Array.isArray(rawDetails) &&
        typeof rawDetails.status === 'number' &&
        Object.prototype.hasOwnProperty.call(rawDetails, 'body'))
        ? rawDetails.body
        : rawDetails;

    const msg =
        (details?.error && typeof details.error.message === 'string' ? details.error.message : undefined) ??
        (typeof details?.message === 'string' ? details.message : undefined) ??
        (typeof (details as any)?.detail === 'string' ? (details as any).detail : undefined);

    if (typeof msg === 'string' && msg.trim()) {
        return msg;
    }

    try {
        return JSON.stringify(details ?? {});
    } catch {
        return String(details ?? '');
    }
}

function isOpenAIResponsesContinuationError(error: unknown): boolean {
    if (!(error instanceof ChannelError)) {
        return false;
    }
    if (error.type !== ErrorType.API_ERROR) {
        return false;
    }

    const detailsText = getApiErrorText(error);

    const haystack = detailsText.toLowerCase();
    return haystack.includes('previous_response_id') ||
        haystack.includes('previous response id');
}

function isOpenAIResponsesPromptCacheKeyError(error: unknown): boolean {
    if (!(error instanceof ChannelError)) {
        return false;
    }
    if (error.type !== ErrorType.API_ERROR) {
        return false;
    }

    const detailsText = getApiErrorText(error);
    const haystack = detailsText.toLowerCase();
    return haystack.includes('prompt_cache_key') ||
        haystack.includes('prompt cache key');
}

function getGeminiToolLoopDelayMs(iteration: number): number {
    // 仅对“第 2 轮及以后”的模型调用做延迟：第 1 轮是用户发起，不应额外增加等待。
    if (iteration <= 1) return 0;
    return GEMINI_TOOL_LOOP_MIN_INTERVAL_MS + Math.floor(Math.random() * GEMINI_TOOL_LOOP_JITTER_MS);
}

type OpenAIResponsesStatefulMarkerLocation = {
    marker: OpenAIResponsesStatefulMarkerPayload;
    index: number;
};

function findLastOpenAIResponsesStatefulMarker(fullHistory: Content[], configId: string): OpenAIResponsesStatefulMarkerLocation | null {
    for (let i = fullHistory.length - 1; i >= 0; i--) {
        const msg = fullHistory[i];
        if (!msg || msg.role !== 'model' || !Array.isArray(msg.parts)) continue;

        for (const part of msg.parts) {
            const inlineData = (part as any)?.inlineData;
            if (!inlineData || inlineData.mimeType !== OPENAI_RESPONSES_STATEFUL_MARKER_MIME) {
                continue;
            }

            const parsed = decodeOpenAIResponsesStatefulMarker(inlineData.data);
            if (parsed && parsed.configId === configId) {
                return { marker: parsed, index: i };
            }
        }
    }
    return null;
}

function appendOpenAIResponsesStatefulMarker(
    content: Content,
    payload: Omit<OpenAIResponsesStatefulMarkerPayload, 'v'> & { v?: 1 }
): void {
    if (!content || !Array.isArray(content.parts)) return;

    const previousResponseId = typeof payload.previousResponseId === 'string' && payload.previousResponseId.trim()
        ? payload.previousResponseId.trim()
        : undefined;
    const promptCacheKey = typeof payload.promptCacheKey === 'string' && payload.promptCacheKey.trim()
        ? payload.promptCacheKey.trim()
        : undefined;

    if (!previousResponseId && !promptCacheKey) return;

    const hasMarker = content.parts.some((p) => (p as any)?.inlineData?.mimeType === OPENAI_RESPONSES_STATEFUL_MARKER_MIME);
    if (hasMarker) return;

    const configId = payload.configId;
    if (typeof configId !== 'string' || !configId.trim()) return;

    const encoded = encodeOpenAIResponsesStatefulMarker({
        v: 1,
        configId: configId.trim(),
        previousResponseId,
        promptCacheKey
    });

    content.parts.push({
        inlineData: {
            mimeType: OPENAI_RESPONSES_STATEFUL_MARKER_MIME,
            data: encoded
        }
    });
}

/**
 * 工具迭代循环配置
 */
export interface ToolIterationLoopConfig {
    /** 对话 ID */
    conversationId: string;
    /** 配置 ID */
    configId: string;
    /** 渠道配置 */
    config: BaseChannelConfig;
    /** 取消信号 */
    abortSignal?: AbortSignal;
    /** 是否是首条消息（影响系统提示词刷新策略） */
    isFirstMessage?: boolean;
    /** 最大迭代次数（-1 表示无限制） */
    maxIterations: number;
    /** 起始迭代次数（默认 0） */
    startIteration?: number;
    /** 是否创建模型消息前的检查点 */
    createBeforeModelCheckpoint?: boolean;
}

/**
 * 工具迭代循环输出类型（流式）
 */
export type ToolIterationLoopOutput =
    | ChatStreamChunkData
    | ChatStreamCompleteData
    | ChatStreamErrorData
    | ChatStreamToolIterationData
    | ChatStreamCheckpointsData
    | ChatStreamToolConfirmationData
    | ChatStreamToolsExecutingData;

/**
 * 非流式工具循环结果
 */
export interface NonStreamToolLoopResult {
    /** 最终的 AI 回复内容（如果未超过最大迭代次数） */
    content?: Content;
    /** 是否超过最大工具迭代次数 */
    exceededMaxIterations: boolean;
}

/**
 * 工具迭代循环服务
 *
 * 封装工具调用循环的核心逻辑，减少 ChatHandler 中的重复代码
 */
export class ToolIterationLoopService {
    private promptManager: PromptManager;

    private delay(ms: number, signal?: AbortSignal): Promise<void> {
        if (ms <= 0) return Promise.resolve();

        return new Promise((resolve) => {
            if (signal?.aborted) {
                resolve();
                return;
            }

            let done = false;

            const onAbort = () => finish();

            const finish = () => {
                if (done) return;
                done = true;

                clearTimeout(timeoutId);
                if (signal) {
                    signal.removeEventListener('abort', onAbort);
                }
                resolve();
            };

            const timeoutId = setTimeout(finish, ms);
            if (signal) {
                signal.addEventListener('abort', onAbort);
            }
        });
    }

    private static truncatePreview(text: string, maxChars: number): { preview: string; truncated: boolean; charCount: number } {
        const safeText = text || '';
        const charCount = safeText.length;
        if (charCount <= maxChars) {
            return { preview: safeText, truncated: false, charCount };
        }
        return { preview: safeText.slice(0, maxChars), truncated: true, charCount };
    }

    private static parseSections(text: string): Array<{ title: string; content: string }> {
        const marker = '====\n\n';
        const sections: Array<{ title: string; content: string }> = [];
        let index = 0;

        while (index < text.length) {
            const markerPos = text.indexOf(marker, index);
            if (markerPos === -1) {
                const tail = text.slice(index).trim();
                if (tail) {
                    sections.push({ title: 'TEXT', content: tail });
                }
                break;
            }

            if (markerPos > index) {
                const prefix = text.slice(index, markerPos).trim();
                if (prefix) {
                    sections.push({ title: 'TEXT', content: prefix });
                }
            }

            const titleStart = markerPos + marker.length;
            const titleEnd = text.indexOf('\n\n', titleStart);
            if (titleEnd === -1) {
                const rest = text.slice(markerPos).trim();
                if (rest) {
                    sections.push({ title: 'TEXT', content: rest });
                }
                break;
            }

            const title = text.slice(titleStart, titleEnd).trim() || 'SECTION';
            const contentStart = titleEnd + 2;
            const nextMarkerPos = text.indexOf(marker, contentStart);
            const rawContent = nextMarkerPos === -1
                ? text.slice(contentStart)
                : text.slice(contentStart, nextMarkerPos);

            sections.push({ title, content: rawContent.trim() });
            index = nextMarkerPos === -1 ? text.length : nextMarkerPos;
        }

        return sections;
    }

    private static buildModules(systemInstruction: string, maxCharsPerSection: number): ContextSnapshotModule[] {
        const sections = ToolIterationLoopService.parseSections(systemInstruction);
        return sections.map((s) => {
            const { preview, truncated, charCount } = ToolIterationLoopService.truncatePreview(s.content, maxCharsPerSection);
            return {
                title: s.title,
                contentPreview: preview,
                charCount,
                truncated,
            };
        });
    }

    private static countMcpTools(tools: Array<{ name: string }>): number {
        return tools.filter((t) => typeof t.name === 'string' && t.name.startsWith('mcp__')).length;
    }

    private static getLastUserContextOverrides(history: Content[]): ContextInjectionOverrides | undefined {
        for (let i = history.length - 1; i >= 0; i--) {
            const msg = history[i];
            if (!msg || msg.role !== 'user') continue;
            if ((msg as any).isFunctionResponse === true) continue;
            if ((msg as any).isSummary === true) continue;
            return (msg as any).contextOverrides as ContextInjectionOverrides | undefined;
        }
        return undefined;
    }

    private static getLastUserSelectionReferences(history: Content[]): SelectionReference[] | undefined {
        for (let i = history.length - 1; i >= 0; i--) {
            const msg = history[i];
            if (!msg || msg.role !== 'user') continue;
            if ((msg as any).isFunctionResponse === true) continue;
            if ((msg as any).isSummary === true) continue;
            const refs = (msg as any).selectionReferences;
            return Array.isArray(refs) ? (refs as SelectionReference[]) : undefined;
        }
        return undefined;
    }

    constructor(
        private channelManager: ChannelManager,
        private conversationManager: ConversationManager,
        private toolCallParserService: ToolCallParserService,
        private messageBuilderService: MessageBuilderService,
        private tokenEstimationService: TokenEstimationService,
        private contextTrimService: ContextTrimService,
        private toolExecutionService: ToolExecutionService,
        private checkpointService: CheckpointService
    ) {
        this.promptManager = new PromptManager();
    }

    /**
     * 设置提示词管理器（允许外部注入已初始化的实例）
     */
    setPromptManager(promptManager: PromptManager): void {
        this.promptManager = promptManager;
    }

    /**
     * 运行工具迭代循环（流式）
     *
     * 这是核心方法，封装了工具调用循环的完整逻辑
     *
     * @param loopConfig 循环配置
     * @yields 流式响应数据
     */
    async *runToolLoop(
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

        // -1 表示无限制
        while (maxIterations === -1 || iteration < maxIterations) {
            iteration++;

            // 1. 检查是否已取消
            if (abortSignal?.aborted) {
                yield {
                    conversationId,
                    cancelled: true as const
                } as any;
                return;
            }

            // 1.1 Gemini 工具迭代限速：工具执行后紧接着的下一次模型请求容易触发 429
            if (config.type === 'gemini') {
                await this.delay(getGeminiToolLoopDelayMs(iteration), abortSignal);
                if (abortSignal?.aborted) {
                    yield {
                        conversationId,
                        cancelled: true as const
                    } as any;
                    return;
                }
            }

            // 2. 创建模型消息前的检查点（如果配置了）
            if (createBeforeModelCheckpoint) {
                const checkpointData = await this.createBeforeModelCheckpoint(
                    conversationId,
                    iteration
                );
                if (checkpointData) {
                    yield checkpointData;
                }
            }

            // 3. 获取对话历史（应用上下文裁剪）
            const historyOptions = this.messageBuilderService.buildHistoryOptions(config);
            const fullHistory = await this.conversationManager.getHistoryRef(conversationId);

            const contextOverrides = ToolIterationLoopService.getLastUserContextOverrides(fullHistory);
            const selectionReferences = ToolIterationLoopService.getLastUserSelectionReferences(fullHistory);
            const toolsEnabled = contextOverrides?.includeTools !== false;
            const pinnedPromptEnabled = contextOverrides?.includePinnedPrompt !== false;

            let { history, trimStartIndex } = await this.contextTrimService.getHistoryWithContextTrimInfo(
                conversationId,
                config,
                historyOptions,
                contextOverrides
            );

            const historyForFullRetry = history;

            let openaiResponsesFeatures: OpenAIResponsesFeatures | null = null;
            if (config.type === 'openai-responses') {
                const rawFeatures = await this.conversationManager.getCustomMetadata(
                    conversationId,
                    OPENAI_RESPONSES_FEATURES_KEY
                );
                const f = (rawFeatures && typeof rawFeatures === 'object')
                    ? (rawFeatures as any)
                    : null;

                if (f && typeof f.configId === 'string' && f.configId !== configId) {
                    await this.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_FEATURES_KEY, null);
                } else if (f && typeof f.configId === 'string' && f.configId === configId) {
                    openaiResponsesFeatures = {
                        configId: f.configId,
                        disablePreviousResponseId: f.disablePreviousResponseId === true,
                        disablePromptCacheKey: f.disablePromptCacheKey === true
                    };
                }
            }

            // OpenAI Responses: prompt cache / previous response continuation（省 token）
            let promptCacheKey: string | undefined;
            if (config.type === 'openai-responses' && !openaiResponsesFeatures?.disablePromptCacheKey) {
                const rawPromptCache = await this.conversationManager.getCustomMetadata(
                    conversationId,
                    OPENAI_RESPONSES_PROMPT_CACHE_STATE_KEY
                );
                const s = (rawPromptCache && typeof rawPromptCache === 'object')
                    ? (rawPromptCache as any)
                    : null;

                if (s && typeof s.configId === 'string' && s.configId !== configId) {
                    await this.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_PROMPT_CACHE_STATE_KEY, null);
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
                        await this.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_PROMPT_CACHE_STATE_KEY, nextState);
                    }
                }

                if (!promptCacheKey) {
                    promptCacheKey = createOpenAIResponsesPromptCacheKey(conversationId, configId);
                    const nextState: OpenAIResponsesPromptCacheState = {
                        configId,
                        promptCacheKey
                    };
                    await this.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_PROMPT_CACHE_STATE_KEY, nextState);
                }
            }

            let previousResponseId: string | undefined;
            if (config.type === 'openai-responses' && !openaiResponsesFeatures?.disablePreviousResponseId) {
                const rawState = await this.conversationManager.getCustomMetadata(
                    conversationId,
                    OPENAI_RESPONSES_CONTINUATION_KEY
                );
                const state = (rawState && typeof rawState === 'object')
                    ? (rawState as any)
                    : null;

                // config 变化 / 历史被改写：清理 continuation
                if (state?.configId && state.configId !== configId) {
                    await this.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_CONTINUATION_KEY, null);
                    await this.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_PROMPT_CACHE_STATE_KEY, null);
                } else if (typeof state?.previousResponseId === 'string' && typeof state?.lastSyncedHistoryLength === 'number') {
                    const lastSyncedHistoryLength = state.lastSyncedHistoryLength;
                    if (lastSyncedHistoryLength > fullHistory.length) {
                        await this.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_CONTINUATION_KEY, null);
                        await this.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_PROMPT_CACHE_STATE_KEY, null);
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

            // 4. 获取动态系统提示词
            // 首条消息时使用 refreshAndGetPrompt 强制刷新缓存
            const baseSystemPrompt = (isFirstMessage && iteration === 1)
                ? this.promptManager.refreshAndGetPrompt(contextOverrides)
                : this.promptManager.getSystemPrompt(true, contextOverrides);  // 强制刷新以获取最新的 DIAGNOSTICS

            const pinnedPromptBlock = pinnedPromptEnabled
                ? await getPinnedPromptBlock(this.conversationManager, conversationId)
                : '';
            const selectionReferencesBlock = getSelectionReferencesBlock(selectionReferences);
            const dynamicSystemPrompt = [pinnedPromptBlock, baseSystemPrompt, selectionReferencesBlock]
                .filter(Boolean)
                .join('\n\n');

            // 4.1 构建 Context Snapshot（用于 UI 解释/调试）
            const toolMode = ((config.toolMode || 'function_call') as ContextSnapshotTools['toolMode']);
            const declarations = toolsEnabled
                ? this.channelManager.getToolDeclarationsForPreview(config as any)
                : [];
            const mcpCount = ToolIterationLoopService.countMcpTools(declarations);

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

            const sysPreview = ToolIterationLoopService.truncatePreview(systemInstruction, 25000);
            const toolDefPreview = toolsDefinition
                ? ToolIterationLoopService.truncatePreview(toolsDefinition, 12000)
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
                    ? await getPinnedPromptInjectedInfo(this.conversationManager, conversationId)
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
                modules: ToolIterationLoopService.buildModules(systemInstruction, 6000),
                injected: hasInjected ? injected : undefined,
                trim: {
                    fullHistoryCount: fullHistory.length,
                    trimmedHistoryCount: history.length,
                    trimStartIndex,
                    lastSummaryIndex,
                    effectiveStartIndex,
                } as ContextSnapshotTrim,
            };

            // 5. 调用 AI + 处理响应（OpenAI Responses continuation 失效时自动回退全量）
            let finalContent: Content;
            let openaiResponseId: string | undefined;

            let requestHistory = history;
            let requestPreviousResponseId = previousResponseId;
            let requestPromptCacheKey = promptCacheKey;
            let fallbackCount = 0;
            let openaiResponsesStreamNoDoneRetryCount = 0;
            let shouldPersistOpenAIResponsesContinuation = true;

            while (true) {
                const requestStartTime = Date.now();

                // 每次请求默认允许更新 continuation（仅当明确收到完成标记时才会真正启用）
                shouldPersistOpenAIResponsesContinuation = true;

                const response = await this.channelManager.generate({
                    configId,
                    history: requestHistory,
                    abortSignal,
                    dynamicSystemPrompt,
                    previousResponseId: requestPreviousResponseId,
                    promptCacheKey: requestPromptCacheKey,
                    skipTools: !toolsEnabled
                });

                let sawAnyChunk = false;

                try {
                    if (isAsyncGenerator(response)) {
                        // 流式响应处理
                        const processor = new StreamResponseProcessor({
                            requestStartTime,
                            providerType: config.type as 'gemini' | 'openai' | 'anthropic' | 'openai-responses' | 'custom',
                            abortSignal,
                            conversationId
                        });

                        // 处理流并 yield 每个 chunk
                        for await (const chunkData of processor.processStream(response)) {
                            sawAnyChunk = true;
                            if (chunkData.chunk.responseId) {
                                openaiResponseId = chunkData.chunk.responseId;
                            }
                            yield chunkData;
                        }

                        // 检查是否被取消
                        if (processor.isCancelled()) {
                            const partialContent = processor.getContent();
                            if (partialContent.parts.length > 0) {
                                await this.conversationManager.addContent(conversationId, partialContent);
                            }
                            // CancelledData 不在对外的流式类型联合中，这里使用 any 交由上层处理
                            yield processor.getCancelledData() as any;
                            return;
                        }

                        finalContent = processor.getContent();

                        // 如果流式未收到完成标记但自然结束，认为是异常中断（常见表现：回复一半就断且无报错）
                        if (!processor.isCompleted()) {
                            // 一些 OpenAI-兼容网关（尤其是 /responses）会直接关闭连接而不发送完成事件（response.completed / [DONE]）。
                            // Copilot 的实现对这种情况会直接当作完成处理；这里也采用相同策略，避免频繁误报并导致二次请求失败。
                            const canTreatAsCompleted =
                                config.type === 'openai-responses' &&
                                finalContent.parts.length > 0;

                            if (canTreatAsCompleted) {
                                // 未收到完成标记：不要把这次的 responseId 写回 continuation，否则下一轮 previous_response_id 可能导致 0 token/ECONNRESET 等问题。
                                shouldPersistOpenAIResponsesContinuation = false;
                                if (!finalContent.finishReason) {
                                    finalContent.finishReason = 'stream_closed';
                                }
                            } else if (
                                config.type === 'openai-responses' &&
                                finalContent.parts.length === 0 &&
                                openaiResponsesStreamNoDoneRetryCount < 1 &&
                                !abortSignal?.aborted
                            ) {
                                // 少量网关会在输出开始前就关闭连接（无 done 标记且无任何内容）；对用户来说等同于“偶发空响应”。
                                // 这里做一次轻量重试：清空 previous_response_id 并回退到全量历史，避免卡死在无效 continuation 上。
                                openaiResponsesStreamNoDoneRetryCount++;
                                shouldPersistOpenAIResponsesContinuation = false;
                                openaiResponseId = undefined;
                                await this.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_CONTINUATION_KEY, null);
                                requestHistory = historyForFullRetry;
                                requestPreviousResponseId = undefined;
                                continue;
                            } else {
                                if (finalContent.parts.length > 0) {
                                    await this.conversationManager.addContent(conversationId, finalContent);
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
                        // 非流式响应处理
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

                        // previous_response_id 不兼容：禁用 continuation，避免每次都先报错再回退（非常慢）
                        if (requestPreviousResponseId && isOpenAIResponsesContinuationError(error)) {
                            if (!openaiResponsesFeatures || openaiResponsesFeatures.configId !== configId) {
                                openaiResponsesFeatures = { configId };
                            }
                            if (openaiResponsesFeatures.disablePreviousResponseId !== true) {
                                openaiResponsesFeatures.disablePreviousResponseId = true;
                                await this.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_FEATURES_KEY, openaiResponsesFeatures);
                            }

                            await this.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_CONTINUATION_KEY, null);
                            requestHistory = historyForFullRetry;
                            requestPreviousResponseId = undefined;
                            changed = true;
                        }

	                        // prompt_cache_key 不兼容：禁用 prompt cache key，避免一直 400
	                        if (requestPromptCacheKey && isOpenAIResponsesPromptCacheKeyError(error)) {
	                            if (!openaiResponsesFeatures || openaiResponsesFeatures.configId !== configId) {
	                                openaiResponsesFeatures = { configId };
	                            }
	                            if (openaiResponsesFeatures.disablePromptCacheKey !== true) {
	                                openaiResponsesFeatures.disablePromptCacheKey = true;
	                                await this.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_FEATURES_KEY, openaiResponsesFeatures);
	                            }

	                            await this.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_PROMPT_CACHE_STATE_KEY, null);
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

            // 8. 转换工具调用格式（仅在启用 tools 时）
            if (toolsEnabled) {
                this.toolCallParserService.convertXMLToolCallsToFunctionCalls(finalContent);
                this.toolCallParserService.ensureFunctionCallIds(finalContent);
            }

            // 8.1 绑定 Context Snapshot 到消息上（用于前端展示）
            (finalContent as any).contextSnapshot = contextSnapshot;

            // 9. 保存 AI 响应到历史
            if (finalContent.parts.length > 0) {
                if (config.type === 'openai-responses') {
                    appendOpenAIResponsesStatefulMarker(finalContent, {
                        configId,
                        previousResponseId: shouldPersistOpenAIResponsesContinuation ? openaiResponseId : undefined,
                        promptCacheKey: requestPromptCacheKey
                    });
                }
                await this.conversationManager.addContent(conversationId, finalContent);
            }

            // 9.1 OpenAI Responses: 保存 continuation 状态（下次只发增量消息）
            if (config.type === 'openai-responses') {
                if (openaiResponsesFeatures?.disablePreviousResponseId || !shouldPersistOpenAIResponsesContinuation) {
                    await this.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_CONTINUATION_KEY, null);
                } else if (openaiResponseId) {
                    const syncedHistory = await this.conversationManager.getHistoryRef(conversationId);
                    const state: OpenAIResponsesContinuationState = {
                        configId,
                        previousResponseId: openaiResponseId,
                        lastSyncedHistoryLength: syncedHistory.length
                    };
                    await this.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_CONTINUATION_KEY, state);
                } else {
                    await this.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_CONTINUATION_KEY, null);
                }
            }

            // 10. 检查是否有工具调用（仅在启用 tools 时）
            const functionCalls = toolsEnabled
                ? this.toolCallParserService.extractFunctionCalls(finalContent)
                : [];

            if (functionCalls.length === 0) {
                // 没有工具调用，创建模型消息后的检查点并返回完成数据
                const modelMessageCheckpoints: CheckpointRecord[] = [];
                const checkpoint = await this.checkpointService.createModelMessageCheckpoint(
                    conversationId,
                    'after'
                );
                if (checkpoint) {
                    modelMessageCheckpoints.push(checkpoint);
                }

                // 返回完成数据
                yield {
                    conversationId,
                    content: finalContent,
                    checkpoints: modelMessageCheckpoints
                };
                return;
            }

            // 11. 有工具调用，检查是否需要确认
            const toolsNeedingConfirmation = this.toolExecutionService.getToolsNeedingConfirmation(functionCalls);

            if (toolsNeedingConfirmation.length > 0) {
                // 有工具需要确认，发送确认请求到前端
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

                // 暂停执行，等待前端调用 handleToolConfirmation
                return;
            }

            // 12. 不需要确认，直接执行工具
            const currentHistory = await this.conversationManager.getHistoryRef(conversationId);
            const messageIndex = currentHistory.length - 1;

            // 工具执行前先发送计时信息（让前端立即显示）
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

            // 13. 执行工具调用
            const executionResult = await this.toolExecutionService.executeFunctionCallsWithResults(
                functionCalls,
                conversationId,
                messageIndex,
                config,
                abortSignal
            );

            // 14. 将函数响应添加到历史
            const functionResponseParts = executionResult.multimodalAttachments
                ? [...executionResult.multimodalAttachments, ...executionResult.responseParts]
                : executionResult.responseParts;

            await this.conversationManager.addContent(conversationId, {
                role: 'user',
                parts: functionResponseParts,
                isFunctionResponse: true
            });

            // 15. 计算工具响应消息的 token 数
            await this.tokenEstimationService.preCountUserMessageTokens(conversationId, config.type);

            // 16. 检查是否有工具被取消
            const hasCancelled = executionResult.toolResults.some(r => (r.result as any).cancelled);
            if (hasCancelled) {
                // 有工具被取消，发送最终的 toolIteration 后结束
                yield {
                    conversationId,
                    content: finalContent,
                    toolIteration: true as const,
                    toolResults: executionResult.toolResults,
                    checkpoints: executionResult.checkpoints
                };
                return;
            }

            // 17. 发送 toolIteration 信号
            yield {
                conversationId,
                content: finalContent,
                toolIteration: true as const,
                toolResults: executionResult.toolResults,
                checkpoints: executionResult.checkpoints
            };

            // 继续循环，让 AI 处理函数结果
        }

        // 达到最大迭代次数
        yield {
            conversationId,
            error: {
                code: 'MAX_TOOL_ITERATIONS',
                message: t('modules.api.chat.errors.maxToolIterations', { maxIterations })
            }
        };
    }

    /**
     * 运行非流式工具循环
     *
     * 用于 handleChat / handleRetry / handleEditAndRetry 等非流式场景，
     * 不产生流式 chunk，仅返回最终内容或标记超出最大迭代次数。
     */
    async runNonStreamLoop(
        conversationId: string,
        configId: string,
        config: BaseChannelConfig,
        maxIterations: number
    ): Promise<NonStreamToolLoopResult> {
        let iteration = 0;
        const historyOptions = this.messageBuilderService.buildHistoryOptions(config);

        // -1 表示无限制
        while (maxIterations === -1 || iteration < maxIterations) {
            iteration++;

            // Gemini 工具迭代限速（非流式）
            if (config.type === 'gemini') {
                await this.delay(getGeminiToolLoopDelayMs(iteration));
            }

            // 获取对话历史（应用总结过滤和上下文阈值裁剪）
            const fullHistory = await this.conversationManager.getHistoryRef(conversationId);

            const contextOverrides = ToolIterationLoopService.getLastUserContextOverrides(fullHistory);
            const toolsEnabled = contextOverrides?.includeTools !== false;
            const pinnedPromptEnabled = contextOverrides?.includePinnedPrompt !== false;

            let { history, trimStartIndex } = await this.contextTrimService.getHistoryWithContextTrimInfo(
                conversationId,
                config,
                historyOptions,
                contextOverrides
            );

            const historyForFullRetry = history;

            let openaiResponsesFeatures: OpenAIResponsesFeatures | null = null;
            if (config.type === 'openai-responses') {
                const rawFeatures = await this.conversationManager.getCustomMetadata(
                    conversationId,
                    OPENAI_RESPONSES_FEATURES_KEY
                );
                const f = (rawFeatures && typeof rawFeatures === 'object')
                    ? (rawFeatures as any)
                    : null;

                if (f && typeof f.configId === 'string' && f.configId !== configId) {
                    await this.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_FEATURES_KEY, null);
                } else if (f && typeof f.configId === 'string' && f.configId === configId) {
                    openaiResponsesFeatures = {
                        configId: f.configId,
                        disablePreviousResponseId: f.disablePreviousResponseId === true,
                        disablePromptCacheKey: f.disablePromptCacheKey === true
                    };
                }
            }

            // OpenAI Responses: prompt cache / previous response continuation（省 token）
            let promptCacheKey: string | undefined;
            if (config.type === 'openai-responses' && !openaiResponsesFeatures?.disablePromptCacheKey) {
                const rawPromptCache = await this.conversationManager.getCustomMetadata(
                    conversationId,
                    OPENAI_RESPONSES_PROMPT_CACHE_STATE_KEY
                );
                const s = (rawPromptCache && typeof rawPromptCache === 'object')
                    ? (rawPromptCache as any)
                    : null;

                if (s && typeof s.configId === 'string' && s.configId !== configId) {
                    await this.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_PROMPT_CACHE_STATE_KEY, null);
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
                        await this.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_PROMPT_CACHE_STATE_KEY, nextState);
                    }
                }

                if (!promptCacheKey) {
                    promptCacheKey = createOpenAIResponsesPromptCacheKey(conversationId, configId);
                    const nextState: OpenAIResponsesPromptCacheState = {
                        configId,
                        promptCacheKey
                    };
                    await this.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_PROMPT_CACHE_STATE_KEY, nextState);
                }
            }

            let previousResponseId: string | undefined;
            if (config.type === 'openai-responses' && !openaiResponsesFeatures?.disablePreviousResponseId) {
                const rawState = await this.conversationManager.getCustomMetadata(
                    conversationId,
                    OPENAI_RESPONSES_CONTINUATION_KEY
                );
                const state = (rawState && typeof rawState === 'object')
                    ? (rawState as any)
                    : null;

                // config 变化 / 历史被改写：清理 continuation
                if (state?.configId && state.configId !== configId) {
                    await this.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_CONTINUATION_KEY, null);
                    await this.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_PROMPT_CACHE_STATE_KEY, null);
                } else if (typeof state?.previousResponseId === 'string' && typeof state?.lastSyncedHistoryLength === 'number') {
                    const lastSyncedHistoryLength = state.lastSyncedHistoryLength;
                    if (lastSyncedHistoryLength > fullHistory.length) {
                        await this.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_CONTINUATION_KEY, null);
                        await this.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_PROMPT_CACHE_STATE_KEY, null);
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

            // 动态系统提示词（包含 pinned prompt）
            const shouldRefreshPrompt = iteration === 1 && fullHistory.length === 1 && fullHistory[0]?.role === 'user';
            const baseSystemPrompt = shouldRefreshPrompt
                ? this.promptManager.refreshAndGetPrompt(contextOverrides)
                : this.promptManager.getSystemPrompt(true, contextOverrides);

            const pinnedPromptBlock = pinnedPromptEnabled
                ? await getPinnedPromptBlock(this.conversationManager, conversationId)
                : '';
            const selectionReferences = ToolIterationLoopService.getLastUserSelectionReferences(fullHistory);
            const selectionReferencesBlock = getSelectionReferencesBlock(selectionReferences);
            const dynamicSystemPrompt = [pinnedPromptBlock, baseSystemPrompt, selectionReferencesBlock]
                .filter(Boolean)
                .join('\n\n');

            // Context Snapshot（用于 UI 解释/调试；非流式也可用）
            const toolMode = ((config.toolMode || 'function_call') as ContextSnapshotTools['toolMode']);
            const declarations = toolsEnabled
                ? this.channelManager.getToolDeclarationsForPreview(config as any)
                : [];
            const mcpCount = ToolIterationLoopService.countMcpTools(declarations);

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

            const sysPreview = ToolIterationLoopService.truncatePreview(systemInstruction, 25000);
            const toolDefPreview = toolsDefinition
                ? ToolIterationLoopService.truncatePreview(toolsDefinition, 12000)
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
                    ? await getPinnedPromptInjectedInfo(this.conversationManager, conversationId)
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
                modules: ToolIterationLoopService.buildModules(systemInstruction, 6000),
                injected: hasInjected ? injected : undefined,
                trim: {
                    fullHistoryCount: fullHistory.length,
                    trimmedHistoryCount: history.length,
                    trimStartIndex,
                    lastSummaryIndex,
                    effectiveStartIndex,
                } as ContextSnapshotTrim,
            };

            // 调用 AI（非流式）
            let response: GenerateResponse | AsyncGenerator<any>;
            let requestHistory = history;
            let requestPreviousResponseId = previousResponseId;
            let requestPromptCacheKey = promptCacheKey;
            let fallbackCount = 0;

            while (true) {
                try {
                    response = await this.channelManager.generate({
                        configId,
                        history: requestHistory,
                        dynamicSystemPrompt,
                        previousResponseId: requestPreviousResponseId,
                        promptCacheKey: requestPromptCacheKey,
                        skipTools: !toolsEnabled
                    });
                    break;
                } catch (error) {
                    const canFallback = config.type === 'openai-responses' &&
                        fallbackCount < 2 &&
                        (
                            (!!requestPreviousResponseId && isOpenAIResponsesContinuationError(error)) ||
                            (!!requestPromptCacheKey && isOpenAIResponsesPromptCacheKeyError(error))
                        );

                    if (!canFallback) {
                        throw error;
                    }

                    fallbackCount++;

                    let changed = false;

                    if (requestPreviousResponseId && isOpenAIResponsesContinuationError(error)) {
                        if (!openaiResponsesFeatures || openaiResponsesFeatures.configId !== configId) {
                            openaiResponsesFeatures = { configId };
                        }
                        if (openaiResponsesFeatures.disablePreviousResponseId !== true) {
                            openaiResponsesFeatures.disablePreviousResponseId = true;
                            await this.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_FEATURES_KEY, openaiResponsesFeatures);
                        }

                        await this.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_CONTINUATION_KEY, null);
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
                            await this.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_FEATURES_KEY, openaiResponsesFeatures);
                        }

                        requestPromptCacheKey = undefined;
                        changed = true;
                    }

                    if (changed) {
                        continue;
                    }

                    throw error;
                }
            }

            // 类型守卫：确保是 GenerateResponse
            if (!('content' in response)) {
                throw new Error('Unexpected stream response from generate()');
            }

            const generateResponse = response as GenerateResponse;
            const finalContent = generateResponse.content;
            const openaiResponseId = config.type === 'openai-responses'
                ? (generateResponse.raw as any)?.id
                : undefined;
            // 透传结束原因，便于前端判断是否被截断
            finalContent.finishReason = generateResponse.finishReason;

            if (toolsEnabled) {
                // 转换 XML 工具调用为 functionCall 格式（如果有）
                this.toolCallParserService.convertXMLToolCallsToFunctionCalls(finalContent);
                // 为没有 id 的 functionCall 添加唯一 id（Gemini 格式不返回 id）
                this.toolCallParserService.ensureFunctionCallIds(finalContent);
            }

            // 绑定 Context Snapshot 到消息上（用于前端展示）
            (finalContent as any).contextSnapshot = contextSnapshot;

            // 保存 AI 响应到历史
            if (finalContent.parts.length > 0) {
                if (config.type === 'openai-responses') {
                    appendOpenAIResponsesStatefulMarker(finalContent, {
                        configId,
                        previousResponseId: openaiResponseId,
                        promptCacheKey: requestPromptCacheKey
                    });
                }
                await this.conversationManager.addContent(conversationId, finalContent);
            }

            // OpenAI Responses: 保存 continuation 状态（下次只发增量消息）
            if (config.type === 'openai-responses') {
                if (openaiResponsesFeatures?.disablePreviousResponseId) {
                    await this.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_CONTINUATION_KEY, null);
                } else if (openaiResponseId) {
                    const syncedHistory = await this.conversationManager.getHistoryRef(conversationId);
                    const state: OpenAIResponsesContinuationState = {
                        configId,
                        previousResponseId: openaiResponseId,
                        lastSyncedHistoryLength: syncedHistory.length
                    };
                    await this.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_CONTINUATION_KEY, state);
                } else {
                    await this.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_CONTINUATION_KEY, null);
                }
            }

            // 检查是否有工具调用（仅在启用 tools 时）
            const functionCalls = toolsEnabled
                ? this.toolCallParserService.extractFunctionCalls(finalContent)
                : [];

            if (functionCalls.length === 0) {
                // 没有工具调用，结束循环并返回
                return {
                    content: finalContent,
                    exceededMaxIterations: false
                };
            }

            // 有工具调用，执行工具并添加结果
            // 获取当前消息索引（AI 响应刚刚添加到历史）
            const currentHistory = await this.conversationManager.getHistoryRef(conversationId);
            const messageIndex = currentHistory.length - 1;

            const functionResponses = await this.toolExecutionService.executeFunctionCalls(
                functionCalls,
                conversationId,
                messageIndex
            );

            // 将函数响应添加到历史（作为 user 消息，标记为函数响应）
            await this.conversationManager.addContent(conversationId, {
                role: 'user',
                parts: functionResponses,
                isFunctionResponse: true
            });

            // 计算工具响应消息的 token 数
            await this.tokenEstimationService.preCountUserMessageTokens(conversationId, config.type);

            // 继续循环，让 AI 处理函数结果
        }

        // 达到最大迭代次数
        return {
            exceededMaxIterations: true
        };
    }

    /**
     * 创建模型消息前的检查点
     *
     * @param conversationId 对话 ID
     * @param iteration 当前迭代次数
     * @returns 检查点数据（用于 yield）或 null
     */
    private async createBeforeModelCheckpoint(
        conversationId: string,
        iteration: number
    ): Promise<ChatStreamCheckpointsData | null> {
        const checkpoint = await this.checkpointService.createModelMessageCheckpoint(
            conversationId,
            'before',
            iteration
        );
        if (!checkpoint) {
            return null;
        }

        return {
            conversationId,
            checkpoints: [checkpoint],
            checkpointOnly: true as const
        };
    }
}
