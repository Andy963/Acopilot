import { t } from '../../i18n';
import { serializeConversationOperation } from './conversationLock';
import type { IStorageAdapter } from './storage';
import type { ConversationMetadata } from './types';

function cloneMetadata(metadata: ConversationMetadata): ConversationMetadata {
  return JSON.parse(JSON.stringify(metadata));
}

export function createConversationMetadata(
  conversationId: string,
  title?: string,
  workspaceUri?: string
): ConversationMetadata {
  const now = Date.now();
  return {
    id: conversationId,
    title: title || t('modules.conversation.defaultTitle', { conversationId }),
    createdAt: now,
    updatedAt: now,
    workspaceUri,
    custom: {}
  };
}

export class ConversationMetadataStore {
  constructor(private readonly storage: IStorageAdapter) {}

  async createWithinConversationLock(
    conversationId: string,
    title?: string,
    workspaceUri?: string
  ): Promise<ConversationMetadata> {
    const metadata = createConversationMetadata(conversationId, title, workspaceUri);
    await this.storage.saveMetadata(metadata);
    return cloneMetadata(metadata);
  }

  async get(conversationId: string): Promise<ConversationMetadata | null> {
    const metadata = await this.storage.loadMetadata(conversationId);
    return metadata ? cloneMetadata(metadata) : null;
  }

  async getCustom(conversationId: string, key: string): Promise<unknown> {
    const metadata = await this.get(conversationId);
    return metadata?.custom?.[key];
  }

  async setTitle(conversationId: string, title: string): Promise<void> {
    await this.mutateExistingConversationMetadata(conversationId, (metadata) => {
      metadata.title = title;
    });
  }

  async setWorkspaceUri(conversationId: string, workspaceUri: string): Promise<void> {
    await this.mutateExistingConversationMetadata(conversationId, (metadata) => {
      metadata.workspaceUri = workspaceUri;
    });
  }

  async setCustom(conversationId: string, key: string, value: unknown): Promise<void> {
    await this.mutateExistingConversationMetadata(conversationId, (metadata) => {
      if (!metadata.custom) {
        metadata.custom = {};
      }

      metadata.custom[key] = value;
    });
  }

  async touchExistingWithinConversationLock(conversationId: string): Promise<void> {
    const metadata = await this.storage.loadMetadata(conversationId);
    if (!metadata) {
      return;
    }

    metadata.updatedAt = Date.now();
    await this.storage.saveMetadata(metadata);
  }

  private async mutateExistingConversationMetadata(
    conversationId: string,
    mutate: (metadata: ConversationMetadata) => void | Promise<void>
  ): Promise<void> {
    await serializeConversationOperation(this.storage, conversationId, async () => {
      const metadata = await this.loadOrCreateForExistingConversationWithinLock(conversationId);
      await mutate(metadata);
      metadata.updatedAt = Date.now();
      await this.storage.saveMetadata(metadata);
    });
  }

  private async loadOrCreateForExistingConversationWithinLock(
    conversationId: string
  ): Promise<ConversationMetadata> {
    const existingMetadata = await this.storage.loadMetadata(conversationId);
    if (existingMetadata) {
      return existingMetadata;
    }

    const existingHistory = await this.storage.loadHistory(conversationId);
    if (!existingHistory) {
      throw new Error(t('modules.conversation.errors.conversationNotFound', { conversationId }));
    }

    const metadata = createConversationMetadata(conversationId);
    await this.storage.saveMetadata(metadata);
    return metadata;
  }
}

