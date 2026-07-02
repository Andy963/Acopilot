import { describe, expect, it } from 'vitest';

import { estimateTextTokens } from '../backend/modules/api/chat/services/TokenEstimationService';

describe('estimateTextTokens', () => {
  it('returns 0 for empty input', () => {
    expect(estimateTextTokens('')).toBe(0);
  });

  it('estimates pure ASCII text at ~4 characters per token (unchanged from the old heuristic)', () => {
    const text = 'a'.repeat(400);
    expect(estimateTextTokens(text)).toBe(100);
  });

  it('estimates pure Chinese text at a much denser ratio than the ASCII heuristic', () => {
    const text = '你'.repeat(180);
    const naiveAsciiEstimate = Math.ceil(text.length / 4);

    const result = estimateTextTokens(text);

    expect(result).toBe(100);
    // The old "4 chars = 1 token" formula undercounts Chinese text by several times;
    // the fix must estimate noticeably higher for the same character count.
    expect(result).toBeGreaterThan(naiveAsciiEstimate * 2);
  });

  it('estimates mixed CJK + ASCII text as the sum of each character class', () => {
    const cjk = '你好世界'; // 4 CJK characters
    const ascii = 'hello world'; // 11 ASCII characters

    const result = estimateTextTokens(cjk + ascii);

    expect(result).toBe(Math.ceil(4 / 1.8 + 11 / 4));
  });

  it('treats Japanese Kana and Korean Hangul the same as Chinese Han characters', () => {
    const kana = estimateTextTokens('ひらがな'.repeat(50));
    const hangul = estimateTextTokens('안녕하세요'.repeat(50));
    const naiveAsciiEstimate = Math.ceil(('ひらがな'.repeat(50)).length / 4);

    expect(kana).toBeGreaterThan(naiveAsciiEstimate);
    expect(hangul).toBeGreaterThan(0);
  });
});
