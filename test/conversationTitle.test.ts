import { describe, expect, it } from 'vitest';

import {
  MANUAL_CONVERSATION_TITLE_MAX_LEN,
  normalizeConversationTitle,
} from '../frontend/src/utils/conversationTitle';

describe('normalizeConversationTitle', () => {
  it('keeps a title separate from message content formatting', () => {
    expect(normalizeConversationTitle('  Release\nnotes  ')).toBe('Release notes');
  });

  it('rejects blank titles', () => {
    expect(normalizeConversationTitle('   \n  ')).toBe('');
  });

  it('truncates long titles by code points', () => {
    const title = 'x'.repeat(MANUAL_CONVERSATION_TITLE_MAX_LEN + 10);
    expect(normalizeConversationTitle(title)).toHaveLength(MANUAL_CONVERSATION_TITLE_MAX_LEN + 1);
    expect(normalizeConversationTitle(title).endsWith('…')).toBe(true);
  });
});
