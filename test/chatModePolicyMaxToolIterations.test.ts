import { describe, expect, it } from 'vitest';

import { resolveChatModePolicy } from '../backend/modules/api/chat/services/chatMode';
import { getMaxToolIterations } from '../backend/modules/api/chat/services/chatFlow/context';
import { DEFAULT_MAX_TOOL_ITERATIONS } from '../backend/modules/settings/types';

describe('chatMode max tool iterations', () => {
  it('does not cap maxToolIterations for chat/plan modes', () => {
    const chat = resolveChatModePolicy({
      chatMode: 'chat',
      contextOverrides: undefined,
      taskContext: undefined,
    });

    const plan = resolveChatModePolicy({
      chatMode: 'plan',
      contextOverrides: undefined,
      taskContext: undefined,
    });

    expect(chat.maxToolIterations).toBeUndefined();
    expect(plan.maxToolIterations).toBeUndefined();
  });

  it('falls back to DEFAULT_MAX_TOOL_ITERATIONS when settings manager is missing', () => {
    expect(getMaxToolIterations({ settingsManager: undefined })).toBe(DEFAULT_MAX_TOOL_ITERATIONS);
  });
});

