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
    addBatchToHistory,
    addContentToHistory,
    addMessageToHistory,
    cloneConversationContent,
    cloneConversationHistory,
    deleteMessageFromHistory,
    deleteMessagesInRangeFromHistory,
    deleteToMessageInHistory,
    getMessageAt,
    getMessagesWithIndex,
    insertContentIntoHistory,
    insertMessageIntoHistory,
    updateMessageInHistory
} from './conversationHistoryMutations';
import { ConversationMetadataStore } from './conversationMetadata';
import { ConversationPersistence } from './conversationPersistence';

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
    private readonly metadataStore: ConversationMetadataStore;
    private readonly persistence: ConversationPersistence;

    constructor(storage: IStorageAdapter) {
        this.metadataStore = new ConversationMetadataStore(storage);
        this.persistence = new ConversationPersistence(storage, this.metadataStore);
    }

    // ==================== 对话管理 ====================

    /**
     * 创建新对话
     * @param conversationId 对话 ID
     * @param title 对话标题
     * @param workspaceUri 工作区 URI（可选）
     */
    async createConversation(conversationId: string, title?: string, workspaceUri?: string): Promise<void> {
        await this.persistence.createConversation(conversationId, title, workspaceUri);
    }

    /**
     * 删除对话
     */
    async deleteConversation(conversationId: string): Promise<void> {
        await this.persistence.deleteConversation(conversationId);
    }

    /**
     * 列出所有对话
     */
    async listConversations(): Promise<string[]> {
        return await this.persistence.listConversations();
    }

    /**
     * 加载对话历史（直接从存储读取）
     */
    private async loadHistory(conversationId: string): Promise<ConversationHistory> {
        return await this.persistence.requireHistory(conversationId);
    }

    /**
     * 获取对话历史的只读副本
     */
    async getHistory(conversationId: string): Promise<Readonly<ConversationHistory>> {
        return cloneConversationHistory(await this.loadHistory(conversationId));
    }

    /**
     * 获取对话历史的引用（用于直接发送给 API）
     * 注意: 每次调用都从存储读取最新数据
     */
    async getHistoryRef(conversationId: string): Promise<ConversationHistory> {
        return await this.persistence.requireHistory(conversationId);
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
        await this.persistence.mutateHistory(conversationId, (history) => {
            addMessageToHistory(history, role, parts);
        });
    }

    /**
     * 添加完整的 Content 对象
     */
    async addContent(conversationId: string, content: Content): Promise<void> {
        await this.persistence.mutateHistory(conversationId, (history) => {
            addContentToHistory(history, content);
        });
    }

    /**
     * 批量添加消息
     */
    async addBatch(conversationId: string, contents: Content[]): Promise<void> {
        await this.persistence.mutateHistory(conversationId, (history) => {
            addBatchToHistory(history, contents);
        });
    }

    /**
     * 获取所有消息
     *
     * 返回的每条消息都包含 index 字段，用于前端在删除/重试时直接使用
     * 每次调用都从存储读取最新数据
     */
    async getMessages(conversationId: string): Promise<Content[]> {
        return getMessagesWithIndex(await this.loadHistory(conversationId));
    }

    /**
     * 获取指定索引的消息
     */
    async getMessage(conversationId: string, index: number): Promise<Content | undefined> {
        return getMessageAt(await this.loadHistory(conversationId), index);
    }

    /**
     * 更新消息
     */
    async updateMessage(
        conversationId: string,
        messageIndex: number,
        updates: Partial<Content>
    ): Promise<void> {
        await this.persistence.mutateHistory(conversationId, (history) => {
            updateMessageInHistory(history, messageIndex, updates);
        });
    }

    /**
     * 删除消息
     */
    async deleteMessage(conversationId: string, messageIndex: number): Promise<void> {
        await this.persistence.mutateHistory(conversationId, (history) => {
            deleteMessageFromHistory(history, messageIndex);
        });
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
        await this.persistence.mutateHistory(conversationId, (history) => {
            insertMessageIntoHistory(history, position, role, parts);
        });
    }

    /**
     * 在指定位置插入完整的 Content 对象
     */
    async insertContent(
        conversationId: string,
        position: number,
        content: Content
    ): Promise<void> {
        await this.persistence.mutateHistory(conversationId, (history) => {
            insertContentIntoHistory(history, position, content);
        });
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
        await this.persistence.mutateHistory(conversationId, (history) => {
            deleteMessagesInRangeFromHistory(history, startIndex, endIndex);
        });
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
        return await this.persistence.mutateHistoryWithResult(conversationId, (history) => {
            return deleteToMessageInHistory(history, targetIndex);
        });
    }

    /**
     * 清空对话历史
     */
    async clearHistory(conversationId: string): Promise<void> {
        await this.persistence.mutateHistory(conversationId, (history) => {
            history.splice(0, history.length);
        });
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
            .map((message) => cloneConversationContent(message));
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
        return await this.persistence.createSnapshot(conversationId, name, description);
    }

    /**
     * 恢复快照
     */
    async restoreSnapshot(conversationId: string, snapshotId: string): Promise<void> {
        await this.persistence.restoreSnapshot(conversationId, snapshotId);
    }

    /**
     * 删除快照
     */
    async deleteSnapshot(snapshotId: string): Promise<void> {
        await this.persistence.deleteSnapshot(snapshotId);
    }

    /**
     * 列出对话的所有快照
     */
    async listSnapshots(conversationId: string): Promise<string[]> {
        return await this.persistence.listSnapshots(conversationId);
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
        await this.metadataStore.setTitle(conversationId, title);
    }

    /**
     * 设置工作区 URI
     */
    async setWorkspaceUri(conversationId: string, workspaceUri: string): Promise<void> {
        await this.metadataStore.setWorkspaceUri(conversationId, workspaceUri);
    }

    /**
     * 获取对话元数据
     */
    async getMetadata(conversationId: string): Promise<ConversationMetadata | null> {
        return await this.metadataStore.get(conversationId);
    }

    /**
     * 设置自定义元数据
     */
    async setCustomMetadata(
        conversationId: string,
        key: string,
        value: unknown
    ): Promise<void> {
        await this.metadataStore.setCustom(conversationId, key, value);
    }

    /**
     * 获取自定义元数据
     */
    async getCustomMetadata(conversationId: string, key: string): Promise<unknown> {
        return await this.metadataStore.getCustom(conversationId, key);
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
        await this.persistence.withConversationLock(conversationId, async () => {
            const history = await this.persistence.requireHistoryWithinConversationLock(conversationId);

            const modified = rejectToolCallsInHistory({
                history,
                conversationId,
                messageIndex,
                toolCallIds
            });

            if (modified) {
                await this.persistence.saveHistoryWithinConversationLock(conversationId, history);
            }
        });
    }
}
