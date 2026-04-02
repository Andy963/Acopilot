import { t } from '../../i18n';

import { serializeConversationOperation } from './conversationLock';
import { cloneConversationHistory } from './conversationHistoryMutations';
import type { IStorageAdapter } from './storage';
import type { ConversationHistory, HistorySnapshot } from './types';
import type { ConversationMetadataStore } from './conversationMetadata';

export class ConversationPersistence {
    constructor(
        private readonly storage: IStorageAdapter,
        private readonly metadataStore: ConversationMetadataStore
    ) {}

    async withConversationLock<T>(
        conversationId: string,
        operation: () => Promise<T>
    ): Promise<T> {
        return await serializeConversationOperation(this.storage, conversationId, operation);
    }

    async createConversation(
        conversationId: string,
        title?: string,
        workspaceUri?: string
    ): Promise<void> {
        await this.withConversationLock(conversationId, async () => {
            const existingHistory = await this.loadHistoryWithinConversationLock(conversationId);
            if (existingHistory) {
                throw new Error(t('modules.conversation.errors.conversationExists', { conversationId }));
            }

            await this.storage.saveHistory(conversationId, []);
            await this.metadataStore.createWithinConversationLock(conversationId, title, workspaceUri);
        });
    }

    async deleteConversation(conversationId: string): Promise<void> {
        await this.withConversationLock(conversationId, async () => {
            await this.storage.deleteHistory(conversationId);
        });
    }

    async listConversations(): Promise<string[]> {
        return await this.storage.listConversations();
    }

    async loadHistory(conversationId: string): Promise<ConversationHistory | null> {
        return await this.storage.loadHistory(conversationId);
    }

    async requireHistory(conversationId: string): Promise<ConversationHistory> {
        const history = await this.loadHistory(conversationId);
        if (!history) {
            throw new Error(t('modules.conversation.errors.conversationNotFound', { conversationId }));
        }

        return history;
    }

    async requireHistoryWithinConversationLock(conversationId: string): Promise<ConversationHistory> {
        const history = await this.loadHistoryWithinConversationLock(conversationId);
        if (!history) {
            throw new Error(t('modules.conversation.errors.conversationNotFound', { conversationId }));
        }

        return history;
    }

    async mutateHistory(
        conversationId: string,
        mutator: (history: ConversationHistory) => void | Promise<void>
    ): Promise<void> {
        await this.mutateHistoryWithResult(conversationId, async (history) => {
            await mutator(history);
        });
    }

    async mutateHistoryWithResult<T>(
        conversationId: string,
        mutator: (history: ConversationHistory) => T | Promise<T>
    ): Promise<T> {
        return await this.withConversationLock(conversationId, async () => {
            const history = await this.requireHistoryWithinConversationLock(conversationId);
            const result = await mutator(history);

            await this.saveHistoryWithinConversationLock(conversationId, history);
            return result;
        });
    }

    async saveHistoryWithinConversationLock(
        conversationId: string,
        history: ConversationHistory
    ): Promise<void> {
        await this.storage.saveHistory(conversationId, history);
        await this.metadataStore.touchExistingWithinConversationLock(conversationId);
    }

    async createSnapshot(
        conversationId: string,
        name?: string,
        description?: string
    ): Promise<HistorySnapshot> {
        const history = await this.requireHistory(conversationId);
        const timestamp = Date.now();

        const snapshot: HistorySnapshot = {
            id: `snapshot_${conversationId}_${timestamp}`,
            conversationId,
            name,
            description,
            timestamp,
            history: cloneConversationHistory(history)
        };

        await this.storage.saveSnapshot(snapshot);
        return snapshot;
    }

    async restoreSnapshot(conversationId: string, snapshotId: string): Promise<void> {
        await this.withConversationLock(conversationId, async () => {
            const snapshot = await this.storage.loadSnapshot(snapshotId);
            if (!snapshot) {
                throw new Error(t('modules.conversation.errors.snapshotNotFound', { snapshotId }));
            }

            if (snapshot.conversationId !== conversationId) {
                throw new Error(t('modules.conversation.errors.snapshotNotBelongToConversation'));
            }

            await this.saveHistoryWithinConversationLock(conversationId, snapshot.history);
        });
    }

    async deleteSnapshot(snapshotId: string): Promise<void> {
        await this.storage.deleteSnapshot(snapshotId);
    }

    async listSnapshots(conversationId: string): Promise<string[]> {
        return await this.storage.listSnapshots(conversationId);
    }

    private async loadHistoryWithinConversationLock(conversationId: string): Promise<ConversationHistory | null> {
        return await this.storage.loadHistory(conversationId);
    }
}
