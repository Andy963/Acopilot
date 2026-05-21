/**
 * Acopilot - 流式响应累加器
 *
 * 用于累加流式响应块，生成完整的 Content
 * 参考 Gemini 流式响应格式设计
 */

import type { Content, ContentPart, UsageMetadata, ThoughtSignatures } from '../conversation/types';
import type { ToolMode } from '../config/configs/base';
import type { StreamChunk, StreamUsageMetadata } from './types';
import { buildStreamAccumulatorContent } from './streamAccumulator/buildContent';
import { extractToolCallsFromParts } from './streamAccumulator/extractToolCalls';
import { handleFunctionCallPart } from './streamAccumulator/handleFunctionCallPart';

/**
 * 将 partial usage 合并到既有 usageMetadata。
 *
 * 规则：
 * - 仅覆盖 `next` 中有定义的字段，避免分块上报的 provider（如 Anthropic）
 *   后到的 chunk 把先到的字段清掉；
 * - 关于 `totalTokenCount`：
 *   - 若任何一个 chunk 的 `next.totalTokenCount` 明确给出过值（视为权威值），
 *     则始终采用最后一次权威值，不再被派生覆盖；
 *   - 否则按 prompt + candidates + thoughts 派生（每次合并都重新派生，
 *     这样 Anthropic 先收到 promptTokenCount、后收到 candidatesTokenCount 时
 *     total 也能跟着更新）。
 *   - 注意 `cachedPromptTokenCount` 是 prompt 的子集，不参与求和。
 */
function mergeUsageMetadata(
    prev: UsageMetadata | undefined,
    next: StreamUsageMetadata,
    state: { totalIsAuthoritative: boolean }
): UsageMetadata {
    const merged: UsageMetadata = { ...(prev || {}) };

    if (next.promptTokenCount !== undefined) {
        merged.promptTokenCount = next.promptTokenCount;
    }
    if (next.cachedPromptTokenCount !== undefined) {
        merged.cachedPromptTokenCount = next.cachedPromptTokenCount;
    }
    if (next.candidatesTokenCount !== undefined) {
        merged.candidatesTokenCount = next.candidatesTokenCount;
    }
    if (next.thoughtsTokenCount !== undefined) {
        merged.thoughtsTokenCount = next.thoughtsTokenCount;
    }
    if (next.promptTokensDetails !== undefined) {
        merged.promptTokensDetails = next.promptTokensDetails;
    }
    if (next.candidatesTokensDetails !== undefined) {
        merged.candidatesTokensDetails = next.candidatesTokensDetails;
    }

    if (next.totalTokenCount !== undefined) {
        merged.totalTokenCount = next.totalTokenCount;
        state.totalIsAuthoritative = true;
    } else if (!state.totalIsAuthoritative) {
        const hasAnyComponent =
            merged.promptTokenCount !== undefined ||
            merged.candidatesTokenCount !== undefined ||
            merged.thoughtsTokenCount !== undefined;
        if (hasAnyComponent) {
            merged.totalTokenCount =
                (merged.promptTokenCount || 0) +
                (merged.candidatesTokenCount || 0) +
                (merged.thoughtsTokenCount || 0);
        }
    }

    return merged;
}

/**
 * 流式累加器
 *
 * 负责接收和累加流式响应块，最终生成完整的 Content
 *
 * 设计原则：
 * - 参考 Gemini 流式响应格式
 * - 支持思考内容（thought: true）和普通内容的分离
 * - 自动合并相同类型的连续 parts
 * - 正确处理 token 统计信息
 * - 支持多格式思考签名存储
 */
export class StreamAccumulator {
    /** 当前请求的工具模式 */
    private toolMode: ToolMode;

    /** 累加的 parts */
    private parts: ContentPart[] = [];
    
    /** 是否完成 */
    private isDone: boolean = false;
    
    /** 完整的 Token 使用统计 */
    private usageMetadata?: UsageMetadata;

    /**
     * 是否有任何 chunk 明确给出过 totalTokenCount。
     * 一旦为 true，后续 partial usage 不会再用派生值覆盖它。
     */
    private usageTotalState: { totalIsAuthoritative: boolean } = { totalIsAuthoritative: false };
    
    /** 结束原因 */
    private finishReason?: string;
    
    /** 模型版本 */
    private modelVersion?: string;
    
    /** 多格式思考签名 */
    private thoughtSignatures: ThoughtSignatures = {};
    
    /** API 提供商类型（用于确定签名格式） */
    private providerType: 'gemini' | 'openai' | 'anthropic' | 'openai-responses' | 'custom' = 'gemini';
    
    /** 思考开始时间戳（毫秒） */
    private thinkingStartTime?: number;
    
    /** 思考持续时间（毫秒） */
    private thinkingDuration?: number;
    
    /** 是否已经收到非思考的普通文本 */
    private hasReceivedNormalText: boolean = false;
    
    /** 流式块计数 */
    private chunkCount: number = 0;
    
    /** 第一个流式块时间戳（毫秒） */
    private firstChunkTime?: number;
    
    /** 最后一个流式块时间戳（毫秒） */
    private lastChunkTime?: number;
    
    /** 请求开始时间戳（毫秒） - 由外部设置 */
    private requestStartTime?: number;

    constructor(options?: { toolMode?: ToolMode }) {
        this.toolMode = options?.toolMode || 'function_call';
    }
    
    /**
     * 添加流式响应块
     *
     * 处理流程：
     * 1. 累加增量内容（delta）
     * 2. 更新 usage、finishReason、modelVersion 等元数据
     * 3. 标记完成状态
     *
     * 注意：OpenAI 格式的流式响应中，usage 可能在单独的 chunk 中发送
     * （choices 为空数组但有 usage 数据），所以即使已经 done，
     * 仍然需要接收 usage 更新。
     *
     * @param chunk 流式响应块
     */
    add(chunk: StreamChunk): void {
        const now = Date.now();
        
        // 增加块计数
        this.chunkCount++;
        
        // 记录第一个块的时间
        if (this.chunkCount === 1) {
            this.firstChunkTime = now;
        }
        
        // 更新最后一个块的时间
        this.lastChunkTime = now;
        
        // 累加增量内容（如果有）
        // 即使已经 done，也要处理 delta（虽然通常 done 后 delta 为空）
        if (chunk.delta && chunk.delta.length > 0) {
            for (const part of chunk.delta) {
                this.addPart(part);
            }
        }
        
        // 保存完整的 token 使用统计（包括多模态详情）
        //
        // 不同 provider 上报 usage 的方式不同：
        // - OpenAI / Gemini / OpenAI Responses：在最后一个 chunk 一次性给出完整 usage；
        // - Anthropic：将 usage 拆成 `message_start`（仅 promptTokenCount）和
        //   `message_delta`（仅 candidatesTokenCount）两次发送，
        //   并且不会直接给出 totalTokenCount。
        //
        // 因此这里必须按字段 merge，而不是整体覆盖，
        // 否则后到的 partial usage 会把先到的字段清掉，
        // 最终导致 `totalTokenCount`、`promptTokenCount` 全部丢失，
        // 上层（前端 usedTokens / token ring）只能拿到 0。
        if (chunk.usage) {
            this.usageMetadata = mergeUsageMetadata(this.usageMetadata, chunk.usage, this.usageTotalState);
        }
        
        // 保存结束原因（如果有）
        if (chunk.finishReason) {
            this.finishReason = chunk.finishReason;
        }
        
        // 保存模型版本（如果有）
        if (chunk.modelVersion) {
            this.modelVersion = chunk.modelVersion;
        }
        
        // 更新完成状态
        if (chunk.done) {
            this.isDone = true;
        }
    }
    
    /**
     * 设置 API 提供商类型
     * 用于确定思考签名的存储格式
     */
    setProviderType(type: 'gemini' | 'openai' | 'anthropic' | 'openai-responses' | 'custom'): void {
        this.providerType = type;
    }
    
    /**
     * 获取 API 提供商类型
     */
    getProviderType(): 'gemini' | 'openai' | 'anthropic' | 'openai-responses' | 'custom' {
        return this.providerType;
    }
    
    /**
     * 添加单个 part
     *
     * 简化策略：直接存储 API 返回的原始 part 格式
     * - 文本 part：尝试与相同类型的最后一个 part 合并
     * - 非文本 part（functionCall、thoughtSignature 等）：直接添加，保持原始结构
     */
    private addPart(part: ContentPart): void {
        // 提取 thoughtSignature 用于内部追踪
        if ((part as any).thoughtSignature) {
            this.thoughtSignatures[this.providerType] = (part as any).thoughtSignature;
        }
        if (part.thoughtSignatures) {
            Object.assign(this.thoughtSignatures, part.thoughtSignatures);
        }
        
        // 处理非文本 part
        if (!('text' in part)) {
            if (part.functionCall) {
                handleFunctionCallPart({
                    parts: this.parts,
                    providerType: this.providerType,
                    part
                });
                return;
            }
            
            // 其他非文本 Part（如图片、文件等）
            // 排除 API 原始格式的 thoughtSignature（单数），转换为 thoughtSignatures 格式
            const { thoughtSignature: rawSig, ...restNonTextPart } = part as any;
            const nonTextPart: ContentPart = { ...restNonTextPart };
            if (rawSig) {
                nonTextPart.thoughtSignatures = {
                    ...(nonTextPart.thoughtSignatures || {}),
                    [this.providerType]: rawSig
                };
            }
            this.parts.push(nonTextPart);
            return;
        }
        
        // 文本 part：尝试合并
        const isThought = part.thought === true;
        
        // 思考计时逻辑
        if (isThought) {
            // 记录思考开始时间（仅首次）
            if (this.thinkingStartTime === undefined) {
                this.thinkingStartTime = Date.now();
            }
        } else if (part.text) {
            // 收到普通文本时，计算思考持续时间
            if (this.thinkingStartTime !== undefined && !this.hasReceivedNormalText) {
                this.hasReceivedNormalText = true;
                this.thinkingDuration = Date.now() - this.thinkingStartTime;
            }
        }
        
        const lastPart = this.parts[this.parts.length - 1];
        
        // 检查是否可以与最后一个 part 合并（都是文本且思考类型相同）
        if (lastPart && 'text' in lastPart && !lastPart.functionCall) {
            const lastIsThought = lastPart.thought === true;
            
            if (lastIsThought === isThought) {
                lastPart.text += part.text;
                this.parts = extractToolCallsFromParts({
                    toolMode: this.toolMode,
                    parts: this.parts
                });
                return;
            }
        }
        
        // 无法合并，添加新 part
        // 排除 API 原始格式的 thoughtSignature（单数），转换为 thoughtSignatures 格式
        const { thoughtSignature: rawTextSig, ...restTextPart } = part as any;
        const textPart: ContentPart = { ...restTextPart };
        if (rawTextSig) {
            textPart.thoughtSignatures = {
                ...(textPart.thoughtSignatures || {}),
                [this.providerType]: rawTextSig
            };
        }
        this.parts.push(textPart);
        this.parts = extractToolCallsFromParts({
            toolMode: this.toolMode,
            parts: this.parts
        });
    }
    
    /**
     * 获取当前累加的完整 Content
     *
     * @returns 完整的 Content 对象
     */
    getContent(): Content {
        return buildStreamAccumulatorContent({
            parts: this.parts,
            thoughtSignatures: this.thoughtSignatures,
            modelVersion: this.modelVersion,
            finishReason: this.finishReason,
            usageMetadata: this.usageMetadata,
            thinkingStartTime: this.thinkingStartTime,
            thinkingDuration: this.thinkingDuration,
            hasReceivedNormalText: this.hasReceivedNormalText,
            chunkCount: this.chunkCount,
            firstChunkTime: this.firstChunkTime,
            lastChunkTime: this.lastChunkTime,
            requestStartTime: this.requestStartTime
        });
    }
    
    /**
     * 获取当前文本内容（用于实时显示）
     * 
     * @param options 选项
     * @returns 当前累加的文本
     */
    getText(options?: {
        /** 是否包含思考内容 */
        includeThoughts?: boolean;
    }): string {
        const includeThoughts = options?.includeThoughts ?? false;
        
        return this.parts
            .filter(part => {
                if (!('text' in part)) {
                    return false;
                }
                // 如果不包含思考内容，过滤掉思考 part
                if (!includeThoughts && part.thought === true) {
                    return false;
                }
                return true;
            })
            .map(part => ('text' in part ? part.text : ''))
            .join('');
    }
    
    /**
     * 获取思考内容（单独获取）
     * 
     * @returns 思考内容文本
     */
    getThoughts(): string {
        return this.parts
            .filter(part => 'text' in part && part.thought === true)
            .map(part => ('text' in part ? part.text : ''))
            .join('');
    }
    
    /**
     * 获取普通内容（不含思考）
     * 
     * @returns 普通内容文本
     */
    getNormalText(): string {
        return this.parts
            .filter(part => 'text' in part && part.thought !== true)
            .map(part => ('text' in part ? part.text : ''))
            .join('');
    }
    
    /**
     * 检查是否完成
     */
    isComplete(): boolean {
        return this.isDone;
    }
    
    /**
     * 获取结束原因
     */
    getFinishReason(): string | undefined {
        return this.finishReason;
    }
    
    /**
     * 获取模型版本
     */
    getModelVersion(): string | undefined {
        return this.modelVersion;
    }
    
    /**
     * 设置模型版本
     */
    setModelVersion(modelVersion: string): void {
        this.modelVersion = modelVersion;
    }

    /**
     * 设置当前请求的工具模式
     */
    setToolMode(toolMode: ToolMode): void {
        this.toolMode = toolMode;
    }
    
    /**
     * 重置累加器
     */
    reset(): void {
        this.parts = [];
        this.isDone = false;
        this.usageMetadata = undefined;
        this.usageTotalState = { totalIsAuthoritative: false };
        this.finishReason = undefined;
        this.modelVersion = undefined;
        this.thoughtSignatures = {};
        this.thinkingStartTime = undefined;
        this.thinkingDuration = undefined;
        this.hasReceivedNormalText = false;
        this.chunkCount = 0;
        this.firstChunkTime = undefined;
        this.lastChunkTime = undefined;
        this.requestStartTime = undefined;
    }
    
    /**
     * 设置请求开始时间
     * 用于计算 responseDuration
     */
    setRequestStartTime(time: number): void {
        this.requestStartTime = time;
    }
    
    /**
     * 获取流式块计数
     */
    getChunkCount(): number {
        return this.chunkCount;
    }
    
    /**
     * 获取第一个流式块时间
     */
    getFirstChunkTime(): number | undefined {
        return this.firstChunkTime;
    }
    
    /**
     * 获取最后一个流式块时间
     */
    getLastChunkTime(): number | undefined {
        return this.lastChunkTime;
    }
    
    /**
     * 获取思考签名（多格式）
     */
    getThoughtSignatures(): ThoughtSignatures {
        return { ...this.thoughtSignatures };
    }
    
    /**
     * 获取指定格式的思考签名
     */
    getThoughtSignature(format: string = 'gemini'): string | undefined {
        return this.thoughtSignatures[format];
    }
    
    /**
     * 获取 token 使用统计
     */
    getUsageMetadata(): UsageMetadata | undefined {
        return this.usageMetadata ? { ...this.usageMetadata } : undefined;
    }
    
    /**
     * 获取加密思考内容
     *
     * @returns 加密思考内容数组（可能有多个块）
     */
    getRedactedThinking(): string[] {
        return this.parts
            .filter(part => part.redactedThinking)
            .map(part => part.redactedThinking!);
    }
    
    /**
     * 获取思考持续时间
     */
    getThinkingDuration(): number | undefined {
        if (this.thinkingDuration !== undefined) {
            return this.thinkingDuration;
        }
        if (this.thinkingStartTime !== undefined && !this.hasReceivedNormalText) {
            return Date.now() - this.thinkingStartTime;
        }
        return undefined;
    }
    
    /**
     * 获取统计信息
     */
    getStats(): {
        partCount: number;
        textLength: number;
        thoughtsLength: number;
        normalTextLength: number;
        hasThoughts: boolean;
        hasRedactedThinking: boolean;
        hasThoughtSignatures: boolean;
        thoughtSignatureFormats: string[];
        usageMetadata?: UsageMetadata;
        thinkingDuration?: number;
        chunkCount: number;
        firstChunkTime?: number;
        lastChunkTime?: number;
    } {
        const signatureFormats = Object.keys(this.thoughtSignatures).filter(k => this.thoughtSignatures[k]);
        return {
            partCount: this.parts.length,
            textLength: this.getText({ includeThoughts: true }).length,
            thoughtsLength: this.getThoughts().length,
            normalTextLength: this.getNormalText().length,
            hasThoughts: this.parts.some(p => 'thought' in p && p.thought === true),
            hasRedactedThinking: this.parts.some(p => p.redactedThinking),
            hasThoughtSignatures: signatureFormats.length > 0,
            thoughtSignatureFormats: signatureFormats,
            usageMetadata: this.usageMetadata,
            thinkingDuration: this.getThinkingDuration(),
            chunkCount: this.chunkCount,
            firstChunkTime: this.firstChunkTime,
            lastChunkTime: this.lastChunkTime
        };
    }
}
