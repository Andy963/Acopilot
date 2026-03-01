/**
 * Acopilot 前端类型定义
 */

// ============ 消息相关类型 ============

/**
 * ContentPart - Gemini API 内容片段
 */
export interface ContentPart {
  text?: string
  inlineData?: {
    mimeType: string
    data: string  // Base64
  }
  fileData?: {
    mimeType: string
    fileUri: string
    displayName?: string
  }
  functionCall?: {
    name: string
    args: Record<string, unknown>
    id?: string
    /**
     * 是否已被用户拒绝执行
     *
     * 当用户在工具等待确认时点击终止按钮，此字段会被设置为 true
     * 用于在重新加载对话时正确显示工具状态
     */
    rejected?: boolean
    /**
     * 流式响应中的索引 (OpenAI 格式)
     */
    index?: number
    /**
     * 流式响应中的原始参数片段
     */
    partialArgs?: string
  }
  functionResponse?: {
    name: string
    response: Record<string, unknown>
    id?: string  // 用于匹配工具调用请求
    parts?: ContentPart[]
  }
  thoughtSignature?: string
  thought?: boolean
}

/**
 * Token 详情条目
 */
export interface TokenDetailsEntry {
  /** 模态类型: "TEXT" | "IMAGE" | "AUDIO" | "VIDEO" */
  modality: string
  /** Token 数量 */
  tokenCount: number
}

/**
 * Token 使用统计（Gemini usageMetadata 格式）
 */
export interface UsageMetadata {
  /** 输入 prompt 的 token 数量 */
  promptTokenCount?: number

  /**
   * 缓存命中的输入 token 数（OpenAI Responses: usage.input_tokens_details.cached_tokens）
   *
   * 仅在支持 prompt cache 的提供商上有值。
   */
  cachedPromptTokenCount?: number

  /** 候选输出内容的 token 数量 */
  candidatesTokenCount?: number

  /** 总 token 数量 */
  totalTokenCount?: number

  /** 思考部分的 token 数量 */
  thoughtsTokenCount?: number

  /** Prompt token 详情（按模态分类） */
  promptTokensDetails?: TokenDetailsEntry[]

  /** 候选输出 token 详情（按模态分类，如 IMAGE、TEXT 等） */
  candidatesTokensDetails?: TokenDetailsEntry[]
}

/**
 * Content - Gemini API 消息格式
 */
export interface Content {
  role: 'user' | 'model'
  parts: ContentPart[]
  /**
   * 消息在后端历史记录中的索引
   *
   * 由后端在返回消息时填充，前端在删除/重试时直接使用此索引
   */
  index?: number
  /** 模型版本（仅 model 消息有值），如 "gemini-2.5-flash" */
  modelVersion?: string
  /**
   * 结束原因（仅 model 消息有值）
   *
   * 用于判断响应是否因达到输出上限等原因被截断。
   * 不同提供商取值不同，例如: "STOP", "MAX_TOKENS", "length" 等。
   */
  finishReason?: string
  /** Token 使用统计（仅 model 消息有值） */
  usageMetadata?: UsageMetadata
  /** 是否为函数响应消息 */
  isFunctionResponse?: boolean
  /** 是否为上下文总结消息 */
  isSummary?: boolean
  /** 总结消息覆盖的消息数量 */
  summarizedMessageCount?: number
  /**
   * 思考开始时间戳（毫秒）
   *
   * 仅在流式响应过程中使用，用于前端实时显示思考时间
   * 完成后会被移除，只保留 thinkingDuration
   */
  thinkingStartTime?: number
  /**
   * 思考持续时间（毫秒）
   *
   * 仅对包含思考内容的 model 消息有值
   * 由后端计算并保存，记录从收到第一个思考块到收到第一个非思考内容块之间的时间
   */
  thinkingDuration?: number
  /**
   * 响应持续时间（毫秒）
   *
   * 从发出请求到响应正常结束的时间
   */
  responseDuration?: number
  /**
   * 第一个流式块时间戳（毫秒）
   *
   * 用于计算 Token 速率
   */
  firstChunkTime?: number
  /**
   * 流式响应持续时间（毫秒）
   *
   * 从收到第一个流式块到响应结束的时间
   */
  streamDuration?: number
  /**
   * 流式块数量
   *
   * 用于判断是否只有一个块
   */
  chunkCount?: number
  /**
   * 消息创建时间戳（毫秒）
   *
   * 用于前端显示消息发送时间
   */
  timestamp?: number
  /** @deprecated 使用 usageMetadata.thoughtsTokenCount */
  thoughtsTokenCount?: number
  /** @deprecated 使用 usageMetadata.candidatesTokenCount */
  candidatesTokenCount?: number
  /**
   * Context Inspector 上下文快照（仅助手消息有值）
   *
   * 用于解释本次请求注入了哪些上下文/发生了哪些裁剪。
   */
  contextSnapshot?: ContextInspectorData
  /**
   * 本条消息级上下文注入覆写（仅用户消息有值）
   *
   * 用于“仅本条消息”临时关闭/开启某些上下文模块（与 Settings 默认值联动）。
   */
  contextOverrides?: ContextInjectionOverrides
}

/**
 * Message - 前端展示用的消息格式
 *
 * 存储架构：
 * - allMessages: 存储所有消息，包括 functionResponse 消息，索引与后端一一对应
 * - messages: 计算属性，过滤掉 functionResponse 消息，用于显示
 *
 * 工具调用和响应通过 id 字段匹配，无需额外的索引映射
 */
export interface Message {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  timestamp: number
  attachments?: Attachment[]
  metadata?: MessageMetadata
  streaming?: boolean
  parts?: ContentPart[]  // 保留原始 Gemini 格式
  toolCalls?: ToolCall[]  // 工具调用列表
  toolResults?: ToolResult[]  // 工具执行结果
  tools?: ToolUsage[]  // 工具使用信息（合并后的数据）
  /**
   * 是否为 functionResponse 消息
   *
   * 这类消息在消息列表中隐藏，但用于和工具调用配对。
   * 工具调用和响应通过 ToolUsage.id / functionResponse.id 匹配。
   */
  isFunctionResponse?: boolean
  /**
   * 是否为上下文总结消息
   *
   * 总结消息以特殊样式显示，包含之前对话的压缩摘要
   */
  isSummary?: boolean
  /**
   * 总结消息覆盖的消息数量
   */
  summarizedMessageCount?: number
}

export interface MessageMetadata {
  /**
   * Internal/system-generated message.
   *
   * Kept in allMessages for correct backend indexing, but hidden from the UI.
   */
  internal?: boolean
  /** 模型版本，如 "gemini-2.5-flash" */
  modelVersion?: string
  /** @deprecated 使用 modelVersion */
  model?: string
  tokens?: number
  latency?: number
  /** 完整的 token 使用统计 */
  usageMetadata?: UsageMetadata
  /** 结束原因（用于判断是否被截断） */
  finishReason?: string
  /**
   * 思考开始时间戳（毫秒）
   *
   * 仅在流式响应过程中使用，用于前端实时显示思考时间
   * 完成后会被移除，只保留 thinkingDuration
   */
  thinkingStartTime?: number
  /**
   * 思考持续时间（毫秒）
   *
   * 仅对包含思考内容的消息有值
   * 由后端计算并保存，记录从收到第一个思考块到收到第一个非思考内容块之间的时间
   */
  thinkingDuration?: number
  /**
   * 响应持续时间（毫秒）
   *
   * 由后端计算，从发出请求到响应正常结束的时间
   */
  responseDuration?: number
  /**
   * 第一个流式块时间戳（毫秒）
   *
   * 用于计算 Token 速率
   */
  firstChunkTime?: number
  /**
   * 流式响应持续时间（毫秒）
   *
   * 由后端计算，从收到第一个流式块到响应结束的时间
   */
  streamDuration?: number
  /**
   * 流式块数量
   *
   * 由后端记录，用于判断是否只有一个块
   */
  chunkCount?: number
  /** @deprecated 使用 usageMetadata.thoughtsTokenCount */
  thoughtsTokenCount?: number
  /** @deprecated 使用 usageMetadata.candidatesTokenCount */
  candidatesTokenCount?: number
  /**
   * Context Inspector 上下文快照（仅助手消息有值）
   *
   * 用于解释本次请求注入了哪些上下文/发生了哪些裁剪。
   */
  contextSnapshot?: ContextInspectorData
  [key: string]: any
}
