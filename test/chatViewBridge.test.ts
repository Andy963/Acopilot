import { describe, expect, it, vi } from 'vitest';
import { ChatViewBridge } from '../webview/chatViewBridge';

describe('ChatViewBridge', () => {
  it('queues commands until the webview signals readiness', () => {
    const postMessage = vi.fn();
    const bridge = new ChatViewBridge();

    bridge.sendCommand('showChat');
    bridge.attachView({
      webview: {
        postMessage,
      },
    } as any);

    bridge.sendCommand('showHistory');
    expect(postMessage).not.toHaveBeenCalled();

    bridge.markReady();

    expect(postMessage.mock.calls).toEqual([
      [{ type: 'command', command: 'showChat', data: undefined }],
      [{ type: 'command', command: 'showHistory', data: undefined }],
    ]);

    bridge.sendCommand('showSettings', { tab: 'general' });
    expect(postMessage.mock.calls[postMessage.mock.calls.length - 1]?.[0]).toEqual({
      type: 'command',
      command: 'showSettings',
      data: { tab: 'general' },
    });
  });

  it('posts host events and responses without waiting for readiness', () => {
    const postMessage = vi.fn();
    const bridge = new ChatViewBridge();

    bridge.attachView({
      webview: {
        postMessage,
      },
    } as any);

    bridge.postHostEvent('taskEvent', { taskId: 'task-1' });
    bridge.sendResponse('req-1', { ok: true });
    bridge.sendError('req-2', 'FAILED', 'boom');

    expect(postMessage.mock.calls).toEqual([
      [{ type: 'taskEvent', data: { taskId: 'task-1' } }],
      [{ type: 'response', requestId: 'req-1', success: true, data: { ok: true } }],
      [{
        type: 'error',
        requestId: 'req-2',
        success: false,
        error: {
          code: 'FAILED',
          message: 'boom',
        },
      }],
    ]);
  });
});
