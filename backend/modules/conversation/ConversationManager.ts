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
import { computeConversationStats, findMessagesInHistory, rejectToolCallsInHistory } from './conversationAnalysis';
import {
    getConversationCustomMetadata,
    getConversationMetadata,
    setConversationCustomMetadata,
    setConversationTitle,
    setConversationWorkspaceUri
} from './conversationMetadata';

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
        return findMessagesInHistory(history, filter);
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
        return computeConversationStats(history);
    }

    /**
     * 获取适合 API 调用的历史记录（剔除内部字段，可按策略保留思考内容/签名）。
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
        await setConversationTitle(this.storage, conversationId, title);
    }

    /**
     * 设置工作区 URI
     */
    async setWorkspaceUri(conversationId: string, workspaceUri: string): Promise<void> {
        await setConversationWorkspaceUri(this.storage, conversationId, workspaceUri);
    }

    /**
     * 获取对话元数据
     */
    async getMetadata(conversationId: string): Promise<ConversationMetadata | null> {
        return await getConversationMetadata(this.storage, conversationId);
    }

    /**
     * 设置自定义元数据
     */
    async setCustomMetadata(
        conversationId: string,
        key: string,
        value: unknown
    ): Promise<void> {
        await setConversationCustomMetadata(this.storage, conversationId, key, value);
    }

    /**
     * 获取自定义元数据
     */
    async getCustomMetadata(conversationId: string, key: string): Promise<unknown> {
        return await getConversationCustomMetadata(this.storage, conversationId, key);
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
        const modified = rejectToolCallsInHistory({
            history,
            conversationId,
            messageIndex,
            toolCallIds
        });

        if (modified) {
            await this.storage.saveHistory(conversationId, history);
        }
    }
}
