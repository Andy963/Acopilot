import { describe, expect, it } from 'vitest';

import { normalizeReplacementArg } from '../backend/tools/search/search_in_files_utils';

describe('normalizeReplacementArg', () => {
  it('treats missing or non-string values as undefined', () => {
    expect(normalizeReplacementArg(undefined)).toBeUndefined();
    expect(normalizeReplacementArg(null)).toBeUndefined();
    expect(normalizeReplacementArg(0)).toBeUndefined();
    expect(normalizeReplacementArg(false)).toBeUndefined();
    expect(normalizeReplacementArg({})).toBeUndefined();
  });

  it('treats empty/whitespace-only strings as undefined', () => {
    expect(normalizeReplacementArg('')).toBeUndefined();
    expect(normalizeReplacementArg('   ')).toBeUndefined();
    expect(normalizeReplacementArg('\n\t')).toBeUndefined();
  });

  it('keeps non-empty strings unchanged', () => {
    expect(normalizeReplacementArg('x')).toBe('x');
    expect(normalizeReplacementArg('  x  ')).toBe('  x  ');
  });
});

