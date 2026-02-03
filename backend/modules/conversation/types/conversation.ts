import type { Content, ConversationHistory } from './content';
export interface CheckpointRecord {
    /** 检查点唯一 ID */
    id: string;
    
    /**
     * 关联的消息索引
     *
     * 表示此检查点是在处理该索引消息时创建的
     * 对于 before 阶段：在执行工具前创建，关联工具调用消息
     * 对于 after 阶段：在执行工具后创建，关联工具响应消息
     */
    messageIndex: number;
    
    /** 触发备份的工具名称 */
    toolName: string;
    
    /**
     * 备份阶段
     * - before: 工具执行前
     * - after: 工具执行后
     */
    phase: 'before' | 'after';
    
    /** 创建时间戳 */
    timestamp: number;
    
    /** 描述信息 */
    description?: string;
    
    /** 统计信息 */
    stats: {
        /** 文件数量 */
        fileCount: number;
        /** 总大小（字节） */
        totalSize: number;
    };
}

/**
 * 对话元数据
 *
 * 存储对话的额外信息(不是 Gemini 格式的一部分)
 */
export interface ConversationMetadata {
    /** 对话 ID */
    id: string;
    /** 对话标题 */
    title?: string;
    /** 创建时间 */
    createdAt: number;
    /** 最后更新时间 */
    updatedAt: number;
    
    /**
     * 工作区 URI
     *
     * 创建对话时的工作区路径，用于筛选显示
     * 例如: "file:///c%3A/Users/xxx/projects/my-project"
     */
    workspaceUri?: string;
    
    /**
     * 检查点列表
     *
     * 与消息索引关联的代码库快照记录
     */
    checkpoints?: CheckpointRecord[];
    
    /** 自定义元数据 */
    custom?: Record<string, unknown>;
}

/**
 * 完整的对话数据(包含历史和元数据)
 */
export interface ConversationData {
    /** 对话元数据 */
    metadata: ConversationMetadata;
    /** 对话历史(Gemini 格式) */
    history: ConversationHistory;
}

/**
 * 消息位置定位
 */
export interface MessagePosition {
    /** 消息索引 */
    index: number;
    /** 角色 */
    role: 'user' | 'model' | 'system';
}

/**
 * 消息过滤器
 */
export interface MessageFilter {
    /** 按角色过滤 */
    role?: 'user' | 'model' | 'system';
    /** 按是否包含函数调用过滤 */
    hasFunctionCall?: boolean;
    /** 按是否包含文本过滤 */
    hasText?: boolean;
    /** 按是否为思考内容过滤 */
    isThought?: boolean;
    /** 按索引范围过滤 */
    indexRange?: {
        start: number;
        end: number;
    };
}

/**
 * 历史快照
 * 
 * 用于保存对话的某个时间点状态
 */
export interface HistorySnapshot {
    /** 快照 ID */
    id: string;
    /** 对话 ID */
    conversationId: string;
    /** 快照名称 */
    name?: string;
    /** 快照描述 */
    description?: string;
    /** 快照时间戳 */
    timestamp: number;
    /** 历史记录(Gemini 格式) */
    history: ConversationHistory;
}

/**
 * 对话统计信息
 */
export interface ConversationStats {
    /** 总消息数 */
    totalMessages: number;
    /** 用户消息数 */
    userMessages: number;
    /** 模型消息数 */
    modelMessages: number;
    /** 函数调用次数 */
    functionCalls: number;
    /** 是否包含思考签名 */
    hasThoughtSignatures: boolean;
    /** 是否包含思考内容 */
    hasThoughts: boolean;
    /** 是否包含文件数据 */
    hasFileData: boolean;
    /** 是否包含内嵌多模态数据 */
    hasInlineData: boolean;
    /** 内嵌数据总大小（字节） */
    inlineDataSize: number;
    /** 多模态内容统计 */
    multimedia: {
        images: number;
        audio: number;
        video: number;
        documents: number;
    };
    /** Token 统计 */
    tokens: {
        /** 总思考 token 数 */
        totalThoughtsTokens: number;
        /** 总候选输出 token 数 */
        totalCandidatesTokens: number;
        /** 总 token 数（思考 + 输出） */
        totalTokens: number;
        /** 有思考 token 记录的消息数 */
        messagesWithThoughtsTokens: number;
        /** 有候选 token 记录的消息数 */
        messagesWithCandidatesTokens: number;
    };
}

/**
 * 消息编辑操作
 */
export interface MessageEdit {
    /** 消息索引 */
    index: number;
    /** 新的文本内容 */
    newText: string;
}

/**
 * 消息插入操作
 */
export interface MessageInsert {
    /** 插入位置（在此索引之前插入） */
    beforeIndex: number;
    /** 要插入的消息 */
    content: Content;
}
