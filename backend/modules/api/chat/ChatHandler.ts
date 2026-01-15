/**
 * LimCode - 对话处理器
 *
 * 负责处理对话请求，协调各个模块
 */

import { t } from '../../../i18n';
import type { ConfigManager } from '../../config/ConfigManager';
import type { ChannelManager } from '../../channel/ChannelManager';
import type { ConversationManager } from '../../conversation/ConversationManager';
import type { DiffStorageManager } from '../../conversation/DiffStorageManager';
import type { ToolRegistry } from '../../../tools/ToolRegistry';
import type { CheckpointManager, CheckpointRecord } from '../../checkpoint';
import type { SettingsManager } from '../../settings/SettingsManager';
import type { McpManager } from '../../mcp/McpManager';
import { PromptManager } from '../../prompt';
import { StreamAccumulator } from '../../channel/StreamAccumulator';
import { TokenCountService, type TokenCountResult } from '../../channel/TokenCountService';
import type { Content, ContentPart, ChannelTokenCounts, ContextInjectionOverrides } from '../../conversation/types';
import type { GetHistoryOptions } from '../../conversation/ConversationManager';
import type { BaseChannelConfig } from '../../config/configs/base';
import type { StreamChunk, GenerateResponse } from '../../channel/types';
import { ChannelError, ErrorType } from '../../channel/types';
import { getDiffManager } from '../../../tools/file/diffManager';
import { getMultimodalCapability, type MultimodalCapability, type ChannelType as UtilChannelType, type ToolMode as UtilToolMode } from '../../../tools/utils';
import { convertToolsToJSON } from '../../../tools/jsonFormatter';
import { convertToolsToXML } from '../../../tools/xmlFormatter';
import type {
    ChatRequestData,
    ChatSuccessData,
    ChatErrorData,
    ChatStreamChunkData,
    ChatStreamCompleteData,
    ChatStreamErrorData,
    ChatStreamToolIterationData,
    ChatStreamCheckpointsData,
    ChatStreamToolConfirmationData,
    ChatStreamToolsExecutingData,
    ToolConfirmationResponseData,
    PendingToolCall,
    RetryRequestData,
    EditAndRetryRequestData,
    DeleteToMessageRequestData,
    DeleteToMessageSuccessData,
    DeleteToMessageErrorData,
    AttachmentData,
    SummarizeContextRequestData,
    SummarizeContextSuccessData,
    SummarizeContextErrorData,
    ContextInspectorData,
    ContextInspectorModule,
    ContextInspectorTrim,
    ContextInspectorTools
} from './types';
import {
    generateToolCallId,
    type ConversationRound,
    type ContextTrimInfo,
    type FunctionCallInfo
} from './utils';
import { ToolCallParserService, MessageBuilderService, TokenEstimationService, ContextTrimService, ToolExecutionService, SummarizeService, ToolIterationLoopService, CheckpointService, OrphanedToolCallService, DiffInterruptService, ChatFlowService } from './services';
import { StreamResponseProcessor, isAsyncGenerator } from './handlers';
import { getPinnedPromptBlock, getPinnedPromptInjectedInfo } from './services/pinnedPrompt';
import { buildPinnedFilesInjectedInfo, buildPreviewAttachmentsInjectedInfo } from './services/contextInjectionInfo';

/** 默认最大工具调用循环次数（当设置管理器不可用时使用） */
const DEFAULT_MAX_TOOL_ITERATIONS = 20;

/**
 * 对话处理器
 *
 * 职责：
 * 1. 接收对话请求
 * 2. 保存用户消息到历史
 * 3. 调用 AI API
 * 4. 处理工具调用（自动执行并返回结果）
 * 5. 保存 AI 响应到历史
 * 6. 返回响应
 */
export class ChatHandler {
    private checkpointManager?: CheckpointManager;
    private settingsManager?: SettingsManager;
    private mcpManager?: McpManager;
    private diffStorageManager?: DiffStorageManager;
    private promptManager: PromptManager;
    private tokenCountService: TokenCountService;
    private toolCallParserService: ToolCallParserService;
    private messageBuilderService: MessageBuilderService;
    private tokenEstimationService: TokenEstimationService;
    private contextTrimService: ContextTrimService;
    private toolExecutionService: ToolExecutionService;
    private summarizeService: SummarizeService;
    private toolIterationLoopService: ToolIterationLoopService;
    private checkpointService: CheckpointService;
    private orphanedToolCallService: OrphanedToolCallService;
    private diffInterruptService: DiffInterruptService;
    private chatFlowService: ChatFlowService;
    
    constructor(
        private configManager: ConfigManager,
        private channelManager: ChannelManager,
        private conversationManager: ConversationManager,
        private toolRegistry?: ToolRegistry
    ) {
        this.promptManager = new PromptManager();
        this.tokenCountService = new TokenCountService();
        this.toolCallParserService = new ToolCallParserService();
        this.messageBuilderService = new MessageBuilderService();
        this.tokenEstimationService = new TokenEstimationService(
            this.conversationManager,
            this.tokenCountService
        );
        this.contextTrimService = new ContextTrimService(
            this.conversationManager,
            this.promptManager,
            this.tokenEstimationService,
            this.messageBuilderService
        );
        this.checkpointService = new CheckpointService(
            this.conversationManager
        );
        this.toolExecutionService = new ToolExecutionService(
            this.toolRegistry,
            this.mcpManager,
            this.settingsManager,
            this.checkpointService
        );
        this.summarizeService = new SummarizeService(
            this.configManager,
            this.channelManager,
            this.conversationManager,
            this.contextTrimService
        );
        this.toolIterationLoopService = new ToolIterationLoopService(
            this.channelManager,
            this.conversationManager,
            this.toolCallParserService,
            this.messageBuilderService,
            this.tokenEstimationService,
            this.contextTrimService,
            this.toolExecutionService,
            this.checkpointService
        );
        this.orphanedToolCallService = new OrphanedToolCallService(
            this.conversationManager,
            this.toolCallParserService,
            this.toolExecutionService
        );
        this.diffInterruptService = new DiffInterruptService();
        this.chatFlowService = new ChatFlowService(
            this.configManager,
            this.conversationManager,
            this.settingsManager,
            this.messageBuilderService,
            this.tokenEstimationService,
            this.toolIterationLoopService,
            this.checkpointService,
            this.diffInterruptService,
            this.orphanedToolCallService,
            this.toolExecutionService,
            this.toolCallParserService
        );
        // 设置 PromptManager 到 ToolIterationLoopService
        this.toolIterationLoopService.setPromptManager(this.promptManager);
    }
    
    /**
     * 设置检查点管理器（可选）
     */
    setCheckpointManager(checkpointManager: CheckpointManager): void {
        this.checkpointManager = checkpointManager;
        this.checkpointService.setCheckpointManager(checkpointManager);
    }
    
    /**
     * 设置设置管理器（可选）
     */
    setSettingsManager(settingsManager: SettingsManager): void {
        this.settingsManager = settingsManager;
        // 更新 tokenCountService 的代理设置
        this.tokenCountService.setProxyUrl(settingsManager.getEffectiveProxyUrl());
        // 更新 tokenEstimationService 的设置管理器
        this.tokenEstimationService.setSettingsManager(settingsManager);
        // 更新 toolExecutionService 的设置管理器
        this.toolExecutionService.setSettingsManager(settingsManager);
        // 更新 summarizeService 的设置管理器
        this.summarizeService.setSettingsManager(settingsManager);
        // 更新 checkpointService 的设置管理器
        this.checkpointService.setSettingsManager(settingsManager);
        // 更新 chatFlowService 的设置引用
        this.chatFlowService = new ChatFlowService(
            this.configManager,
            this.conversationManager,
            this.settingsManager,
            this.messageBuilderService,
            this.tokenEstimationService,
            this.toolIterationLoopService,
            this.checkpointService,
            this.diffInterruptService,
            this.orphanedToolCallService,
            this.toolExecutionService,
            this.toolCallParserService
        );
    }
    
    /**
     * 设置 MCP 管理器（可选）
     */
    setMcpManager(mcpManager: McpManager): void {
        this.mcpManager = mcpManager;
        this.toolExecutionService.setMcpManager(mcpManager);
    }
    
    /**
     * 设置 Diff 存储管理器（可选）
     * 用于抽离 apply_diff 工具的 originalContent/newContent 大字段
     */
    setDiffStorageManager(diffStorageManager: DiffStorageManager): void {
        this.diffStorageManager = diffStorageManager;
    }
    
    /**
     * 获取单回合最大工具调用次数
     * 从设置管理器读取，如果不可用则返回默认值
     */
    private getMaxToolIterations(): number {
        return this.settingsManager?.getMaxToolIterations() ?? DEFAULT_MAX_TOOL_ITERATIONS;
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

    private static buildModules(systemInstruction: string, maxCharsPerSection: number): ContextInspectorModule[] {
        const sections = ChatHandler.parseSections(systemInstruction);
        return sections.map((s) => {
            const { preview, truncated, charCount } = ChatHandler.truncatePreview(s.content, maxCharsPerSection);
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
    
    /**
     * 处理非流式对话请求
     * 支持工具调用循环：当 AI 返回工具调用时，自动执行工具并将结果返回给 AI
     *
     * @param request 对话请求数据
     * @returns 对话响应数据
     */
    async handleChat(request: ChatRequestData): Promise<ChatSuccessData | ChatErrorData> {
        try {
            return await this.chatFlowService.handleChat(request);
        } catch (error) {
            return {
                success: false,
                error: this.formatError(error)
            };
        }
    }
    
    /**
     * 格式化错误信息
     * 如果有详细错误信息（如 API 返回的响应体），直接追加显示
     */
    private formatError(error: unknown): { code: string; message: string } {
        if (error instanceof ChannelError) {
            let message = error.message;
            
            // 如果有详细错误信息，直接 JSON 序列化追加
            if (error.details) {
                try {
                    const detailsStr = typeof error.details === 'string'
                        ? error.details
                        : JSON.stringify(error.details, null, 2);
                    message = `${error.message}\n${detailsStr}`;
                } catch {
                    // 忽略序列化错误
                }
            }
            
            return {
                code: error.type || 'CHANNEL_ERROR',
                message
            };
        }
        
        const err = error as any;
        return {
            code: err.code || 'UNKNOWN_ERROR',
            message: err.message || t('modules.api.chat.errors.unknownError')
        };
    }
    
    /**
     * 处理流式对话请求（自动根据配置决定使用流式或非流式）
     * 支持工具调用循环：当 AI 返回工具调用时，自动执行工具并将结果返回给 AI
     *
     * @param request 对话请求数据
     * @returns 异步生成器，产生流式响应
     */
    async *handleChatStream(
        request: ChatRequestData
    ): AsyncGenerator<
        ChatStreamChunkData | ChatStreamCompleteData | ChatStreamErrorData | ChatStreamToolIterationData | ChatStreamCheckpointsData | ChatStreamToolConfirmationData | ChatStreamToolsExecutingData
    > {
        try {
            for await (const chunk of this.chatFlowService.handleChatStream(request)) {
                yield chunk;
            }
        } catch (error) {
            // 检查是否是用户取消错误
            if (error instanceof ChannelError && error.type === ErrorType.CANCELLED_ERROR) {
                // 用户取消，yield cancelled 消息
                yield {
                    conversationId: request.conversationId,
                    cancelled: true as const
                } as any;
                return;
            }
            
            yield {
                conversationId: request.conversationId,
                error: this.formatError(error)
            };
        }
    }
    
    /**
     * 处理工具确认响应
     *
     * 当用户在前端确认或拒绝工具执行时调用此方法
     *
     * @param request 工具确认响应数据
     */
    async *handleToolConfirmation(
        request: ToolConfirmationResponseData
    ): AsyncGenerator<
        ChatStreamChunkData | ChatStreamCompleteData | ChatStreamErrorData | ChatStreamToolIterationData | ChatStreamCheckpointsData | ChatStreamToolConfirmationData | ChatStreamToolsExecutingData
    > {
        // 新实现：委托给 ChatFlowService 处理完整流程，保留统一的错误处理逻辑
        try {
            for await (const chunk of this.chatFlowService.handleToolConfirmation(request)) {
                yield chunk as any;
            }
            return;
        } catch (error) {
            // 检查是否是用户取消错误
            if (error instanceof ChannelError && error.type === ErrorType.CANCELLED_ERROR) {
                // 用户取消，yield cancelled 消息
                yield {
                    conversationId: request.conversationId,
                    cancelled: true as const
                } as any;
                return;
            }

            // 检查是否是取消导致的错误（信号已中止）
            if (request.abortSignal?.aborted) {
                yield {
                    conversationId: request.conversationId,
                    cancelled: true as const
                } as any;
                return;
            }

            yield {
                conversationId: request.conversationId,
                error: this.formatError(error)
            };
            return;
        }
    }
    
    /**
     * 处理上下文总结请求
     *
     * 将指定范围的对话历史压缩为一条总结消息
     *
     * @param request 总结请求数据
     * @returns 总结响应数据
     */
    async handleSummarizeContext(
        request: SummarizeContextRequestData
    ): Promise<SummarizeContextSuccessData | SummarizeContextErrorData> {
        return this.summarizeService.handleSummarizeContext(request);
    }

    /**
     * 获取 Context Inspector 预览数据（不发起模型请求）
     */
    async handleGetContextInspectorData(request: { conversationId?: string; configId: string; attachments?: unknown; contextOverrides?: ContextInjectionOverrides }): Promise<ContextInspectorData> {
        const conversationId = request.conversationId?.trim();
        const configId = request.configId;
        const contextOverrides = request.contextOverrides;
        const toolsEnabled = contextOverrides?.includeTools !== false;
        const pinnedPromptEnabled = contextOverrides?.includePinnedPrompt !== false;

        // 1. 验证配置
        const config = await this.configManager.getConfig(configId);
        if (!config) {
            throw new Error(t('modules.api.chat.errors.configNotFound', { configId }));
        }
        if (!config.enabled) {
            throw new Error(t('modules.api.chat.errors.configDisabled', { configId }));
        }

        // 2. 动态系统提示词（包含 pinned prompt）
        const baseSystemPrompt = this.promptManager.getSystemPrompt(true, contextOverrides);
        const pinnedPromptBlock = (conversationId && pinnedPromptEnabled)
            ? await getPinnedPromptBlock(this.conversationManager, conversationId)
            : '';
        const dynamicSystemPrompt = pinnedPromptBlock
            ? [pinnedPromptBlock, baseSystemPrompt].filter(Boolean).join('\n\n')
            : baseSystemPrompt;

        // 3. 合成系统指令（与 formatter 行为一致）
        let systemInstruction = (config.systemInstruction as string | undefined) || '';
        if (dynamicSystemPrompt) {
            systemInstruction = systemInstruction
                ? `${systemInstruction}\n\n${dynamicSystemPrompt}`
                : dynamicSystemPrompt;
        }

        // 4. 工具预览（与实际过滤逻辑一致）
        const toolMode = ((config.toolMode || 'function_call') as ContextInspectorTools['toolMode']);
        const declarations = toolsEnabled
            ? this.channelManager.getToolDeclarationsForPreview(config as any)
            : [];
        const mcpCount = ChatHandler.countMcpTools(declarations);

        let toolsDefinition = '';
        if (toolMode === 'xml') {
            toolsDefinition = convertToolsToXML(declarations);
        } else if (toolMode === 'json') {
            toolsDefinition = convertToolsToJSON(declarations);
        }

        // 5. 占位符替换（与 formatter 行为一致）
        const mcpToolsDefinition = '';
        if (systemInstruction && (systemInstruction.includes('{{$TOOLS}}') || systemInstruction.includes('{{$MCP_TOOLS}}'))) {
            systemInstruction = systemInstruction.replace(/\{\{\$TOOLS\}\}/g, toolsDefinition);
            systemInstruction = systemInstruction.replace(/\{\{\$MCP_TOOLS\}\}/g, mcpToolsDefinition);
        } else if (toolsDefinition) {
            systemInstruction = systemInstruction
                ? `${systemInstruction}\n\n${toolsDefinition}`
                : toolsDefinition;
        }

        // 6. 生成预览（截断避免 UI 卡顿）
        const systemInstructionPreviewLimit = 80000;
        const modulePreviewLimit = 12000;
        const toolDefinitionPreviewLimit = 40000;

        const { preview: systemInstructionPreview, truncated: systemInstructionTruncated, charCount: systemInstructionCharCount } =
            ChatHandler.truncatePreview(systemInstruction, systemInstructionPreviewLimit);

        const modules = ChatHandler.buildModules(systemInstruction, modulePreviewLimit);

        const toolDefPreview = toolsDefinition
            ? ChatHandler.truncatePreview(toolsDefinition, toolDefinitionPreviewLimit)
            : null;

        const tools: ContextInspectorTools = {
            toolMode,
            total: declarations.length,
            mcp: mcpCount,
            definitionPreview: toolDefPreview?.preview,
            definitionCharCount: toolDefPreview?.charCount,
            definitionTruncated: toolDefPreview?.truncated,
        };

        // 7. 裁剪信息（仅当对话存在时）
        let trim: ContextInspectorTrim | undefined;
        if (conversationId) {
            await this.conversationManager.getHistory(conversationId);

            const historyOptions = this.messageBuilderService.buildHistoryOptions(config);
            const trimInfo = await this.contextTrimService.getHistoryWithContextTrimInfo(
                conversationId,
                config,
                historyOptions,
                contextOverrides
            );

            const fullHistory = await this.conversationManager.getHistoryRef(conversationId);
            let lastSummaryIndex = -1;
            for (let i = fullHistory.length - 1; i >= 0; i--) {
                if ((fullHistory[i] as any).isSummary === true) {
                    lastSummaryIndex = i;
                    break;
                }
            }
            const effectiveStartIndex = lastSummaryIndex >= 0 ? lastSummaryIndex : 0;

            trim = {
                fullHistoryCount: fullHistory.length,
                trimmedHistoryCount: trimInfo.history.length,
                trimStartIndex: trimInfo.trimStartIndex,
                lastSummaryIndex,
                effectiveStartIndex,
            };
        }

        const injected = {
            pinnedFiles: contextOverrides?.includePinnedFiles === false
                ? undefined
                : buildPinnedFilesInjectedInfo(this.settingsManager),
            pinnedPrompt: conversationId
                ? (pinnedPromptEnabled ? await getPinnedPromptInjectedInfo(this.conversationManager, conversationId) : { mode: 'none' as const })
                : undefined,
            attachments: buildPreviewAttachmentsInjectedInfo(request.attachments),
        };
        const hasInjected = Boolean(
            injected.pinnedFiles ||
            injected.attachments ||
            (injected.pinnedPrompt && injected.pinnedPrompt.mode !== 'none')
        );

        return {
            generatedAt: Date.now(),
            conversationId: conversationId || undefined,
            configId,
            providerType: config.type,
            model: (config as any).model || '',
            tools,
            systemInstructionPreview,
            systemInstructionCharCount,
            systemInstructionTruncated,
            modules,
            injected: hasInjected ? injected : undefined,
            trim,
        };
    }
    
/**
     * 处理重试请求（非流式）
     * 支持工具调用循环
     *
     * @param request 重试请求数据
     * @returns 对话响应数据
     */
    async handleRetry(request: RetryRequestData): Promise<ChatSuccessData | ChatErrorData> {
        try {
            return await this.chatFlowService.handleRetry(request);
        } catch (error) {
            return {
                success: false,
                error: this.formatError(error)
            };
        }
    }
    
    /**
     * 处理重试请求（自动根据配置决定使用流式或非流式）
     * 支持工具调用循环
     *
     * @param request 重试请求数据
     * @returns 异步生成器，产生流式响应
     */
    async *handleRetryStream(
        request: RetryRequestData
    ): AsyncGenerator<
        ChatStreamChunkData | ChatStreamCompleteData | ChatStreamErrorData | ChatStreamToolIterationData | ChatStreamToolConfirmationData | ChatStreamToolsExecutingData
    > {
        try {
            for await (const chunk of this.chatFlowService.handleRetryStream(request)) {
                // ChatFlowService 返回的是 ChatStreamOutput 联合类型，这里向下兼容原有联合类型
                yield chunk as any;
            }
        } catch (error) {
            // 检查是否是用户取消错误
            if (error instanceof ChannelError && error.type === ErrorType.CANCELLED_ERROR) {
                // 用户取消，yield cancelled 消息
                yield {
                    conversationId: request.conversationId,
                    cancelled: true as const
                } as any;
                return;
            }
            
            yield {
                conversationId: request.conversationId,
                error: this.formatError(error)
            };
        }
    }
    
    /**
     * 处理编辑并重试请求（非流式）
     * 支持工具调用循环
     *
     * @param request 编辑并重试请求数据
     * @returns 对话响应数据
     */
    async handleEditAndRetry(
        request: EditAndRetryRequestData
    ): Promise<ChatSuccessData | ChatErrorData> {
        try {
            return await this.chatFlowService.handleEditAndRetry(request);
        } catch (error) {
            return {
                success: false,
                error: this.formatError(error)
            };
        }
    }
    
    /**
     * 处理编辑并重试请求（自动根据配置决定使用流式或非流式）
     * 支持工具调用循环
     *
     * @param request 编辑并重试请求数据
     * @returns 异步生成器，产生流式响应
     */
    async *handleEditAndRetryStream(
        request: EditAndRetryRequestData
    ): AsyncGenerator<
        ChatStreamChunkData | ChatStreamCompleteData | ChatStreamErrorData | ChatStreamToolIterationData | ChatStreamCheckpointsData | ChatStreamToolConfirmationData | ChatStreamToolsExecutingData
    > {
        try {
            for await (const chunk of this.chatFlowService.handleEditAndRetryStream(request)) {
                yield chunk as any;
            }
        } catch (error) {
            // 检查是否是用户取消错误
            if (error instanceof ChannelError && error.type === ErrorType.CANCELLED_ERROR) {
                // 用户取消，yield cancelled 消息
                yield {
                    conversationId: request.conversationId,
                    cancelled: true as const
                } as any;
                return;
            }
            
            yield {
                conversationId: request.conversationId,
                error: this.formatError(error)
            };
        }
    }
    
    /**
     * 处理删除到指定消息的请求
     *
     * @param request 删除请求数据
     * @returns 删除响应数据
     */
    async handleDeleteToMessage(
        request: DeleteToMessageRequestData
    ): Promise<DeleteToMessageSuccessData | DeleteToMessageErrorData> {
        try {
            return await this.chatFlowService.handleDeleteToMessage(request);
        } catch (error) {
            return {
                success: false,
                error: this.formatError(error)
            };
        }
    }
    
    /**
     * 确保对话存在（不存在则创建）
     *
     * 由于 ConversationManager 现在无内存缓存，每次操作直接读写文件，
     * 只需调用 getHistory 即可触发自动创建逻辑（loadHistory 内部会处理）
     *
     * @param conversationId 对话 ID
     */
    private async ensureConversation(conversationId: string): Promise<void> {
        // getHistory 内部调用 loadHistory，如果对话不存在会自动创建
        await this.conversationManager.getHistory(conversationId);
    }
    
}
