import { describe, expect, it } from 'vitest';

import { ConversationManager } from '../backend/modules/conversation/ConversationManager';
import {
  MemoryStorageAdapter,
  type IStorageAdapter,
} from '../backend/modules/conversation/storage';
import type {
  ConversationHistory,
  ConversationMetadata,
  HistorySnapshot,
} from '../backend/modules/conversation/types';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class DelayedMemoryStorageAdapter extends MemoryStorageAdapter implements IStorageAdapter {
  constructor(private readonly delayMs = 5) {
    super();
  }

  async saveHistory(conversationId: string, history: ConversationHistory): Promise<void> {
    await delay(this.delayMs);
    await super.saveHistory(conversationId, history);
  }

  async loadHistory(conversationId: string): Promise<ConversationHistory | null> {
    await delay(this.delayMs);
    return await super.loadHistory(conversationId);
  }

  async saveMetadata(metadata: ConversationMetadata): Promise<void> {
    await delay(this.delayMs);
    await super.saveMetadata(metadata);
  }

  async loadMetadata(conversationId: string): Promise<ConversationMetadata | null> {
    await delay(this.delayMs);
    return await super.loadMetadata(conversationId);
  }

  async saveSnapshot(snapshot: HistorySnapshot): Promise<void> {
    await delay(this.delayMs);
    await super.saveSnapshot(snapshot);
  }

  async loadSnapshot(snapshotId: string): Promise<HistorySnapshot | null> {
    await delay(this.delayMs);
    return await super.loadSnapshot(snapshotId);
  }
}

describe('ConversationManager same-conversation concurrency', () => {
  it('keeps concurrent history appends lossless', async () => {
    const manager = new ConversationManager(new DelayedMemoryStorageAdapter());
    const conversationId = 'concurrent-history';

    await manager.createConversation(conversationId);

    await Promise.all([
      manager.addMessage(conversationId, 'user', [{ text: 'first' }]),
      manager.addMessage(conversationId, 'user', [{ text: 'second' }]),
      manager.addMessage(conversationId, 'user', [{ text: 'third' }]),
    ]);

    const history = await manager.getHistory(conversationId);
    const texts = history.map((message) => message.parts[0]?.text).sort();

    expect(history).toHaveLength(3);
    expect(texts).toEqual(['first', 'second', 'third']);
  });

  it('preserves unrelated metadata keys across concurrent updates', async () => {
    const manager = new ConversationManager(new DelayedMemoryStorageAdapter());
    const conversationId = 'concurrent-metadata';

    await manager.createConversation(conversationId, 'initial title');
    const before = await manager.getMetadata(conversationId);

    await Promise.all([
      manager.setTitle(conversationId, 'updated title'),
      manager.setWorkspaceUri(conversationId, 'file:///workspace'),
      manager.setCustomMetadata(conversationId, 'language', 'ts'),
    ]);

    const metadata = await manager.getMetadata(conversationId);

    expect(metadata).not.toBeNull();
    expect(metadata?.title).toBe('updated title');
    expect(metadata?.workspaceUri).toBe('file:///workspace');
    expect(metadata?.custom).toMatchObject({ language: 'ts' });
    expect(metadata?.createdAt).toBe(before?.createdAt);
  });

  it('changes only metadata when renaming a conversation', async () => {
    const manager = new ConversationManager(new MemoryStorageAdapter());
    const conversationId = 'metadata-only-title';

    await manager.createConversation(conversationId, 'initial title');
    await manager.addMessage(conversationId, 'user', [{ text: 'original message' }]);
    const historyBeforeRename = await manager.getHistory(conversationId);

    await manager.setTitle(conversationId, 'renamed title');

    expect(await manager.getMetadata(conversationId)).toMatchObject({ title: 'renamed title' });
    expect(await manager.getHistory(conversationId)).toEqual(historyBeforeRename);
  });
});
