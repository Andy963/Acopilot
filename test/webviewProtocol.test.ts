import { describe, expect, it } from 'vitest';

import { parseGuardedHandlerPayload, parseStreamPayload, parseWebviewRequest } from '../webview/protocol';

describe('webview protocol parsing', () => {
  it('rejects invalid webview request envelope', () => {
    expect(parseWebviewRequest(null)).toBeNull();
    expect(parseWebviewRequest('nope')).toBeNull();
    expect(parseWebviewRequest({})).toBeNull();
    expect(parseWebviewRequest({ type: 't' })).toBeNull();
    expect(parseWebviewRequest({ requestId: 'r' })).toBeNull();
  });

  it('parses a valid webview request envelope', () => {
    const parsed = parseWebviewRequest({ type: 'ping', requestId: 'req-1', data: { ok: true } });
    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe('ping');
    expect(parsed?.requestId).toBe('req-1');
    expect(parsed?.data).toEqual({ ok: true });
  });

  it('validates cancelStream payload', () => {
    expect(parseStreamPayload('cancelStream', {}).ok).toBe(false);
    const ok = parseStreamPayload('cancelStream', { conversationId: 'c1' });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.conversationId).toBe('c1');
  });

  it('validates retryStream payload', () => {
    expect(parseStreamPayload('retryStream', { conversationId: 'c1' }).ok).toBe(false);
    const ok = parseStreamPayload('retryStream', { conversationId: 'c1', configId: 'cfg' });
    expect(ok.ok).toBe(true);
  });

  it('validates editAndRetryStream payload', () => {
    expect(
      parseStreamPayload('editAndRetryStream', {
        conversationId: 'c1',
        configId: 'cfg',
        messageIndex: '0',
        newMessage: 'x'
      }).ok
    ).toBe(false);

    const ok = parseStreamPayload('editAndRetryStream', {
      conversationId: 'c1',
      configId: 'cfg',
      messageIndex: 0,
      newMessage: 'x'
    });
    expect(ok.ok).toBe(true);
  });

  it('validates toolConfirmation payload', () => {
    expect(
      parseStreamPayload('toolConfirmation', {
        conversationId: 'c1',
        configId: 'cfg',
        toolResponses: 'nope'
      }).ok
    ).toBe(false);

    const ok = parseStreamPayload('toolConfirmation', {
      conversationId: 'c1',
      configId: 'cfg',
      toolResponses: [{ id: 't1', name: 'tool', confirmed: true }]
    });
    expect(ok.ok).toBe(true);
  });

  it('validates chatStream payload', () => {
    expect(
      parseStreamPayload('chatStream', {
        conversationId: 'c1',
        configId: 'cfg',
        message: 'hi',
        chatMode: 'nope',
        attachments: 'nope'
      }).ok
    ).toBe(false);

    const ok = parseStreamPayload('chatStream', {
      conversationId: 'c1',
      configId: 'cfg',
      message: 'hi',
      chatMode: 'chat',
      attachments: [
        {
          id: 'a1',
          name: 'x.png',
          type: 'image',
          size: 1,
          mimeType: 'image/png',
          data: 'base64'
        }
      ]
    });
    expect(ok.ok).toBe(true);
  });

  it('validates validation.runCommand payload', () => {
    expect(
      parseGuardedHandlerPayload('validation.runCommand', {
        conversationId: 'c1',
        toolCallId: 'tool-1',
        command: 1
      })?.ok
    ).toBe(false);

    const ok = parseGuardedHandlerPayload('validation.runCommand', {
      conversationId: 'c1',
      toolCallId: 'tool-1',
      command: 'npm test',
      cwd: '/workspace',
      timeout: 30
    });
    expect(ok?.ok).toBe(true);
  });

  it('validates storagePath.migrate payload', () => {
    expect(parseGuardedHandlerPayload('storagePath.migrate', { path: '' })?.ok).toBe(false);

    const ok = parseGuardedHandlerPayload('storagePath.migrate', { path: '/tmp/acopilot-data' });
    expect(ok?.ok).toBe(true);
  });

  it('validates tool config mutation payloads', () => {
    expect(
      parseGuardedHandlerPayload('tools.updateToolConfig', {
        toolName: 'locate',
        config: 'invalid'
      })?.ok
    ).toBe(false);
    expect(
      parseGuardedHandlerPayload('tools.setToolEnabled', {
        toolName: 'locate',
        enabled: 'yes'
      })?.ok
    ).toBe(false);
    expect(
      parseGuardedHandlerPayload('tools.updateExecuteCommandConfig', {
        config: 'invalid'
      })?.ok
    ).toBe(false);

    expect(
      parseGuardedHandlerPayload('tools.updateToolConfig', {
        toolName: 'locate',
        config: { autoTriggerEnabled: true }
      })?.ok
    ).toBe(true);
    expect(
      parseGuardedHandlerPayload('tools.setToolEnabled', {
        toolName: 'locate',
        enabled: true
      })?.ok
    ).toBe(true);
    expect(
      parseGuardedHandlerPayload('tools.updateExecuteCommandConfig', {
        config: { shells: [] }
      })?.ok
    ).toBe(true);
  });
});
