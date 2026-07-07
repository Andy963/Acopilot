export interface ContextSnapshotModule {
    title: string;
    contentPreview: string;
    charCount: number;
    truncated: boolean;
}

export interface ContextSnapshotTools {
    toolMode: 'function_call' | 'xml' | 'json';
    total: number;
    mcp: number;
    definitionPreview?: string;
    definitionCharCount?: number;
    definitionTruncated?: boolean;
}

export interface ContextSnapshotTrim {
    fullHistoryCount: number;
    trimmedHistoryCount: number;
    trimStartIndex: number;
    lastSummaryIndex: number;
    effectiveStartIndex: number;
    summary?: {
        preview: string;
        charCount: number;
        truncated: boolean;
        summarizedMessageCount?: number;
        keptRecentRounds?: number;
        generatedAt?: number;
    };
}

/**
 * Context Inspector - 注入明细（用于 UI 解释/调试）
 *
 * 注意：这是持久化数据，会随对话历史一起写入磁盘，建议仅保存元数据，避免过度膨胀。
 */
export interface ContextInjectedPinnedFile {
    id?: string;
    path: string;
    workspace?: string;
    exists?: boolean;
    included?: boolean;
}

export interface ContextInjectedPinnedFiles {
    totalEnabled: number;
    included: number;
    files: ContextInjectedPinnedFile[];
}

export interface ContextInjectedPinnedPrompt {
    mode: 'none' | 'skill' | 'custom' | 'preset';
    skillId?: string;
    skillName?: string;
    presetId?: string;
    presetName?: string;
    customPromptCharCount?: number;
}

export interface ContextInjectedAttachment {
    id?: string;
    name: string;
    type?: string;
    mimeType?: string;
    size?: number;
    url?: string;
    estimatedTokens?: number;
    truncated?: boolean;
    inclusionMode?: 'inline' | 'text' | 'unsupported';
}

export interface ContextInjectedAttachments {
    count: number;
    items: ContextInjectedAttachment[];
}

export interface ContextInjectedPinnedSelection {
    id?: string;
    path: string;
    startLine?: number;
    endLine?: number;
    languageId?: string;
    charCount?: number;
    truncated?: boolean;
}

export interface ContextInjectedPinnedSelections {
    count: number;
    items: ContextInjectedPinnedSelection[];
}

export interface ContextInjectedInfo {
    pinnedFiles?: ContextInjectedPinnedFiles;
    pinnedPrompt?: ContextInjectedPinnedPrompt;
    attachments?: ContextInjectedAttachments;
    pinnedSelections?: ContextInjectedPinnedSelections;
}

export interface ContextSnapshot {
    generatedAt: number;
    conversationId?: string;
    configId: string;
    providerType: string;
    model: string;
    estimatedTotalTokens?: number;
    maxContextTokens?: number;
    tools: ContextSnapshotTools;
    systemInstructionPreview: string;
    systemInstructionCharCount: number;
    systemInstructionTruncated: boolean;
    modules: ContextSnapshotModule[];
    injected?: ContextInjectedInfo;
    trim?: ContextSnapshotTrim;
}

/**
 * 本条消息引用（仅 user 消息有值）
 *
 * 由前端通过“Add Selection to Chat”添加，并会持久化到该条 user 消息上以支持重试/复现。
 */
export interface SelectionReference {
    id?: string;
    source?: 'selection' | 'file';
    uri?: string;
    path: string;
    startLine?: number;
    endLine?: number;
    languageId?: string;
    text: string;
    originalCharCount?: number;
    truncated?: boolean;
    createdAt?: number;
}

/**
 * 本次消息级上下文注入覆写（仅对当前用户消息生效）
 *
 * 用于在“仅本条消息”维度临时关闭/开启某些上下文模块，
 * 同时保持与 Settings 中的全局默认值联动。
 */
export interface ContextInjectionOverrides {
    includeWorkspaceFiles?: boolean;
    includeOpenTabs?: boolean;
    includeActiveEditor?: boolean;
    includeDiagnostics?: boolean;
    includePinnedFiles?: boolean;
    includePinnedPrompt?: boolean;
    includeTools?: boolean;

    /**
     * 限制本次请求可用的工具集合（白名单）
     *
     * - 仅影响“注入给模型的工具声明”和“工具执行阶段的允许列表”。
     * - 为空/未设置时表示不限制（沿用全局工具开关）。
     */
    toolAllowList?: string[];

    /**
     * 模型覆盖（仅本次请求生效）
     *
     * 如果提供，将覆盖当前渠道配置的 model 字段。
     */
    modelOverride?: string;

    /**
     * 请求模式（仅本次请求生效）
     *
     * - locate: 只做定位 + 打开文件，不做修改。
     */
    mode?: 'locate';
}

/**
 * Gemini Content（消息内容）
 *
 * Gemini API 的标准消息格式
 */
