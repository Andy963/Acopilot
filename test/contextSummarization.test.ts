import { describe, expect, it, vi } from 'vitest';

vi.mock('vue', () => ({
  computed: (fn: () => unknown) => ({
    get value() {
      return fn();
    },
  }),
}));

import { SummarizeService } from '../backend/modules/api/chat/services/SummarizeService';
import {
  identifyConversationRounds,
  isConversationRoundStart,
} from '../backend/modules/api/chat/services/contextTrim/utils';
import type { BaseChannelConfig } from '../backend/modules/config/configs/base';
import type { Content } from '../backend/modules/conversation/types';
import { createChatComputed } from '../frontend/src/stores/chat/computed';
import type { ChatStoreState } from '../frontend/src/stores/chat/types';

function ref<T>(value: T): { value: T } {
  return { value };
}

function user(text: string, extra: Partial<Content> = {}): Content {
  return { role: 'user', parts: [{ text }], ...extra };
}

function model(text: string): Content {
  return { role: 'model', parts: [{ text }] };
}

function makeSummarizeService(history: Content[]) {
  const config: BaseChannelConfig = {
    id: 'cfg',
    name: 'Test',
    type: 'openai',
    enabled: true,
    createdAt: 1,
    updatedAt: 1,
  } as BaseChannelConfig;

  const generatedHistories: Content[][] = [];

  const configManager = {
    getConfig: vi.fn(async () => config),
  };
  const channelManager = {
    generate: vi.fn(async ({ history: requestHistory }: { history: Content[] }) => {
      generatedHistories.push(requestHistory);
      return {
        content: {
          role: 'model',
          parts: [{ text: 'updated summary' }],
          usageMetadata: {
            promptTokenCount: 100,
            candidatesTokenCount: 10,
          },
        },
      };
    }),
  };
  const conversationManager = {
    getHistory: vi.fn(async () => JSON.parse(JSON.stringify(history))),
    getHistoryRef: vi.fn(async () => history),
    deleteMessage: vi.fn(async (_conversationId: string, index: number) => {
      history.splice(index, 1);
    }),
    insertContent: vi.fn(async (_conversationId: string, index: number, content: Content) => {
      history.splice(index, 0, JSON.parse(JSON.stringify(content)));
    }),
  };
  const contextTrimService = {
    findLastSummaryIndex: (items: Content[]) => {
      for (let i = items.length - 1; i >= 0; i--) {
        if (items[i].isSummary) return i;
      }
      return -1;
    },
    identifyRounds: identifyConversationRounds,
  };
  const settingsManager = {
    getSummarizeConfig: () => ({
      autoSummarize: true,
      autoSummarizeThreshold: 80,
      summarizePrompt: 'Summarize this conversation.',
      keepRecentRounds: 1,
      useSeparateModel: false,
      summarizeChannelId: '',
      summarizeModelId: '',
    }),
  };

  const service = new SummarizeService(
    configManager as any,
    channelManager as any,
    conversationManager as any,
    contextTrimService as any,
    settingsManager as any
  );

  return { service, history, generatedHistories, conversationManager };
}

describe('context summarization', () => {
  it('does not count summary messages as conversation round starts', () => {
    const summary = user('summary', { isSummary: true });
    expect(isConversationRoundStart(summary)).toBe(false);

    const rounds = identifyConversationRounds([
      summary,
      user('new question'),
      model('new answer'),
      user('latest question'),
    ]);

    expect(rounds).toEqual([
      { startIndex: 1, endIndex: 3, tokenCount: undefined },
      { startIndex: 3, endIndex: 4, tokenCount: undefined },
    ]);
  });

  it('summarizes only messages after the latest summary while carrying the previous summary forward', async () => {
    const history = [
      user('old question'),
      model('old answer'),
      user('previous summary', { isSummary: true, summarizedMessageCount: 2 }),
      user('new question 1'),
      model('new answer 1'),
      user('new question 2'),
      model('new answer 2'),
      user('latest question'),
    ];
    const { service, generatedHistories, conversationManager } = makeSummarizeService(history);

    const result = await service.handleSummarizeContext({
      conversationId: 'conv',
      configId: 'cfg',
    });

    expect(result.success).toBe(true);
    expect(result.summarizedMessageCount).toBe(4);

    const summarizeRequest = generatedHistories[0];
    expect(summarizeRequest.map((message) => message.parts[0]?.text)).toEqual([
      'previous summary',
      'new question 1',
      'new answer 1',
      'new question 2',
      'new answer 2',
      'Summarize this conversation.',
    ]);

    expect(conversationManager.deleteMessage).not.toHaveBeenCalled();
    expect(conversationManager.insertContent).toHaveBeenCalledWith(
      'conv',
      7,
      expect.objectContaining({
        isSummary: true,
        summarizedMessageCount: 4,
      })
    );
  });

  it('preserves explicit zero values in token usage computed values', () => {
    const state = {
      conversations: ref([]),
      currentConversationId: ref(null),
      allMessages: ref([
        {
          id: 'm1',
          role: 'assistant',
          content: '',
          timestamp: 1,
          metadata: {
            usageMetadata: {
              totalTokenCount: 0,
              promptTokenCount: 0,
            },
          },
        },
      ]),
      configId: ref('cfg'),
      currentConfig: ref({
        id: 'cfg',
        name: 'Config',
        model: 'model',
        type: 'openai',
        maxContextTokens: 0,
      }),
      isLoading: ref(false),
      isStreaming: ref(false),
      isWaitingForResponse: ref(false),
      error: ref(null),
      retryStatus: ref(null),
      workspaceFilter: ref('all'),
      currentWorkspaceUri: ref(null),
    } as unknown as ChatStoreState;

    const computedValues = createChatComputed(state);

    expect(computedValues.maxContextTokens.value).toBe(0);
    expect(computedValues.usedTokens.value).toBe(0);
    expect(computedValues.tokenUsagePercent.value).toBe(0);
  });
});
