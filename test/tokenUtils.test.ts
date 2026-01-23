import { describe, expect, it } from 'vitest';

import {
  batchSetTokenCounts,
  calculateHistoryTokens,
  createMessageWithTokens,
  formatTokenCount,
  getTokenEfficiency,
  getTotalTokens,
  hasTokenCounts,
  setMessageTokens,
} from '../backend/modules/conversation/tokenUtils';

describe('tokenUtils', () => {
  it('setMessageTokens does not mutate the original message', () => {
    const original = { role: 'model', parts: [{ text: 'hi' }] } as any;
    const updated = setMessageTokens(original, 10, 2);
    expect(updated).not.toBe(original);
    expect(original.thoughtsTokenCount).toBeUndefined();
    expect(updated.thoughtsTokenCount).toBe(10);
    expect(updated.candidatesTokenCount).toBe(2);
  });

  it('treats 0 token counts as present', () => {
    const msg = createMessageWithTokens('model', [], 0, 0);
    expect(hasTokenCounts(msg)).toBe(true);
    expect(getTotalTokens(msg)).toBe(0);
  });

  it('creates messages with optional token counts', () => {
    const msg = createMessageWithTokens('model', [{ text: 'x' }], 5, 1);
    expect(msg.role).toBe('model');
    expect(getTotalTokens(msg)).toBe(6);
    expect(hasTokenCounts(msg)).toBe(true);
  });

  it('calculates history token totals', () => {
    const history = [
      createMessageWithTokens('user', [{ text: 'q' }]),
      createMessageWithTokens('model', [{ text: 'a' }], 100, 10),
      createMessageWithTokens('model', [{ text: 'b' }], undefined, 3),
    ];
    expect(calculateHistoryTokens(history)).toEqual({
      totalThoughtsTokens: 100,
      totalCandidatesTokens: 13,
      totalTokens: 113,
      messagesWithTokens: 2,
    });
  });

  it('batchSetTokenCounts enforces equal lengths', () => {
    expect(() => batchSetTokenCounts([], [{ candidatesTokenCount: 1 }])).toThrow(
      'History and tokenCounts arrays must have the same length'
    );
  });

  it('batchSetTokenCounts returns updated copies and preserves originals', () => {
    const history = [createMessageWithTokens('model', [{ text: 'a' }]), createMessageWithTokens('model', [{ text: 'b' }])];
    const updated = batchSetTokenCounts(history, [{ thoughtsTokenCount: 1 }, { candidatesTokenCount: 2 }]);

    expect(updated).not.toBe(history);
    expect(updated[0]).not.toBe(history[0]);
    expect(updated[1]).not.toBe(history[1]);
    expect((history[0] as any).thoughtsTokenCount).toBeUndefined();
    expect((history[1] as any).candidatesTokenCount).toBeUndefined();
    expect((updated[0] as any).thoughtsTokenCount).toBe(1);
    expect((updated[1] as any).candidatesTokenCount).toBe(2);
  });

  it('computes token efficiency', () => {
    expect(getTokenEfficiency(createMessageWithTokens('model', [], 10, 2))).toBeCloseTo(2 / 12);
    expect(getTokenEfficiency(createMessageWithTokens('model', [], 10))).toBeNull();
  });

  it('returns null token efficiency when total is 0', () => {
    expect(getTokenEfficiency(createMessageWithTokens('model', [], undefined, 0))).toBeNull();
    expect(getTokenEfficiency(createMessageWithTokens('model', [], 0, 0))).toBeNull();
  });

  it('formats token counts', () => {
    expect(formatTokenCount(150)).toBe('150');
    expect(formatTokenCount(1500)).toBe('1.5K');
    expect(formatTokenCount(1500000)).toBe('1.5M');
  });

  it('formats token count boundaries', () => {
    expect(formatTokenCount(0)).toBe('0');
    expect(formatTokenCount(999)).toBe('999');
    expect(formatTokenCount(1000)).toBe('1.0K');
    expect(formatTokenCount(1000000)).toBe('1.0M');
  });
});
