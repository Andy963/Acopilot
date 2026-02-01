import { describe, expect, it } from 'vitest';

import { LOCATE_TOOL_ALLOWLIST, resolveLocateModeParams } from '../backend/modules/api/chat/services/locateMode';

function createConversationManagerStub() {
  const metadata = new Map<string, unknown>();
  return {
    getCustomMetadata: async (conversationId: string, key: string) => metadata.get(`${conversationId}:${key}`),
    setCustomMetadata: async (conversationId: string, key: string, value: unknown) => {
      metadata.set(`${conversationId}:${key}`, value);
    },
  };
}

function createSettingsManagerStub(input: { enabled: boolean; config: any }) {
  return {
    isToolEnabled: (toolName: string) => (toolName === 'locate' ? input.enabled : true),
    getLocateConfig: () => input.config,
  } as any;
}

describe('resolveLocateModeParams (auto inference)', () => {
  it('auto-enters locate mode when a trigger keyword matches', async () => {
    const conversationManager = createConversationManagerStub();
    const settingsManager = createSettingsManagerStub({
      enabled: true,
      config: { model: 'fast-model', autoTriggerEnabled: true, triggerKeywords: ['where is'] },
    });

    const res = await resolveLocateModeParams({
      conversationManager: conversationManager as any,
      settingsManager,
      conversationId: 'c1',
      mode: undefined,
      message: 'where is resolveLocateModeParams defined?',
      contextOverrides: undefined,
      taskContext: undefined,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.effectiveContextOverrides?.mode).toBe('locate');
    expect(res.effectiveContextOverrides?.includeTools).toBe(true);
    expect(res.effectiveContextOverrides?.toolAllowList).toEqual([...LOCATE_TOOL_ALLOWLIST]);
    expect(res.effectiveContextOverrides?.modelOverride).toBe('fast-model');
    expect(res.effectiveTaskContext).toContain('LOCATE MODE:');
  });

  it('does not auto-enter locate mode when edit intent is detected', async () => {
    const conversationManager = createConversationManagerStub();
    const settingsManager = createSettingsManagerStub({
      enabled: true,
      config: { autoTriggerEnabled: true, triggerKeywords: ['where is'] },
    });

    const res = await resolveLocateModeParams({
      conversationManager: conversationManager as any,
      settingsManager,
      conversationId: 'c1',
      mode: undefined,
      message: 'where is foo defined? please fix it',
      contextOverrides: undefined,
      taskContext: undefined,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.effectiveContextOverrides).toBeUndefined();
  });

  it('does not infer locate mode for other slash commands', async () => {
    const conversationManager = createConversationManagerStub();
    const settingsManager = createSettingsManagerStub({
      enabled: true,
      config: { autoTriggerEnabled: true, triggerKeywords: ['where is'] },
    });

    const res = await resolveLocateModeParams({
      conversationManager: conversationManager as any,
      settingsManager,
      conversationId: 'c1',
      mode: undefined,
      message: '/help where is foo',
      contextOverrides: undefined,
      taskContext: undefined,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.effectiveContextOverrides).toBeUndefined();
  });

  it('respects autoTriggerEnabled=false', async () => {
    const conversationManager = createConversationManagerStub();
    const settingsManager = createSettingsManagerStub({
      enabled: true,
      config: { autoTriggerEnabled: false, triggerKeywords: ['where is'] },
    });

    const res = await resolveLocateModeParams({
      conversationManager: conversationManager as any,
      settingsManager,
      conversationId: 'c1',
      mode: undefined,
      message: 'where is foo',
      contextOverrides: undefined,
      taskContext: undefined,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.effectiveContextOverrides).toBeUndefined();
  });

  it('still supports explicit /locate even when auto trigger is disabled', async () => {
    const conversationManager = createConversationManagerStub();
    const settingsManager = createSettingsManagerStub({
      enabled: true,
      config: { autoTriggerEnabled: false, triggerKeywords: ['where is'] },
    });

    const res = await resolveLocateModeParams({
      conversationManager: conversationManager as any,
      settingsManager,
      conversationId: 'c1',
      mode: undefined,
      message: '/locate where is foo',
      contextOverrides: undefined,
      taskContext: undefined,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.effectiveMessage).toBe('where is foo');
    expect(res.effectiveContextOverrides?.mode).toBe('locate');
  });

  it('rejects explicit /locate when locate tool is disabled', async () => {
    const conversationManager = createConversationManagerStub();
    const settingsManager = createSettingsManagerStub({
      enabled: false,
      config: { autoTriggerEnabled: true, triggerKeywords: ['where is'] },
    });

    const res = await resolveLocateModeParams({
      conversationManager: conversationManager as any,
      settingsManager,
      conversationId: 'c1',
      mode: undefined,
      message: '/locate where is foo',
      contextOverrides: undefined,
      taskContext: undefined,
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('LOCATE_DISABLED');
  });
});

