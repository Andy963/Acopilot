import { describe, expect, it, vi } from 'vitest';

import { loadOpenAIResponsesState } from '../backend/modules/api/chat/services/toolIterationLoop/openaiResponsesState';

describe('loadOpenAIResponsesState', () => {
  it('keeps full trimmed history while still exposing previousResponseId', async () => {
    const history = [
      { role: 'user', parts: [{ text: 'u1' }] },
      { role: 'model', parts: [{ text: 'a1' }] },
      { role: 'user', parts: [{ text: 'u2' }] },
      { role: 'model', parts: [{ text: 'a2' }] },
    ] as any[];

    const getCustomMetadata = vi.fn(async (_conversationId: string, key: string) => {
      if (key === 'openaiResponsesContinuation') {
        return {
          configId: 'cfg-1',
          previousResponseId: 'resp-prev',
          lastSyncedHistoryLength: 2,
        };
      }
      return null;
    });

    const setCustomMetadata = vi.fn(async () => {});

    const result = await loadOpenAIResponsesState({
      deps: {
        conversationManager: {
          getCustomMetadata,
          setCustomMetadata,
        },
      } as any,
      conversationId: 'conv-1',
      configId: 'cfg-1',
      configType: 'openai-responses',
      fullHistory: history,
      history,
      trimStartIndex: 1,
    });

    expect(result.previousResponseId).toBe('resp-prev');
    expect(result.history).toBe(history);
    expect(result.history).toHaveLength(4);
    expect(setCustomMetadata).not.toHaveBeenCalledWith('conv-1', 'openaiResponsesContinuation', null);
  });

  it('clears impossible continuation state when synced length exceeds local history', async () => {
    const getCustomMetadata = vi.fn(async (_conversationId: string, key: string) => {
      if (key === 'openaiResponsesContinuation') {
        return {
          configId: 'cfg-1',
          previousResponseId: 'resp-prev',
          lastSyncedHistoryLength: 99,
        };
      }
      return null;
    });

    const setCustomMetadata = vi.fn(async () => {});

    const result = await loadOpenAIResponsesState({
      deps: {
        conversationManager: {
          getCustomMetadata,
          setCustomMetadata,
        },
      } as any,
      conversationId: 'conv-1',
      configId: 'cfg-1',
      configType: 'openai-responses',
      fullHistory: [{ role: 'user', parts: [{ text: 'u1' }] }] as any[],
      history: [{ role: 'user', parts: [{ text: 'u1' }] }] as any[],
      trimStartIndex: 0,
    });

    expect(result.previousResponseId).toBeUndefined();
    expect(setCustomMetadata).toHaveBeenCalledWith('conv-1', 'openaiResponsesContinuation', null);
    expect(setCustomMetadata).toHaveBeenCalledWith('conv-1', 'openaiResponsesPromptCacheKey', null);
  });
});
