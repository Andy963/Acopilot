import { describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({}));

import { handleToolConfirmation } from '../backend/modules/api/chat/services/chatFlow/handleToolConfirmation';
import { OrphanedToolCallService } from '../backend/modules/api/chat/services/OrphanedToolCallService';
import { ToolExecutionService } from '../backend/modules/api/chat/services/ToolExecutionService';

describe('tool allowlist propagation', () => {
  it('passes last user toolAllowList when executing confirmed tool calls', async () => {
    const history: any[] = [
      {
        role: 'user',
        parts: [{ text: 'hi' }],
        contextOverrides: {
          toolAllowList: ['  read_file  '],
        },
      },
      {
        role: 'model',
        parts: [],
      },
    ];

    const executeFunctionCallsWithResults = vi.fn(async () => ({
      responseParts: [],
      toolResults: [],
      checkpoints: [],
    }));

    const ctx: any = {
      configManager: {
        getConfig: vi.fn(async () => ({ enabled: true, type: 'custom' })),
      },
      conversationManager: {
        getHistory: vi.fn(async () => history),
        getHistoryRef: vi.fn(async () => history),
        addContent: vi.fn(async (_conversationId: string, content: any) => {
          history.push(content);
        }),
      },
      toolCallParserService: {
        extractFunctionCalls: vi.fn(() => [{ id: 'call_1', name: 'write_file', args: { files: [] } }]),
      },
      toolExecutionService: {
        executeFunctionCallsWithResults: executeFunctionCallsWithResults,
      },
      tokenEstimationService: {
        preCountUserMessageTokens: vi.fn(async () => undefined),
      },
      toolIterationLoopService: {
        runToolLoop: vi.fn(() => (async function* () {})()),
      },
      settingsManager: undefined,
    };

    const request: any = {
      conversationId: 'conv_1',
      configId: 'cfg_1',
      toolResponses: [{ id: 'call_1', confirmed: true }],
    };

    for await (const _chunk of handleToolConfirmation(ctx, request)) {
      // consume
    }

    expect(executeFunctionCallsWithResults).toHaveBeenCalledTimes(1);
    const args = executeFunctionCallsWithResults.mock.calls[0];
    expect(args[5]).toEqual(['read_file']);
  });

  it('passes last user toolAllowList when executing orphaned tool calls', async () => {
    const history: any[] = [
      {
        role: 'user',
        parts: [{ text: 'hi' }],
        contextOverrides: {
          toolAllowList: ['read_file', 'open_file'],
        },
      },
      {
        role: 'model',
        parts: [],
      },
    ];

    const executeFunctionCallsWithResults = vi.fn(async () => ({
      responseParts: [],
      toolResults: [],
      checkpoints: [],
    }));

    const service = new OrphanedToolCallService(
      {
        getHistoryRef: vi.fn(async () => history),
        addContent: vi.fn(async (_conversationId: string, content: any) => {
          history.push(content);
        }),
      } as any,
      {
        extractFunctionCalls: vi.fn(() => [{ id: 'call_1', name: 'write_file', args: { files: [] } }]),
      } as any,
      {
        executeFunctionCallsWithResults: executeFunctionCallsWithResults,
      } as any
    );

    await service.checkAndExecuteOrphanedFunctionCalls('conv_1');

    expect(executeFunctionCallsWithResults).toHaveBeenCalledTimes(1);
    const args = executeFunctionCallsWithResults.mock.calls[0];
    expect(args[5]).toEqual(['read_file', 'open_file']);
  });

  it('does not ask for confirmation for tools outside the active allowlist', () => {
    const service = new ToolExecutionService(
      undefined,
<<<<<<< HEAD
=======
      undefined,
>>>>>>> f327a97 (merge: dev into main for v1.2.0)
      {
        isToolAutoExec: vi.fn(() => false),
      } as any
    );

    const calls: any[] = [
      { id: 'call_1', name: 'write_file', args: { files: [] } },
      { id: 'call_2', name: 'read_file', args: { files: [] } },
    ];

    expect(service.getToolsNeedingConfirmation(calls, ['read_file'])).toEqual([calls[1]]);
  });
});
