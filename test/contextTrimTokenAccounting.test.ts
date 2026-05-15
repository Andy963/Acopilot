import { describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [],
    textDocuments: [],
  },
  window: {
    activeTextEditor: undefined,
    visibleTextEditors: [],
    tabGroups: { all: [] },
  },
  languages: {
    getDiagnostics: () => [],
  },
  env: {
    language: 'en',
  },
  TabInputText: class TabInputText {},
}));

import { ConversationManager } from '../backend/modules/conversation/ConversationManager';
import { MemoryStorageAdapter } from '../backend/modules/conversation/storage';
import { PromptManager } from '../backend/modules/prompt';
import { TokenCountService } from '../backend/modules/channel/TokenCountService';
import { ContextTrimService } from '../backend/modules/api/chat/services/ContextTrimService';
import { MessageBuilderService } from '../backend/modules/api/chat/services/MessageBuilderService';
import { TokenEstimationService } from '../backend/modules/api/chat/services/TokenEstimationService';
import type { BaseChannelConfig } from '../backend/modules/config/configs/base';

function createService(conversationManager: ConversationManager): ContextTrimService {
  const tokenEstimationService = new TokenEstimationService(
    conversationManager,
    new TokenCountService()
  );
  return new ContextTrimService(
    conversationManager,
    new PromptManager({ includeWorkspaceFiles: false }),
    tokenEstimationService,
    new MessageBuilderService()
  );
}

describe('ContextTrimService token accounting', () => {
  it('counts model message content instead of trusting underreported usage metadata', async () => {
    const conversationManager = new ConversationManager(new MemoryStorageAdapter());
    await conversationManager.createConversation('conv');

    const longAssistantText = 'x'.repeat(4000);
    await conversationManager.addBatch('conv', [
      { role: 'user', parts: [{ text: 'first question' }] },
      {
        role: 'model',
        parts: [{ text: longAssistantText }],
        usageMetadata: {
          candidatesTokenCount: 1,
          totalTokenCount: 2,
        },
      },
      { role: 'user', parts: [{ text: 'next question' }] },
    ]);

    const result = await createService(conversationManager).getHistoryWithContextTrimInfo(
      'conv',
      {
        type: 'openai',
        contextThresholdEnabled: false,
        maxContextTokens: 10000,
      } as BaseChannelConfig,
      { channelType: 'openai' }
    );

    expect(result.estimatedTotalTokens).toBeGreaterThanOrEqual(1000);
  });

  it('triggers trim when assistant content exceeds the context threshold', async () => {
    const conversationManager = new ConversationManager(new MemoryStorageAdapter());
    await conversationManager.createConversation('conv');

    await conversationManager.addBatch('conv', [
      { role: 'user', parts: [{ text: 'first question' }] },
      {
        role: 'model',
        parts: [{ text: 'x'.repeat(4000) }],
        usageMetadata: {
          candidatesTokenCount: 1,
          totalTokenCount: 2,
        },
      },
      { role: 'user', parts: [{ text: 'second question' }] },
      {
        role: 'model',
        parts: [{ functionCall: { name: 'read_file', args: { path: 'a'.repeat(2000) } } }],
        usageMetadata: {
          candidatesTokenCount: 1,
          totalTokenCount: 3,
        },
      },
      { role: 'user', parts: [{ text: 'third question' }] },
    ]);

    const result = await createService(conversationManager).getHistoryWithContextTrimInfo(
      'conv',
      {
        type: 'openai',
        contextThresholdEnabled: true,
        contextThreshold: '50%',
        maxContextTokens: 2000,
      } as BaseChannelConfig,
      { channelType: 'openai' }
    );

    expect(result.estimatedTotalTokens).toBeGreaterThan(1000);
    expect(result.trimStartIndex).toBeGreaterThan(0);
    expect(result.history[0].role).toBe('user');
  });
});
