import type { ChannelTokenCounts, ContentPart, UsageMetadata } from './contentParts';
import type { ContextInjectionOverrides, ContextSnapshot, SelectionReference } from './context';
export interface Content {
    /** 角色 */
    role: 'user' | 'model' | 'system';
    /** 内容片段列表 */
    parts: ContentPart[];
    
    /**
     * 消息在历史记录中的索引
     *
     * 由后端在返回消息时填充，用于前端在删除/重试时
     * 直接使用此索引，无需进行复杂的索引转换计算。
     */
    index?: number;
    
    /**
     * 模型版本（仅 model 消息有值）
     *
     * 例如: "gemini-2.5-flash", "gpt-5o"
     * 用于标识是哪个模型生成的回复
     */
    modelVersion?: string;
    
    /**
     * 结束原因（仅 model 消息有值）
     *
     * 用于判断响应是否因为达到输出上限等原因被截断。
     * 例如: "STOP", "MAX_TOKENS", "SAFETY" 等（不同提供商取值不同）。
     */
    finishReason?: string;
    
    /**
     * Token 使用统计（仅 model 消息有值）
     *
     * 包含完整的 usageMetadata：
     * - promptTokenCount: 输入 prompt 的 token 数
     * - candidatesTokenCount: 输出候选的 token 数
     * - totalTokenCount: 总 token 数
     * - thoughtsTokenCount: 思考部分的 token 数
     * - promptTokensDetails: prompt token 详情
     */
    usageMetadata?: UsageMetadata;
    
    /**
     * 思考持续时间（毫秒）
     *
     * 仅对包含思考内容的 model 消息有值
     * 记录从收到第一个思考块到收到第一个非思考内容块之间的时间
     * 用于在前端显示 AI 思考耗时
     */
    thinkingDuration?: number;
    
    /**
     * 思考开始时间戳（毫秒）
     *
     * 仅在流式响应过程中使用，用于计算思考持续时间
     * 完成后会被移除，只保留 thinkingDuration
     */
    thinkingStartTime?: number;
    
    /**
     * 响应持续时间（毫秒）
     *
     * 从发出请求到响应正常结束的时间
     * 仅对 model 消息有值
     */
    responseDuration?: number;
    
    /**
     * 第一个流式块时间戳（毫秒）
     *
     * 用于计算 Token 速率
     */
    firstChunkTime?: number;
    
    /**
     * 流式响应持续时间（毫秒）
     *
     * 从收到第一个流式块到响应结束的时间
     * 用于计算 Token 速率
     */
    streamDuration?: number;
    
    /**
     * 流式块数量
     *
     * 用于判断是否只有一个块（只有一个块时不计算速率）
     */
    chunkCount?: number;
    
    /**
     * 标识此 user 消息是否为函数调用响应
     *
     * 仅对 role='user' 的消息有意义
     * - true: 此消息包含 functionResponse（函数执行结果）
     * - false/undefined: 此消息是普通用户消息
     *
     * 用于区分普通用户消息和函数响应消息，
     * 在过滤思考签名时需要此标记来定位最后一个非函数响应的用户消息
     */
    isFunctionResponse?: boolean;
    
    /**
     * 标识此 user 消息是否为上下文总结消息
     *
     * 仅对 role='user' 的消息有意义
     * - true: 此消息是上下文总结，包含之前对话的压缩摘要
     * - false/undefined: 此消息是普通用户消息
     *
     * 使用场景：
     * - 当对话过长时，用户可以触发上下文总结
     * - 系统会将旧对话压缩为总结消息
     * - 后续调用 AI 时，从最后一个总结消息开始获取历史
     *
     * 前端显示：
     * - 以特殊样式显示，表明这是总结内容
     * - 可以展开查看完整总结
     */
    isSummary?: boolean;
    
    /**
     * 总结消息覆盖的消息数量
     *
     * 仅当 isSummary=true 时有意义
     * 记录此总结替代了多少条原始消息
     */
    summarizedMessageCount?: number;

    summaryKeptRecentRounds?: number;

    summaryGeneratedAt?: number;
    
    /**
     * 消息创建时间戳（毫秒）
     *
     * 用于前端显示消息发送时间
     * 如果未设置，前端会使用加载时的时间
     */
    timestamp?: number;
    
    /**
     * 该消息按渠道分类的 token 数（仅用户消息和函数响应消息）
     *
     * 由于不同渠道（Gemini、OpenAI、Anthropic）对同一消息的 token 计算方式不同，
     * 按渠道类型分别存储，在裁剪上下文时根据当前使用的渠道获取对应值。
     *
     * 计算方式（优先级从高到低）：
     * 1. 调用渠道的 token 计数 API 获取精确值
     * 2. 如果 API 调用失败，使用相邻轮次 promptTokenCount 差值计算
     * 3. 如果没有 promptTokenCount，使用字符数估算
     *
     * 用于：
     * - 估算完整历史的 token 数
     * - 判断是否需要裁剪上下文
     * - 避免上下文振荡问题
     *
     * 示例：
     * {
     *   gemini: 1500,
     *   openai: 1520,
     *   anthropic: 1480
     * }
     */
    tokenCountByChannel?: ChannelTokenCounts;
    
    /**
     * @deprecated 使用 tokenCountByChannel 代替
     * 保留用于向后兼容，新代码应使用 tokenCountByChannel
     */
    estimatedTokenCount?: number;
    
    /**
     * @deprecated 使用 usageMetadata.thoughtsTokenCount 代替
     */
    thoughtsTokenCount?: number;
    
    /**
     * @deprecated 使用 usageMetadata.candidatesTokenCount 代替
     */
    candidatesTokenCount?: number;

    /**
     * 上下文快照（仅 model 消息有值）
     *
     * 用于在 UI 中解释“本次请求注入了哪些上下文/发生了哪些裁剪”。
     */
    contextSnapshot?: ContextSnapshot;

    /**
     * 本条消息引用（仅 user 消息有值）
     *
     * 由前端通过“Add Selection to Chat”添加，并持久化到历史中，便于重试/复现。
     */
    selectionReferences?: SelectionReference[];

    /**
     * Task Context（仅 user 消息有值）
     *
     * 由前端 Create Task / Issue 导入等功能提供，并持久化到历史中，便于重试/复现。
     *
     * 注意：发送给模型时会以“本轮 user message 前缀”的形式 request-only 注入，
     * 不会写回 parts.text，避免历史文本膨胀或重复注入。
     */
    taskContext?: string;

    /**
     * Open File Context (user messages only)
     *
     * Collected by the extension host based on currently open editor tabs (and optional selection),
     * then persisted in history for retry/reproducibility.
     *
     * Note: When sending to the model, this is injected as a request-only prefix on the user message.
     * It is NOT written back into parts.text to avoid history bloat and double injection.
     */
    openFileContext?: string;

    /**
     * 上下文注入覆写（仅 user 消息有值）
     *
     * 该字段由前端在发送消息时提供，并持久化到历史中，便于重试/复现。
     */
    contextOverrides?: ContextInjectionOverrides;
}

/**
 * 对话历史（Gemini 格式）
 * 
 * 这是存储的核心格式:
 * - 直接兼容 Gemini API
 * - 包含所有高级特性(函数调用、思考签名、思考内容等)
 * - 可以直接发送给 Gemini API
 * 
 * 存储方式:
 * - 文件名: {conversationId}.json
 * - 内容: JSON.stringify(ConversationHistory)
 * 
 * 思考内容存储:
 * - 思考摘要会被标记为 thought: true
 * - 思考签名会自动保存在 thoughtSignatures 字段
 * - 可选择是否在 UI 中显示思考内容
 */
export type ConversationHistory = Content[];

/**
 * 检查点记录
 *
 * 与对话消息索引关联的代码库快照记录
 */
