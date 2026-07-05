import { describe, expect, it, vi } from 'vitest';

import { ConversationManager } from '../backend/modules/conversation/ConversationManager';
import { MemoryStorageAdapter } from '../backend/modules/conversation/storage';
import { deleteConversation as deleteConversationHandler } from '../webview/handlers/ConversationHandlers';

describe('Conversation deletion terminality', () => {
  it('does not silently recreate a deleted conversation through read or metadata paths', async () => {
    const storage = new MemoryStorageAdapter();
    const manager = new ConversationManager(storage);
    const conversationId = 'deleted-conversation';

    await manager.createConversation(conversationId);
    await manager.addMessage(conversationId, 'user', [{ text: 'hello' }]);
    await manager.deleteConversation(conversationId);

    await expect(manager.getHistory(conversationId)).rejects.toThrow(conversationId);
    await expect(manager.getHistoryRef(conversationId)).rejects.toThrow(conversationId);
    await expect(manager.getMessages(conversationId)).rejects.toThrow(conversationId);
    await expect(manager.deleteToMessage(conversationId, 0)).rejects.toThrow(conversationId);
    await expect(manager.rejectToolCalls(conversationId, 0)).rejects.toThrow(conversationId);
    await expect(manager.setCustomMetadata(conversationId, 'updatedAt', Date.now())).rejects.toThrow(
      conversationId,
    );

    await expect(manager.getMetadata(conversationId)).resolves.toBeNull();
    await expect(manager.listConversations()).resolves.toEqual([]);
  });
});

describe('conversation.deleteConversation handler', () => {
  it('cleans up diffs, snapshots, checkpoints, and history before succeeding', async () => {
    const sequence: string[] = [];
    const sendResponse = vi.fn();

    const ctx = {
      diffStorageManager: {
        deleteConversationDiffs: vi.fn(async (conversationId: string) => {
          sequence.push(`diffs:${conversationId}`);
        }),
      },
      conversationManager: {
        listSnapshots: vi.fn(async (conversationId: string) => {
          sequence.push(`listSnapshots:${conversationId}`);
          return ['snapshot-1', 'snapshot-2'];
        }),
        deleteSnapshot: vi.fn(async (snapshotId: string) => {
          sequence.push(`snapshot:${snapshotId}`);
        }),
        deleteConversation: vi.fn(async (conversationId: string) => {
          sequence.push(`conversation:${conversationId}`);
        }),
      },
      checkpointManager: {
        deleteAllCheckpoints: vi.fn(async (conversationId: string) => {
          sequence.push(`checkpoints:${conversationId}`);
        }),
      },
      sendResponse,
    } as any;

    await deleteConversationHandler({ conversationId: 'conv-1' }, 'req-1', ctx);

    expect(sequence).toEqual([
      'diffs:conv-1',
      'listSnapshots:conv-1',
      'snapshot:snapshot-1',
      'snapshot:snapshot-2',
      'checkpoints:conv-1',
      'conversation:conv-1',
    ]);
    expect(sendResponse).toHaveBeenCalledWith('req-1', { success: true });
  });
});
