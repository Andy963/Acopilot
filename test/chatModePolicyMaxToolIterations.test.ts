import { describe, expect, it } from 'vitest';

import { CHAT_MODE_TOOL_ALLOWLIST, resolveChatModePolicy } from '../backend/modules/api/chat/services/chatMode';
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

describe('chatMode read-only policy', () => {
  it('keeps chat mode on a read-only tool allowlist and explicit no-write instruction', () => {
    const chat = resolveChatModePolicy({
      chatMode: 'chat',
      contextOverrides: undefined,
      taskContext: undefined,
    });

    expect(chat.effectiveContextOverrides?.toolAllowList).toEqual([...CHAT_MODE_TOOL_ALLOWLIST]);
    expect(chat.effectiveContextOverrides?.toolAllowList).not.toContain('write_file');
    expect(chat.effectiveContextOverrides?.toolAllowList).not.toContain('apply_diff');
    expect(chat.effectiveTaskContext).toContain('Do not modify files');
    expect(chat.effectiveTaskContext).toContain('write_file');
  });

  it('keeps plan mode read-only until the user confirms implementation', () => {
    const plan = resolveChatModePolicy({
      chatMode: 'plan',
      contextOverrides: undefined,
      taskContext: undefined,
    });

    expect(plan.effectiveContextOverrides?.toolAllowList).toEqual([...CHAT_MODE_TOOL_ALLOWLIST]);
    expect(plan.effectiveTaskContext).toContain('Do not modify files');
  });
});
