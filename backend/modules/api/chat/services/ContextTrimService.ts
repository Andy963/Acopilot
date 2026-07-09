/**
 * Acopilot - 上下文裁剪服务
 *
 * 负责管理对话历史的上下文裁剪逻辑：
 * - 识别对话回合
 * - 计算上下文阈值
 * - 裁剪超出阈值的历史消息
 * - 查找总结消息
 *
 * 设计原则：
 * - 使用累加的单条消息 token 数，而不是 API 返回的累计值，避免上下文振荡
 * - 保证历史以 user 消息开始（Gemini API 要求）
 * - 总结消息之前的历史会被过滤
 */

import type { Content, ContextInjectionOverrides, SelectionReference } from '../../../conversation/types';
import type { ConversationManager, GetHistoryOptions } from '../../../conversation/ConversationManager';
import type { PromptManager } from '../../../prompt';
import type { BaseChannelConfig } from '../../../config/configs/base';
import type { ConversationRound, ContextTrimInfo } from '../utils';
import type { TokenEstimationService } from './TokenEstimationService';
import { estimateTextTokens } from './TokenEstimationService';
import type { MessageBuilderService } from './MessageBuilderService';
import { applyPinnedPromptPlaceholders, getPinnedPromptBlocks } from './pinnedPrompt';
import { getSelectionReferencesBlock } from './selectionReferences';
import {
    calculateThreshold as calculateContextThreshold,
    findLastSummaryIndex as findLastSummaryIndexInHistory,
    getLastUserOpenFileContext,
    getLastUserSelectionReferences,
    getLastUserTaskContext,
    identifyConversationRounds,
    isConversationRoundStart,
    performContextTrim,
    type RoundTokenInfo
} from './contextTrim/utils';

export class ContextTrimService {
    constructor(
        private conversationManager: ConversationManager,
        private promptManager: PromptManager,
        private tokenEstimationService: TokenEstimationService,
        private messageBuilderService: MessageBuilderService
    ) {}

    /**
     * 识别对话回合
     *
     * 回合定义：
     * - 从一个非函数响应的用户消息开始
     * - 到下一个非函数响应的用户消息之前结束
     * - 每个回合记录该回合内最后一个助手消息的 totalTokenCount
     *
     * @param history 对话历史
     * @returns 回合列表
     */
    identifyRounds(history: Content[]): ConversationRound[] {
        return identifyConversationRounds(history);
    }

    /**
     * 计算上下文阈值
     *
     * 支持两种格式：
     * - 数值：直接使用
     * - 百分比字符串：如 "80%"，计算最大上下文的百分比
     *
     * @param threshold 阈值配置（数值或百分比字符串）
     * @param maxContextTokens 最大上下文 token 数
     * @returns 计算后的阈值
     */
    calculateThreshold(threshold: number | string, maxContextTokens: number): number {
        return calculateContextThreshold(threshold, maxContextTokens);
    }

    /**
     * 查找历史中最后一个总结消息的索引
     *
     * @param history 对话历史
     * @returns 最后一个总结消息的索引，如果没有则返回 -1
     */
    findLastSummaryIndex(history: Content[]): number {
        return findLastSummaryIndexInHistory(history);
    }

    /**
     * 计算上下文裁剪后应该从哪个索引开始获取历史
     *
     * 当最新助手消息的 totalTokenCount 超过阈值时，
     * 计算需要跳过的回合，返回应该开始的消息索引
     *
     * 注意：这个方法不删除任何消息，只是计算过滤的起始位置
     *
     * @param history 对话历史
     * @param config 渠道配置
     * @param latestTokenCount 最新助手消息的 totalTokenCount
     * @returns 应该开始获取历史的索引（0 表示不需要裁剪）
     */
    calculateContextTrimStartIndex(
        history: Content[],
        config: BaseChannelConfig,
        latestTokenCount: number
    ): number {
        // 检查是否启用上下文阈值检测
        if (!config.contextThresholdEnabled) {
            return 0;
        }
        
        // 获取最大上下文和阈值
        const maxContextTokens = (config as any).maxContextTokens ?? 128000;
        const thresholdConfig = config.contextThreshold ?? '80%';
        const threshold = this.calculateThreshold(thresholdConfig, maxContextTokens);
        
        // 如果未超过阈值，无需裁剪
        if (latestTokenCount <= threshold) {
            return 0;
        }
        
        // 识别回合
        const rounds = this.identifyRounds(history);
        
        // 至少需要保留当前回合（最后一个回合）
        if (rounds.length <= 1) {
            return 0;
        }
        
        // 估算每个回合的 token 数（基于最后一个有 token 记录的回合）
        // 简单策略：按回合数等比例估算
        const avgTokensPerRound = latestTokenCount / rounds.length;
        
        // 计算需要保留的回合数
        const targetTokens = threshold;
        const roundsToKeep = Math.max(1, Math.floor(targetTokens / avgTokensPerRound));
        
        // 需要跳过的回合数
        const roundsToSkip = Math.max(0, rounds.length - roundsToKeep);
        
        if (roundsToSkip === 0) {
            return 0;
        }
        
        // 返回应该开始的索引
        const startIndex = rounds[roundsToSkip].startIndex;
        
        return startIndex;
    }

    /**
     * 获取用于 API 调用的历史，应用总结过滤和上下文阈值裁剪
     *
     * 策略：
     * 1. 如果有总结消息，从最后一个总结消息开始获取历史
     * 2. 在此基础上，如果 token 数仍超过阈值，继续从总结后的回合中裁剪
     * 3. 使用每条消息的 tokenCountByChannel 来累加计算，避免上下文振荡
     *
     * @param conversationId 对话 ID
     * @param config 渠道配置
     * @param historyOptions 历史选项
     * @returns 裁剪后的历史和裁剪信息
     */
    async getHistoryWithContextTrimInfo(
        conversationId: string,
        config: BaseChannelConfig,
        historyOptions: GetHistoryOptions,
        contextOverrides?: ContextInjectionOverrides,
        selectionReferences?: SelectionReference[]
    ): Promise<ContextTrimInfo> {
        // 先获取完整的原始历史
        const fullHistory = await this.conversationManager.getHistoryRef(conversationId);
        
        // 如果历史为空，直接返回
        if (fullHistory.length === 0) {
            return { history: [], trimStartIndex: 0 };
        }
        
        // 获取当前渠道类型（gemini, openai, anthropic, custom）
        const channelType = config.type || 'custom';
        const maxContextTokens = (config as any).maxContextTokens ?? 128000;
        
        // 查找最后一个总结消息
        const lastSummaryIndex = this.findLastSummaryIndex(fullHistory);
        
        // 确定有效的起始索引（如果有总结，从总结开始；否则从头开始）
        const effectiveStartIndex = lastSummaryIndex >= 0 ? lastSummaryIndex : 0;
        
        // 计算系统提示词的 token 数
        const baseSystemPrompt = this.promptManager.getSystemPrompt(false, contextOverrides);
        const pinnedPromptEnabled = contextOverrides?.includePinnedPrompt !== false;
        const pinnedPromptBlocks = pinnedPromptEnabled
            ? await getPinnedPromptBlocks(this.conversationManager, conversationId)
            : [];
        const systemPrompt = applyPinnedPromptPlaceholders(baseSystemPrompt, pinnedPromptBlocks);
        let systemPromptTokens = 0;
        if (systemPrompt) {
            systemPromptTokens = await this.tokenEstimationService.countSystemPromptTokens(systemPrompt, channelType);
        }

        // Selection References 不再注入到 system prompt，而是作为本轮 user message 的前缀发送（request-only）。
        // 这里将其 token 计入“当前 user message”，避免裁剪/阈值判断偏差。
        const selectionReferencesBlock = getSelectionReferencesBlock(
            selectionReferences ?? getLastUserSelectionReferences(fullHistory)
        );
        const selectionReferencesTokens = selectionReferencesBlock ? estimateTextTokens(selectionReferencesBlock) : 0;

        const taskContextText = getLastUserTaskContext(fullHistory);
        const taskContextBlock = taskContextText ? `====\n\nTASK CONTEXT\n\n${taskContextText}` : '';
        const taskContextTokens = taskContextBlock ? estimateTextTokens(taskContextBlock) : 0;

        const openFileContextText = getLastUserOpenFileContext(fullHistory);
        const openFileContextBlock = openFileContextText
            ? (openFileContextText.startsWith('====') ? openFileContextText : `====\n\nOPEN FILE CONTEXT\n\n${openFileContextText}`)
            : '';
        const openFileContextTokens = openFileContextBlock ? estimateTextTokens(openFileContextBlock) : 0;
        
        // 计算从 effectiveStartIndex 开始的消息 token 数
        // 这是解决上下文振荡问题的关键：使用累加的单条消息 token 数，而不是 API 返回的累计值
        let estimatedTotalTokens = systemPromptTokens;  // 从系统提示词开始
        let hasEstimatedTokens = systemPromptTokens > 0;
        
        // 用于记录每个回合结束时的累计 token 数（基于自计算的累加值）
        const roundTokenInfos: RoundTokenInfo[] = [];
        let currentRoundStartIndex = -1;
        
        // 从 historyOptions 获取用户配置
        const sendHistoryThoughts = historyOptions.sendHistoryThoughts ?? false;
        const sendHistoryThoughtSignatures = historyOptions.sendHistoryThoughtSignatures ?? false;
        const sendCurrentThoughts = historyOptions.sendCurrentThoughts ?? false;
        const sendCurrentThoughtSignatures = historyOptions.sendCurrentThoughtSignatures ?? false;
        const historyThinkingRounds = historyOptions.historyThinkingRounds ?? -1;
        
        // 找到最后一个非函数响应的 user 消息索引（当前轮次的起点）
        let lastNonFunctionResponseUserIndex = -1;
        for (let i = fullHistory.length - 1; i >= 0; i--) {
            const message = fullHistory[i];
            if (isConversationRoundStart(message)) {
                lastNonFunctionResponseUserIndex = i;
                break;
            }
        }
        
        // 识别所有回合起始位置
        const roundStartIndices: number[] = [];
        for (let i = 0; i < fullHistory.length; i++) {
            const message = fullHistory[i];
            if (isConversationRoundStart(message)) {
                roundStartIndices.push(i);
            }
        }
        
        // 计算历史思考回合的有效范围（与 getHistoryForAPI 保持一致）
        let historyThoughtMinIndex = 0;
        let historyThoughtMaxIndex = lastNonFunctionResponseUserIndex;
        
        if (historyThinkingRounds === 0) {
            historyThoughtMinIndex = fullHistory.length;
            historyThoughtMaxIndex = -1;
        } else if (historyThinkingRounds > 0) {
            const totalRounds = roundStartIndices.length;
            if (totalRounds > 1) {
                const roundsToSkip = Math.max(0, totalRounds - 1 - historyThinkingRounds);
                if (roundsToSkip > 0 && roundsToSkip < totalRounds) {
                    historyThoughtMinIndex = roundStartIndices[roundsToSkip];
                }
            }
        }
        
        // 累加 token 数（继续在下一个方法部分）
        const tokenAccumulationResult = this.accumulateTokens(
            fullHistory,
            effectiveStartIndex,
            lastNonFunctionResponseUserIndex,
            historyThoughtMinIndex,
            historyThoughtMaxIndex,
            sendHistoryThoughts,
            sendHistoryThoughtSignatures,
            sendCurrentThoughts,
            sendCurrentThoughtSignatures,
            systemPromptTokens,
            selectionReferencesTokens,
            taskContextTokens,
            openFileContextTokens
        );
        
        estimatedTotalTokens = tokenAccumulationResult.estimatedTotalTokens;
        hasEstimatedTokens = tokenAccumulationResult.hasEstimatedTokens || hasEstimatedTokens;
        const roundsAfterStart = tokenAccumulationResult.roundTokenInfos;
        
        // 如果没有任何消息，直接返回空历史
        if (!hasEstimatedTokens) {
            const history = await this.conversationManager.getHistoryForAPI(conversationId, historyOptions);
            return { history, trimStartIndex: 0, estimatedTotalTokens, maxContextTokens };
        }
        
        // 检查是否启用上下文阈值检测
        if (!config.contextThresholdEnabled) {
            // 未启用阈值检测，直接返回从起始索引开始的历史
            const history = await this.conversationManager.getHistoryForAPI(conversationId, {
                ...historyOptions,
                startIndex: effectiveStartIndex
            });
            return { history, trimStartIndex: effectiveStartIndex, estimatedTotalTokens, maxContextTokens };
        }
        
        // 获取最大上下文和阈值
        const thresholdConfig = config.contextThreshold ?? '80%';
        const threshold = this.calculateThreshold(thresholdConfig, maxContextTokens);
        
        // 如果估算总 token 未超过阈值，直接返回从起始索引开始的历史
        if (estimatedTotalTokens <= threshold) {
            const history = await this.conversationManager.getHistoryForAPI(conversationId, {
                ...historyOptions,
                startIndex: effectiveStartIndex
            });
            return { history, trimStartIndex: effectiveStartIndex, estimatedTotalTokens, maxContextTokens };
        }
        
        // 超过阈值，需要裁剪
        const trimInfo = await performContextTrim(
            this.conversationManager,
            conversationId,
            config,
            historyOptions,
            effectiveStartIndex,
            estimatedTotalTokens,
            systemPromptTokens,
            roundsAfterStart,
            threshold,
            maxContextTokens
        );

        return {
            ...trimInfo,
            estimatedTotalTokens,
            maxContextTokens
        };
    }

    /**
     * 累加消息的 token 数
     * 
     * @returns 累加结果
     */
    private accumulateTokens(
        fullHistory: Content[],
        effectiveStartIndex: number,
        lastNonFunctionResponseUserIndex: number,
        historyThoughtMinIndex: number,
        historyThoughtMaxIndex: number,
        sendHistoryThoughts: boolean,
        sendHistoryThoughtSignatures: boolean,
        sendCurrentThoughts: boolean,
        sendCurrentThoughtSignatures: boolean,
        systemPromptTokens: number,
        selectionReferencesTokens: number,
        taskContextTokens: number,
        openFileContextTokens: number
    ): { estimatedTotalTokens: number; hasEstimatedTokens: boolean; roundTokenInfos: RoundTokenInfo[] } {
        let estimatedTotalTokens = systemPromptTokens;
        let hasEstimatedTokens = systemPromptTokens > 0;
        const roundTokenInfos: RoundTokenInfo[] = [];
        let currentRoundStartIndex = -1;
        
        // 只累加 effectiveStartIndex 之后的消息
        for (let i = effectiveStartIndex; i < fullHistory.length; i++) {
            const message = fullHistory[i];
            
            if (message.role === 'user') {
                // 检测新回合开始（非函数响应的用户消息）
                if (isConversationRoundStart(message)) {
                    // 保存上一个回合的信息
                    if (currentRoundStartIndex !== -1) {
                        roundTokenInfos.push({
                            startIndex: currentRoundStartIndex,
                            endIndex: i,
                            cumulativeTokens: estimatedTotalTokens
                        });
                    }
                    currentRoundStartIndex = i;
                }
                
                // 用户消息：优先使用 estimatedTokenCount，否则估算
                const tokenCount = message.estimatedTokenCount ?? this.tokenEstimationService.estimateMessageTokens(message);
                const extraSelectionTokens =
                    selectionReferencesTokens > 0 &&
                    i === lastNonFunctionResponseUserIndex &&
                    isConversationRoundStart(message)
                        ? selectionReferencesTokens
                        : 0;
                const extraTaskContextTokens =
                    taskContextTokens > 0 &&
                    i === lastNonFunctionResponseUserIndex &&
                    isConversationRoundStart(message)
                        ? taskContextTokens
                        : 0;
                const extraOpenFileTokens =
                    openFileContextTokens > 0 &&
                    i === lastNonFunctionResponseUserIndex &&
                    isConversationRoundStart(message)
                        ? openFileContextTokens
                        : 0;
                estimatedTotalTokens += tokenCount + extraSelectionTokens + extraTaskContextTokens + extraOpenFileTokens;
                hasEstimatedTokens = true;
            } else if (message.role === 'model') {
                // model 消息：按实际会再次发送给 API 的 parts 估算，避免只用 candidatesTokenCount 漏算正文/工具调用
                const isCurrentRound = i >= lastNonFunctionResponseUserIndex;
                const hasThought = this.messageBuilderService.hasThoughtContent(message.parts);
                const hasSignatures = this.messageBuilderService.hasThoughtSignatures(message.parts);

                let includeThoughtParts = false;
                
                if (isCurrentRound) {
                    // 当前轮：根据当前轮配置和消息内容决定
                    includeThoughtParts = (sendCurrentThoughts && hasThought) ||
                                          (sendCurrentThoughtSignatures && hasSignatures);
                } else {
                    // 历史轮：根据历史轮配置、消息内容和 historyThinkingRounds 决定
                    const isInHistoryThoughtRange = i >= historyThoughtMinIndex && i < historyThoughtMaxIndex;
                    if (isInHistoryThoughtRange) {
                        includeThoughtParts = (sendHistoryThoughts && hasThought) ||
                                              (sendHistoryThoughtSignatures && hasSignatures);
                    }
                }

                const estimatedMessage = includeThoughtParts
                    ? message
                    : {
                        ...message,
                        parts: message.parts.filter(part => !part.thought || part.thoughtSignatures)
                    };
                const estimatedContentTokens = estimatedMessage.parts.length > 0
                    ? this.tokenEstimationService.estimateMessageTokens(estimatedMessage)
                    : 0;
                const modelTokens = Math.max(
                    estimatedContentTokens,
                    message.usageMetadata?.candidatesTokenCount ?? 0
                );
                estimatedTotalTokens += modelTokens;
                hasEstimatedTokens = hasEstimatedTokens || modelTokens > 0;
            }
        }
        
        // 保存最后一个回合
        if (currentRoundStartIndex !== -1) {
            roundTokenInfos.push({
                startIndex: currentRoundStartIndex,
                endIndex: fullHistory.length,
                cumulativeTokens: estimatedTotalTokens
            });
        }
        
        return { estimatedTotalTokens, hasEstimatedTokens, roundTokenInfos };
    }

    /**
     * 获取用于 API 调用的历史（保持向后兼容的简化版本）
     */
    async getHistoryWithContextTrim(
        conversationId: string,
        config: BaseChannelConfig,
        historyOptions: GetHistoryOptions,
        contextOverrides?: ContextInjectionOverrides
    ): Promise<Content[]> {
        const result = await this.getHistoryWithContextTrimInfo(conversationId, config, historyOptions, contextOverrides);
        return result.history;
    }
}
