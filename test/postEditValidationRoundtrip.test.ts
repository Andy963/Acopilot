import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConversationManager } from '../backend/modules/conversation/ConversationManager';
import { MemoryStorageAdapter } from '../backend/modules/conversation/storage';
import { contentToMessageEnhanced } from '../frontend/src/stores/chat/parsers';
import { getToolResponseById } from '../frontend/src/stores/chat/toolActions';
import { getRunnableValidationPresets } from '../frontend/src/stores/chat/validationPresets';

const { executeCommandHandler } = vi.hoisted(() => ({
  executeCommandHandler: vi.fn(),
}));

vi.mock('../backend/tools/terminal', () => ({
  registerExecuteCommand: () => ({
    handler: executeCommandHandler,
  }),
}));

describe('post-edit validation preset roundtrip', () => {
  beforeEach(() => {
    executeCommandHandler.mockReset();
  });

  it('surfaces only enabled runnable presets with stable ids', () => {
    const input = [
      { label: ' Test ', command: ' npm test ', kind: 'test' as const, enabled: true },
      { id: 'preset-build', label: 'Build', command: 'npm run build', kind: 'build' as const, enabled: true },
      { label: 'Disabled', command: 'npm run lint', enabled: false },
      { label: 'Blank', command: '   ', enabled: true },
    ];

    const first = getRunnableValidationPresets(input);
    const second = getRunnableValidationPresets(input.map((preset) => ({ ...preset })));

    expect(first).toHaveLength(2);
    expect(first).toEqual(second);

    expect(first[0]).toMatchObject({
      label: 'Test',
      command: 'npm test',
      kind: 'test',
      enabled: true,
    });
    expect(first[0]?.id).toBeTruthy();

    expect(first[1]).toMatchObject({
      id: 'preset-build',
      label: 'Build',
      command: 'npm run build',
      kind: 'build',
      enabled: true,
    });
  });

  it('persists validation execution and rehydrates the tool response after reload', async () => {
    executeCommandHandler.mockResolvedValue({
      success: true,
      stdout: 'ok',
    });

    const { runValidationCommand } = await import('../webview/handlers/ValidationHandlers');

    const conversationManager = new ConversationManager(new MemoryStorageAdapter());
    const conversationId = 'post-edit-validation-roundtrip';
    await conversationManager.createConversation(conversationId);

    const sendResponse = vi.fn();
    const sendError = vi.fn();

    await runValidationCommand(
      {
        conversationId,
        toolCallId: 'tool-1',
        presetId: 'preset-test',
        presetLabel: 'Test suite',
        command: 'npm test',
        cwd: '/workspace',
        timeout: 30,
      },
      'req-1',
      {
        conversationManager,
        sendResponse,
        sendError,
      } as any,
    );

    expect(sendError).not.toHaveBeenCalled();
    expect(executeCommandHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'npm test',
        cwd: '/workspace',
        timeout: 30,
        validationPresetId: 'preset-test',
        validationPresetLabel: 'Test suite',
      }),
      expect.objectContaining({
        toolId: 'tool-1',
      }),
    );

    const history = await conversationManager.getMessages(conversationId);
    expect(history).toHaveLength(2);
    expect(history[0]?.parts[0]?.functionCall).toMatchObject({
      id: 'tool-1',
      name: 'execute_command',
      args: {
        command: 'npm test',
        cwd: '/workspace',
        timeout: 30,
        validationPresetId: 'preset-test',
        validationPresetLabel: 'Test suite',
      },
    });
    expect(history[1]?.parts[0]?.functionResponse).toMatchObject({
      id: 'tool-1',
      name: 'execute_command',
      response: {
        success: true,
        stdout: 'ok',
      },
    });

    const rehydratedMessages = history.map((content) => contentToMessageEnhanced(content));
    expect(rehydratedMessages[0]?.tools?.[0]).toMatchObject({
      id: 'tool-1',
      name: 'execute_command',
    });

    const response = getToolResponseById(
      {
        allMessages: { value: rehydratedMessages },
      } as any,
      'tool-1',
    );

    expect(response).toEqual({
      success: true,
      stdout: 'ok',
    });
    expect(sendResponse).toHaveBeenCalledWith('req-1', {
      success: true,
      toolCallId: 'tool-1',
      result: {
        success: true,
        stdout: 'ok',
      },
    });
  });
});
