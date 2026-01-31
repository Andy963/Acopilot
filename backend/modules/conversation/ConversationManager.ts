/**
 * Acopilot - 对话历史管理器
 *
 * 核心职责:
 * - 管理 Gemini 格式的对话历史
 * - 提供类型安全的操作 API
 * - 维护对话元数据
 * - 支持持久化存储
 *
 * 存储格式:
 * - 历史: 完整的 Gemini Content[] 数组
 * - 元数据: 对话标题、创建时间等
 * - 快照: 历史的时间点副本
 */

import { t } from '../../i18n';
import {
    ConversationHistory,
    ConversationMetadata,
    Content,
    ContentPart,
    MessagePosition,
    MessageFilter,
    HistorySnapshot,
    ConversationStats
} from './types';
import type { IStorageAdapter } from './storage';
import type { GetHistoryOptions } from './historyOptions';
import { buildHistoryForApi } from './historyForApi';

export type { GetHistoryOptions, MultimodalCapability } from './historyOptions';

/**
 * 对话管理器
 *
 * 特点:
 * - 完整支持 Gemini 格式的所有特性
 * - 自动维护元数据
 * - 支持思考签名、函数调用等高级特性
 * - 可直接将历史发送给 Gemini API
 * - 无内存缓存，每次操作直接读写存储，确保数据一致性
 */
export class ConversationManager {
    constructor(private storage: IStorageAdapter) {}

    // ==================== 对话管理 ====================

    /**
     * 创建新对话
     * @param conversationId 对话 ID
     * @param title 对话标题
     * @param workspaceUri 工作区 URI（可选）
     */
    async createConversation(conversationId: string, title?: string, workspaceUri?: string): Promise<void> {
        // 检查存储中是否已存在
        const existing = await this.storage.loadHistory(conversationId);
        if (existing) {
            throw new Error(t('modules.conversation.errors.conversationExists', { conversationId }));
        }

        const now = Date.now();
        const meta: ConversationMetadata = {
            id: conversationId,
            title: title || t('modules.conversation.defaultTitle', { conversationId }),
            createdAt: now,
            updatedAt: now,
            workspaceUri,
            custom: {}
        };

        await this.storage.saveHistory(conversationId, []);
        await this.storage.saveMetadata(meta);
    }

    /**
     * 删除对话
     */
    async deleteConversation(conversationId: string): Promise<void> {
        await this.storage.deleteHistory(conversationId);
    }

    /**
     * 列出所有对话
     */
    async listConversations(): Promise<string[]> {
        return await this.storage.listConversations();
    }

    /**
     * 加载对话历史（直接从存储读取）
     */
    private async loadHistory(conversationId: string): Promise<ConversationHistory> {
        const history = await this.storage.loadHistory(conversationId);
        if (!history) {
            // 如果不存在，创建空对话
            await this.createConversation(conversationId);
            return [];
        }
        return history;
    }

    /**
     * 获取对话历史的只读副本
     */
    async getHistory(conversationId: string): Promise<Readonly<ConversationHistory>> {
        const history = await this.loadHistory(conversationId);
        return JSON.parse(JSON.stringify(history));
    }

    /**
     * 获取对话历史的引用（用于直接发送给 API）
     * 注意: 每次调用都从存储读取最新数据
     */
    async getHistoryRef(conversationId: string): Promise<ConversationHistory> {
        return await this.loadHistory(conversationId);
    }

    // ==================== 消息操作 ====================

    /**
     * 添加消息（Gemini 格式）
     */
    async addMessage(
        conversationId: string,
        role: 'user' | 'model' | 'system',
        parts: ContentPart[]
    ): Promise<void> {
        const history = await this.loadHistory(conversationId);
        history.push({
            role,
            parts: JSON.parse(JSON.stringify(parts)),
            timestamp: Date.now()  // 自动添加时间戳
        });
        await this.storage.saveHistory(conversationId, history);
    }

    /**
     * 添加完整的 Content 对象
     */
    async addContent(conversationId: string, content: Content): Promise<void> {
        const history = await this.loadHistory(conversationId);
        const contentCopy = JSON.parse(JSON.stringify(content));
        // 如果没有时间戳，自动添加
        if (!contentCopy.timestamp) {
            contentCopy.timestamp = Date.now();
        }
        history.push(contentCopy);
        await this.storage.saveHistory(conversationId, history);
    }

    /**
     * 批量添加消息
     */
    async addBatch(conversationId: string, contents: Content[]): Promise<void> {
        const history = await this.loadHistory(conversationId);
        const now = Date.now();
        const contentsCopy = JSON.parse(JSON.stringify(contents)).map((content: Content, index: number) => {
            // 如果没有时间戳，自动添加（同一批次的消息时间戳递增）
            if (!content.timestamp) {
                content.timestamp = now + index;
            }
            return content;
        });
        history.push(...contentsCopy);
        await this.storage.saveHistory(conversationId, history);
    }

    /**
     * 获取所有消息
     *
     * 返回的每条消息都包含 index 字段，用于前端在删除/重试时直接使用
     * 每次调用都从存储读取最新数据
     */
    async getMessages(conversationId: string): Promise<Content[]> {
        const history = await this.loadHistory(conversationId);
        // 为每条消息添加 index 字段
        return history.map((message, index) => ({
            ...JSON.parse(JSON.stringify(message)),
            index
        }));
    }

    /**
     * 获取指定索引的消息
     */
    async getMessage(conversationId: string, index: number): Promise<Content | undefined> {
        const history = await this.loadHistory(conversationId);
        if (index < 0 || index >= history.length) {
            return undefined;
        }
        return JSON.parse(JSON.stringify(history[index]));
    }

    /**
     * 更新消息
     */
    async updateMessage(
        conversationId: string,
        messageIndex: number,
        updates: Partial<Content>
    ): Promise<void> {
        const history = await this.loadHistory(conversationId);
        if (messageIndex < 0 || messageIndex >= history.length) {
            throw new Error(t('modules.conversation.errors.messageIndexOutOfBounds', { index: messageIndex }));
        }
        Object.assign(history[messageIndex], updates);
        await this.storage.saveHistory(conversationId, history);
    }

    /**
     * 删除消息
     */
    async deleteMessage(conversationId: string, messageIndex: number): Promise<void> {
        const history = await this.loadHistory(conversationId);
        if (messageIndex < 0 || messageIndex >= history.length) {
            throw new Error(t('modules.conversation.errors.messageIndexOutOfBounds', { index: messageIndex }));
        }
        history.splice(messageIndex, 1);
        await this.storage.saveHistory(conversationId, history);
    }

    /**
     * 插入消息
     */
    async insertMessage(
        conversationId: string,
        position: number,
        role: 'user' | 'model' | 'system',
        parts: ContentPart[]
    ): Promise<void> {
        const history = await this.loadHistory(conversationId);
        const index = Math.max(0, Math.min(position, history.length));
        history.splice(index, 0, {
            role,
            parts: JSON.parse(JSON.stringify(parts)),
            timestamp: Date.now()  // 自动添加时间戳
        });
        await this.storage.saveHistory(conversationId, history);
    }

    /**
     * 在指定位置插入完整的 Content 对象
     */
    async insertContent(
        conversationId: string,
        position: number,
        content: Content
    ): Promise<void> {
        const history = await this.loadHistory(conversationId);
        const index = Math.max(0, Math.min(position, history.length));
        const contentCopy = JSON.parse(JSON.stringify(content));
        // 如果没有时间戳，自动添加
        if (!contentCopy.timestamp) {
            contentCopy.timestamp = Date.now();
        }
        history.splice(index, 0, contentCopy);
        await this.storage.saveHistory(conversationId, history);
    }

    // ==================== 批量操作 ====================

    /**
     * 删除指定范围的消息
     */
    async deleteMessagesInRange(
        conversationId: string,
        startIndex: number,
        endIndex: number
    ): Promise<void> {
        const history = await this.loadHistory(conversationId);
        const start = Math.max(0, startIndex);
        const end = Math.min(history.length, endIndex + 1);
        history.splice(start, end - start);
        await this.storage.saveHistory(conversationId, history);
    }

    /**
     * 删除到指定消息（从后往前删除）
     *
     * @param conversationId 对话 ID
     * @param targetIndex 目标消息索引（删除到这个索引为止，包括该消息）
     * @returns 删除的消息数量
     *
     * @example
     * // 删除最后 3 条消息（假设历史有 10 条）
     * await manager.deleteToMessage('chat-001', 7); // 删除索引 7, 8, 9
     *
     * 注意：删除后可能留下孤立的 functionCall（没有对应的 functionResponse）
     * ChatHandler 在重试时会检测并重新执行这些孤立的函数调用
     */
    async deleteToMessage(
        conversationId: string,
        targetIndex: number
    ): Promise<number> {
        const history = await this.loadHistory(conversationId);
        
        if (targetIndex < 0 || targetIndex >= history.length) {
            throw new Error(t('modules.conversation.errors.messageIndexOutOfBounds', { index: targetIndex }));
        }
        
        // 从后往前删除，直到删除到目标索引（包括目标索引）
        const deleteCount = history.length - targetIndex;
        history.splice(targetIndex, deleteCount);
        
        await this.storage.saveHistory(conversationId, history);
        return deleteCount;
    }

    /**
     * 清空对话历史
     */
    async clearHistory(conversationId: string): Promise<void> {
        await this.storage.saveHistory(conversationId, []);
    }

    // ==================== 查询和过滤 ====================

    /**
     * 查找消息
     */
    async findMessages(
        conversationId: string,
        filter: MessageFilter
    ): Promise<MessagePosition[]> {
        const history = await this.loadHistory(conversationId);
        const results: MessagePosition[] = [];

        for (let i = 0; i < history.length; i++) {
            const message = history[i];
            let matches = true;

            if (filter.role && message.role !== filter.role) {
                matches = false;
            }

            if (filter.hasFunctionCall !== undefined) {
                const hasFunctionCall = message.parts.some(p => p.functionCall !== undefined);
                if (hasFunctionCall !== filter.hasFunctionCall) {
                    matches = false;
                }
            }

            if (filter.hasText !== undefined) {
                const hasText = message.parts.some(
                    p => p.text !== undefined && p.text.trim() !== ''
                );
                if (hasText !== filter.hasText) {
                    matches = false;
                }
            }

            if (filter.isThought !== undefined) {
                const isThought = message.parts.some(p => p.thought === true);
                if (isThought !== filter.isThought) {
                    matches = false;
                }
            }

            if (filter.indexRange) {
                const { start, end } = filter.indexRange;
                if (i < start || i >= end) {
                    matches = false;
                }
            }

            if (matches) {
                results.push({ index: i, role: message.role });
            }
        }

        return results;
    }

    /**
     * 获取指定角色的所有消息
     */
    async getMessagesByRole(
        conversationId: string,
        role: 'user' | 'model' | 'system'
    ): Promise<Content[]> {
        const history = await this.loadHistory(conversationId);
        return history
            .filter(msg => msg.role === role)
            .map(msg => JSON.parse(JSON.stringify(msg)));
    }

    // ==================== 快照管理 ====================

    /**
     * 创建快照
     */
    async createSnapshot(
        conversationId: string,
        name?: string,
        description?: string
    ): Promise<HistorySnapshot> {
        const history = await this.loadHistory(conversationId);
        const snapshot: HistorySnapshot = {
            id: `snapshot_${conversationId}_${Date.now()}`,
            conversationId,
            name,
            description,
            timestamp: Date.now(),
            history: JSON.parse(JSON.stringify(history))
        };
        await this.storage.saveSnapshot(snapshot);
        return snapshot;
    }

    /**
     * 恢复快照
     */
    async restoreSnapshot(conversationId: string, snapshotId: string): Promise<void> {
        const snapshot = await this.storage.loadSnapshot(snapshotId);
        if (!snapshot) {
            throw new Error(t('modules.conversation.errors.snapshotNotFound', { snapshotId }));
        }
        if (snapshot.conversationId !== conversationId) {
            throw new Error(t('modules.conversation.errors.snapshotNotBelongToConversation'));
        }
        
        await this.storage.saveHistory(conversationId, snapshot.history);
    }

    /**
     * 删除快照
     */
    async deleteSnapshot(snapshotId: string): Promise<void> {
        await this.storage.deleteSnapshot(snapshotId);
    }

    /**
     * 列出对话的所有快照
     */
    async listSnapshots(conversationId: string): Promise<string[]> {
        return await this.storage.listSnapshots(conversationId);
    }

    // ==================== 统计信息 ====================

    /**
     * 获取统计信息
     */
    async getStats(conversationId: string): Promise<ConversationStats> {
        const history = await this.loadHistory(conversationId);
        
        let userMessages = 0;
        let modelMessages = 0;
        let functionCalls = 0;
        let hasThoughtSignatures = false;
        let hasThoughts = false;
        let hasFileData = false;
        let hasInlineData = false;
        let inlineDataSize = 0;
        const multimedia = {
            images: 0,
            audio: 0,
            video: 0,
            documents: 0
        };
        
        // Token 统计
        let totalThoughtsTokens = 0;
        let totalCandidatesTokens = 0;
        let messagesWithThoughtsTokens = 0;
        let messagesWithCandidatesTokens = 0;

        for (const message of history) {
            if (message.role === 'user') {
                userMessages++;
            } else {
                modelMessages++;
            }
            
            // 统计 token（优先使用 usageMetadata，向后兼容旧格式）
            const thoughtsTokens = message.usageMetadata?.thoughtsTokenCount ?? message.thoughtsTokenCount;
            const candidatesTokens = message.usageMetadata?.candidatesTokenCount ?? message.candidatesTokenCount;
            
            if (thoughtsTokens !== undefined) {
                totalThoughtsTokens += thoughtsTokens;
                messagesWithThoughtsTokens++;
            }
            if (candidatesTokens !== undefined) {
                totalCandidatesTokens += candidatesTokens;
                messagesWithCandidatesTokens++;
            }

            for (const part of message.parts) {
                // 函数调用
                if (part.functionCall) {
                    functionCalls++;
                }
                
                // 检查思考签名
                if (part.thoughtSignatures) {
                    hasThoughtSignatures = true;
                }
                
                // 检查思考内容
                if (part.thought === true) {
                    hasThoughts = true;
                }
                
                // 检查文件数据
                if (part.fileData) {
                    hasFileData = true;
                }
                
                // 检查内嵌数据
                if (part.inlineData) {
                    hasInlineData = true;
                    
                    // 计算 Base64 数据大小（约为原始数据的 4/3）
                    const base64Length = part.inlineData.data.length;
                    inlineDataSize += Math.ceil((base64Length * 3) / 4);
                    
                    // 统计多模态类型
                    const mimeType = part.inlineData.mimeType;
                    if (mimeType.startsWith('image/')) {
                        multimedia.images++;
                    } else if (mimeType.startsWith('audio/')) {
                        multimedia.audio++;
                    } else if (mimeType.startsWith('video/')) {
                        multimedia.video++;
                    } else if (mimeType === 'application/pdf' || mimeType === 'text/plain') {
                        multimedia.documents++;
                    }
                }
            }
        }

        return {
            totalMessages: history.length,
            userMessages,
            modelMessages,
            functionCalls,
            hasThoughtSignatures,
            hasThoughts,
            hasFileData,
            hasInlineData,
            inlineDataSize,
            multimedia,
            tokens: {
                totalThoughtsTokens,
                totalCandidatesTokens,
                totalTokens: totalThoughtsTokens + totalCandidatesTokens,
                messagesWithThoughtsTokens,
                messagesWithCandidatesTokens
            }
        };
    }

    /**
     * 获取适合 API 调用的对话历史
     *
     * 此方法返回格式化的历史记录，移除内部字段（如 token 计数）
     *
     * 思考内容过滤策略：
     * - 默认情况下，只保留最后一个非函数响应 user 消息及之后的思考内容和签名
     * - 如果启用 sendHistoryThoughts，则保留所有历史思考内容
     * - 如果启用 sendHistoryThoughtSignatures，则保留所有历史思考签名（按渠道类型过滤）
     *
     * @param conversationId 对话 ID
     * @param options 选项对象（向后兼容：如果传入 boolean，视为 includeThoughts）
     * @returns 格式化的对话历史，移除了 token 计数字段
     *
     * @example
     * // 不含思考（用于常规 API 调用）
     * const history = await manager.getHistoryForAPI('chat-001');
     *
     * // 含思考（用于带思考的 API 调用，如 Gemini 3）
     * const historyWithThoughts = await manager.getHistoryForAPI('chat-001', { includeThoughts: true });
     *
     * // 发送所有历史思考签名（Gemini 格式）
     * const historyWithSignatures = await manager.getHistoryForAPI('chat-001', {
     *     includeThoughts: true,
     *     sendHistoryThoughtSignatures: true,
     *     channelType: 'gemini'
     * });
     */
    async getHistoryForAPI(
        conversationId: string,
        options: GetHistoryOptions | boolean = false
    ): Promise<ConversationHistory> {
        // 向后兼容：如果传入 boolean，视为 includeThoughts
        const opts: GetHistoryOptions = typeof options === 'boolean'
            ? { includeThoughts: options }
            : options;
        const history = await this.loadHistory(conversationId);
        return buildHistoryForApi(history, opts);
    }

    // ==================== 元数据管理 ====================

    /**
     * 设置对话标题
     */
    async setTitle(conversationId: string, title: string): Promise<void> {
        let meta = await this.storage.loadMetadata(conversationId);
        if (!meta) {
            meta = {
                id: conversationId,
                title,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                custom: {}
            };
        } else {
            meta.title = title;
            meta.updatedAt = Date.now();
        }
        await this.storage.saveMetadata(meta);
    }

    /**
     * 设置工作区 URI
     */
    async setWorkspaceUri(conversationId: string, workspaceUri: string): Promise<void> {
        let meta = await this.storage.loadMetadata(conversationId);
        if (!meta) {
            meta = {
                id: conversationId,
                title: t('modules.conversation.defaultTitle', { conversationId }),
                createdAt: Date.now(),
                updatedAt: Date.now(),
                workspaceUri,
                custom: {}
            };
        } else {
            meta.workspaceUri = workspaceUri;
            meta.updatedAt = Date.now();
        }
        await this.storage.saveMetadata(meta);
    }

    /**
     * 获取对话元数据
     */
    async getMetadata(conversationId: string): Promise<ConversationMetadata | null> {
        const meta = await this.storage.loadMetadata(conversationId);
        return meta ? JSON.parse(JSON.stringify(meta)) : null;
    }

    /**
     * 设置自定义元数据
     */
    async setCustomMetadata(
        conversationId: string,
        key: string,
        value: unknown
    ): Promise<void> {
        let meta = await this.storage.loadMetadata(conversationId);
        if (!meta) {
            meta = {
                id: conversationId,
                title: t('modules.conversation.defaultTitle', { conversationId }),
                createdAt: Date.now(),
                updatedAt: Date.now(),
                custom: {}
            };
        }
        
        if (!meta.custom) {
            meta.custom = {};
        }
        meta.custom[key] = value;
        meta.updatedAt = Date.now();
        
        await this.storage.saveMetadata(meta);
    }

    /**
     * 获取自定义元数据
     */
    async getCustomMetadata(conversationId: string, key: string): Promise<unknown> {
        const meta = await this.getMetadata(conversationId);
        return meta?.custom?.[key];
    }

    // ==================== 工具调用管理 ====================

    /**
     * 标记指定消息中的工具调用为拒绝状态
     *
     * 当用户在等待工具确认时点击终止按钮，需要将等待中的工具标记为拒绝
     * 这样在重新加载对话时可以正确显示工具状态
     *
     * @param conversationId 对话 ID
     * @param messageIndex 消息索引
     * @param toolCallIds 要标记为拒绝的工具调用 ID 列表（如果为空，则标记所有未执行的工具）
     */
    async rejectToolCalls(
        conversationId: string,
        messageIndex: number,
        toolCallIds?: string[]
    ): Promise<void> {
        const history = await this.loadHistory(conversationId);
        
        if (messageIndex < 0 || messageIndex >= history.length) {
            throw new Error(t('modules.conversation.errors.messageIndexOutOfBounds', { index: messageIndex }));
        }
        
        const message = history[messageIndex];
        let modified = false;
        
        // 收集所有已有响应的工具 ID
        const respondedToolIds = new Set<string>();
        for (let i = messageIndex + 1; i < history.length; i++) {
            const msg = history[i];
            for (const part of msg.parts) {
                if (part.functionResponse?.id) {
                    respondedToolIds.add(part.functionResponse.id);
                }
            }
        }
        
        // 标记工具为拒绝状态
        for (const part of message.parts) {
            if (part.functionCall && part.functionCall.id) {
                // 检查是否需要标记此工具
                const shouldReject = toolCallIds
                    ? toolCallIds.includes(part.functionCall.id)
                    : !respondedToolIds.has(part.functionCall.id);
                
                if (shouldReject && !part.functionCall.rejected) {
                    part.functionCall.rejected = true;
                    modified = true;
                }
            }
        }
        
        if (modified) {
            await this.storage.saveHistory(conversationId, history);
        }
    }
}
