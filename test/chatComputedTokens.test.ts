import { describe, expect, it, vi } from 'vitest';

vi.mock('vue', () => ({
  computed: (fn: () => unknown) => ({
    get value() {
      return fn();
    },
  }),
}));

import { createChatComputed } from '../frontend/src/stores/chat/computed';
import type { ChatStoreState } from '../frontend/src/stores/chat/types';

function ref<T>(value: T): { value: T } {
  return { value };
}

function createState(overrides: Partial<ChatStoreState>): ChatStoreState {
  return {
    conversations: ref([]),
    currentConversationId: ref(null),
    allMessages: ref([]),
    configId: ref('config'),
    currentConfig: ref({ id: 'config', name: 'Config', model: 'model', type: 'openai', maxContextTokens: 10000 }),
    isLoading: ref(false),
    isStreaming: ref(false),
    isLoadingConversations: ref(false),
    error: ref(null),
    streamingMessageId: ref(null),
    isWaitingForResponse: ref(false),
    retryStatus: ref(null),
    toolCallBuffer: ref(''),
    inToolCall: ref(null),
    checkpoints: ref([]),
    mergeUnchangedCheckpoints: ref(false),
    deletingConversationIds: ref(new Set()),
    currentWorkspaceUri: ref(null),
    inputValue: ref(''),
    workspaceFilter: ref('all'),
    chatMode: ref('agent'),
    pinnedPrompt: ref({ mode: 'none' }),
    pinnedPrompts: ref([]),
    selectionReferences: ref([]),
    planRunner: ref(null),
    postEditValidationPending: ref(false),
    contextInspectorVisible: ref(false),
    contextInspectorLoading: ref(false),
    contextInspectorData: ref(null),
    contextInspectorError: ref(null),
    contextInspectorSource: ref('preview'),
    ...overrides,
  } as ChatStoreState;
}

describe('chat computed token usage', () => {
  it('prefers real provider usage metadata over the pre-request context snapshot estimate', () => {
    // usageMetadata is the ground truth returned after the API call (same numbers shown
    // under each message's footer); the pre-request estimate must not shadow it.
    const state = createState({
      allMessages: ref([
        { id: 'user-1', role: 'user', content: 'hello', timestamp: 1 },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: 'hi',
          timestamp: 2,
          metadata: {
            usageMetadata: { totalTokenCount: 100 },
            contextSnapshot: {
              generatedAt: 1,
              configId: 'config',
              providerType: 'openai',
              model: 'model',
              estimatedTotalTokens: 9000,
            } as any,
          },
        },
      ]),
    });

    const computed = createChatComputed(state);

    expect(computed.usedTokens.value).toBe(100);
    expect(computed.tokenUsagePercent.value).toBe(1);
  });

  it('falls back to the context snapshot estimate while the message is still streaming', () => {
    // No usageMetadata yet (the request hasn't returned usage), so the ring should show
    // the pre-request estimate instead of silently reporting 0 / a stale earlier turn.
    const state = createState({
      allMessages: ref([
        { id: 'user-1', role: 'user', content: 'hello', timestamp: 1 },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: '',
          timestamp: 2,
          streaming: true,
          metadata: {
            contextSnapshot: {
              generatedAt: 1,
              configId: 'config',
              providerType: 'openai',
              model: 'model',
              estimatedTotalTokens: 4200,
            } as any,
          },
        },
      ]),
    });

    const computed = createChatComputed(state);

    expect(computed.usedTokens.value).toBe(4200);
  });

  it('skips a completed turn missing both usage and estimate and walks back to an earlier one', () => {
    const state = createState({
      allMessages: ref([
        { id: 'user-1', role: 'user', content: 'hello', timestamp: 1 },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: 'hi',
          timestamp: 2,
          metadata: {
            usageMetadata: { totalTokenCount: 500 },
          },
        },
        { id: 'user-2', role: 'user', content: 'follow up', timestamp: 3 },
        {
          id: 'assistant-2',
          role: 'assistant',
          content: '',
          timestamp: 4,
        },
      ]),
    });

    const computed = createChatComputed(state);

    expect(computed.usedTokens.value).toBe(500);
  });
});
