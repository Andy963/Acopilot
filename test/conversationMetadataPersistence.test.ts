import { describe, expect, it, vi } from 'vitest';

import { ConversationManager } from '../backend/modules/conversation/ConversationManager';
import { MemoryStorageAdapter } from '../backend/modules/conversation/storage';

describe('Conversation persistence metadata boundaries', () => {
  it('updates metadata timestamps when history changes without relying on storage side effects', async () => {
    const nowValues = [1000, 2000, 3000];
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => nowValues.shift() ?? 3000);

    try {
      const manager = new ConversationManager(new MemoryStorageAdapter());
      const conversationId = 'metadata-updated-on-history-write';

      await manager.createConversation(conversationId, 'initial title');
      const before = await manager.getMetadata(conversationId);

      await manager.addMessage(conversationId, 'user', [{ text: 'hello' }]);

      const after = await manager.getMetadata(conversationId);

      expect(before?.createdAt).toBe(1000);
      expect(before?.updatedAt).toBe(1000);
      expect(after?.createdAt).toBe(1000);
      expect(after?.updatedAt).toBe(3000);
    } finally {
      nowSpy.mockRestore();
    }
  });
});
