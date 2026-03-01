/**
 * Acopilot - 对话历史管理类型定义
 * 
 * 完整支持 Gemini API 格式,包括:
 * - 文本、文件、内联数据
 * - 函数调用和函数响应
 * - 思考签名(Thinking)
 * - 思考内容(Thought)
 * - 所有高级特性
 * 
 * 存储格式: 完整的 Gemini Content[] 数组
 * 文件命名: 以对话 ID 作为文件名
 */

/**
 * 不同渠道的 Token 计数
 *
 * 由于不同渠道（Gemini、OpenAI、Anthropic）对同一消息的 token 计算方式不同，
 * 使用对象结构分开存储，便于按当前使用的渠道类型获取对应的 token 数。
 *
 * 计算方式：
 * - 通过调用各渠道的 token 计数 API 获取精确值
 * - 如果 API 调用失败，回退到估算方法
 */
export interface ChannelTokenCounts {
    /** Gemini 渠道的 token 数 */
    gemini?: number;
    
    /** OpenAI 渠道的 token 数 */
    openai?: number;
    
    /** Anthropic 渠道的 token 数 */
    anthropic?: number;
    
    /** 其他渠道的 token 数 */
    [key: string]: number | undefined;
}

/**
 * 思考签名（多格式支持）
 *
 * 不同 API 提供商返回的思考签名格式不同，
 * 使用对象结构分开存储，便于区分和管理
 *
 * 思考签名示例: "Eo4KCosKAXrI2nyWeryDa/51Rbxj4E/V/8w=="
 */
export interface ThoughtSignatures {
    /** Gemini 格式思考签名 */
    gemini?: string;
    
    /** Anthropic 格式思考签名（预留） */
    anthropic?: string;
    
    /** OpenAI 格式思考签名（预留） */
    openai?: string;
    
    /** OpenAI Responses 格式思考签名 */
    'openai-responses'?: string;
    
    /** 其他格式思考签名 */
    [key: string]: string | undefined;
}

/**
 * Gemini Content Part（内容片段）
 *
 * 支持 Gemini API 的所有内容类型:
 * - text: 文本内容
 * - inlineData: Base64 编码的内联数据(图片、音频等)
 * - fileData: 文件引用(通过 File API 上传的文件)
 * - functionCall: 模型请求调用的函数
 * - functionResponse: 函数执行结果
 * - thoughtSignatures: 思考签名(用于多轮对话中保持思考上下文)
 * - thought: 是否为思考内容标志
 */
export interface ContentPart {
    /** 文本内容 */
    text?: string;
    
    /**
     * 内联数据(Base64 编码)
     *
     * 标准 Gemini API 只需要 mimeType 和 data。
     * - displayName: Gemini API 支持的显示名称字段
     * - id 和 name 是附件元数据，仅用于存储和前端显示，
     *   发送给 AI 时会被过滤掉。
     */
    inlineData?: {
        mimeType: string;
        data: string; // Base64 编码的数据
        /** 显示名称（Gemini API 支持，可发送给 API） */
        displayName?: string;
        /** 附件 ID（仅用于存储和显示，发送 API 时过滤） */
        id?: string;
        /** 附件名称（仅用于存储和显示，发送 API 时过滤） */
        name?: string;
    };
    
    /**
     * 文件数据(File API 引用)
     *
     * displayName 在以下场景中必需：
     * - 在 functionResponse.parts 中，需要通过 {"$ref": "displayName"} 引用时
     */
    fileData?: {
        mimeType: string;
        fileUri: string;
        displayName?: string; // 用于 JSON 引用的唯一名称
    };
    
    /** 函数调用(模型请求) */
    functionCall?: {
        name: string;
        args: Record<string, unknown>;
        /** 增量解析时的原始 JSON 字符串（用于流式输出） */
        partialArgs?: string;
        id?: string; // 可选的函数调用 ID
        /**
         * 是否已被用户拒绝执行
         *
         * 当用户在工具等待确认时点击终止按钮，此字段会被设置为 true
         * 用于在重新加载对话时正确显示工具状态
         */
        rejected?: boolean;
    };
    
    /**
     * 函数响应(执行结果)
     *
     * Gemini 3 Pro+ 支持多模态函数响应：
     * - parts: 可以包含 inlineData 或 fileData 的嵌套 parts
     * - response: 可以使用 {"$ref": "displayName"} 引用 parts 中的多模态内容
     * - id: 函数调用 ID（Anthropic API 必需，用于关联 tool_use 和 tool_result）
     *
     * 示例：
     * {
     *   "functionResponse": {
     *     "name": "get_image",
     *     "id": "toolu_xxx",
     *     "response": {
     *       "image_ref": { "$ref": "cat.jpg" }
     *     },
     *     "parts": [
     *       {
     *         "fileData": {
     *           "displayName": "cat.jpg",
     *           "mimeType": "image/jpeg",
     *           "fileUri": "gs://..."
     *         }
     *       }
     *     ]
     *   }
     * }
     */
    functionResponse?: {
        name: string;
        response: Record<string, unknown>;
        id?: string; // 函数调用 ID（Anthropic 必需）
        parts?: ContentPart[]; // 嵌套的多模态 parts (Gemini 3 Pro+)
    };
    
    /**
     * 思考签名（多格式支持）
     *
     * 按提供商格式分类存储的思考签名
     *
     * 示例: { gemini: "Eo4KCosKAXLI2nyWeryDa/51Rbxj4E/V/8w==" }
     *
     * 使用场景:
     * - thoughtSignatures.gemini: Gemini API 返回的签名
     * - thoughtSignatures.anthropic: Anthropic API 返回的签名（预留）
     * - thoughtSignatures.openai: OpenAI API 返回的签名（预留）
     *
     * 发送请求时，根据目标 API 类型选择对应格式的签名发送
     *
     * 重要规则:
     * - 必须原样返回给模型，不能修改
     * - 不能与其他 part 合并
     * - 不能合并两个都含签名的 parts
     * - 对于 Gemini 3 函数调用：必须返回，否则会 400 错误
     * - 对于其他情况：推荐返回以保持推理质量
     */
    thoughtSignatures?: ThoughtSignatures;
    
    /**
     * 是否为思考内容标志
     *
     * 当设置为 true 时，表示此 part 包含模型的思考过程而非最终回答：
     * - 思考摘要：当 includeThoughts=true 时，模型返回的推理过程
     * - 与正文内容分离，用于调试或了解推理步骤
     * - 不应作为最终答案展示给用户
     *
     * 示例 1 - 思考内容:
     * {
     *   "text": "Let me think step-by-step about this problem...",
     *   "thought": true  // 这是思考过程
     * }
     *
     * 示例 2 - 正文回答:
     * {
     *   "text": "The answer is 42",
     *   "thought": false // 或省略此字段，这是最终回答
     * }
     *
     * 完整响应示例:
     * {
     *   "role": "model",
     *   "parts": [
     *     {
     *       "text": "I need to calculate... step 1, step 2...",
     *       "thought": true  // 思考过程
     *     },
     *     {
     *       "text": "Based on my analysis, the result is X",
     *       // thought 字段省略或为 false，表示这是最终回答
     *     }
     *   ]
     * }
     */
    thought?: boolean;
    
    /**
     * 加密的思考内容（Anthropic redacted_thinking）
     *
     * Anthropic Claude 在某些情况下会返回加密的思考内容，
     * 以 Base64 编码的形式存储在 redacted_thinking 块中。
     *
     * 与普通思考内容的区别：
     * - 普通思考（thought: true + text）：可读的思考过程
     * - 加密思考（redactedThinking）：不可读，但需要在后续对话中原样返回
     *
     * 存储格式：
     * {
     *   "redactedThinking": "EmwKAhgBEgy3va3pzix/LafPsn4a..."
     * }
     *
     * 发送时需要转换为：
     * {
     *   "type": "redacted_thinking",
     *   "data": "EmwKAhgBEgy3va3pzix/LafPsn4a..."
     * }
     */
    redactedThinking?: string;
}

/**
 * Token 详情条目
 *
 * 按模态（modality）分类的 token 统计
 */
export interface TokenDetailsEntry {
    /** 模态类型: "TEXT" | "IMAGE" | "AUDIO" | "VIDEO" */
    modality: string;
    /** Token 数量 */
    tokenCount: number;
}

/**
 * Token 使用统计（Gemini usageMetadata 格式）
 *
 * 仅存储在 model 角色的消息上
 */
export interface UsageMetadata {
    /** 输入 prompt 的 token 数量 */
    promptTokenCount?: number;

    /**
     * 缓存命中的输入 token 数（OpenAI Responses: usage.input_tokens_details.cached_tokens）
     *
     * 仅在支持 prompt cache 的提供商上有值，其它渠道通常为 undefined。
     */
    cachedPromptTokenCount?: number;
    
    /** 候选输出内容的 token 数量 */
    candidatesTokenCount?: number;
    
    /** 总 token 数量（prompt + candidates + thoughts） */
    totalTokenCount?: number;
    
    /** 思考部分的 token 数量 */
    thoughtsTokenCount?: number;
    
    /** Prompt token 详情（按模态分类） */
    promptTokensDetails?: TokenDetailsEntry[];
    
    /** 候选输出 token 详情（按模态分类，如 IMAGE、TEXT 等） */
    candidatesTokensDetails?: TokenDetailsEntry[];
}

/**
 * Context Inspector - 上下文快照（用于 UI 解释/调试）
 *
 * 注意：这是持久化数据，会随对话历史一起写入磁盘，建议仅保存“预览/截断”内容，避免过度膨胀。
 */
