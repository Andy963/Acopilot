import { afterEach, describe, expect, it } from 'vitest';

import { clearGlobalContext, initGlobalContext } from '../backend/core/settingsContext';
import { StreamAccumulator } from '../backend/modules/channel/StreamAccumulator';
import { StreamResponseProcessor } from '../backend/modules/api/chat/handlers/StreamResponseProcessor';

function setAmbientToolMode(toolMode: 'function_call' | 'xml' | 'json'): void {
  initGlobalContext({
    settingsManager: {
      getActiveChannelId: () => 'ambient-channel',
      getDefaultToolMode: () => toolMode,
    } as any,
    configManager: {
      configCache: new Map([['ambient-channel', { toolMode }]]),
    } as any,
  });
}

describe('stream request tool mode scoping', () => {
  afterEach(() => {
    clearGlobalContext();
  });

  it('parses streamed tool calls with the request tool mode instead of ambient config', () => {
    setAmbientToolMode('xml');

    const accumulator = new StreamAccumulator({ toolMode: 'json' });
    accumulator.add({
      delta: [
        {
          text: 'Before <<<TOOL_CALL>>>{"tool":"read_file","parameters":{"path":"a.txt"}}<<<END_TOOL_CALL>>> after',
        },
      ],
      done: true,
    });

    const parts = accumulator.getContent().parts;
    expect(parts).toHaveLength(3);
    expect(parts[0]).toMatchObject({ text: 'Before' });
    expect(parts[1]).toMatchObject({
      functionCall: {
        name: 'read_file',
        args: { path: 'a.txt' },
      },
    });
    expect(parts[2]).toMatchObject({ text: ' after' });
  });

  it('keeps using the request tool mode when ambient config changes mid-stream', async () => {
    setAmbientToolMode('xml');

    const processor = new StreamResponseProcessor({
      requestStartTime: Date.now(),
      providerType: 'custom',
      toolMode: 'json',
      conversationId: 'conv-1',
    });

    async function* response() {
      yield {
        delta: [
          {
            text: 'Before <<<TOOL_CALL>>>{"tool":"read_file",',
          },
        ],
      };

      setAmbientToolMode('function_call');

      yield {
        delta: [
          {
            text: '"parameters":{"path":"b.txt"}}<<<END_TOOL_CALL>>> after',
          },
        ],
        done: true,
      };
    }

    for await (const _chunk of processor.processStream(response())) {
      // consume stream
    }

    const parts = processor.getContent().parts;
    expect(parts).toHaveLength(3);
    expect(parts[0]).toMatchObject({ text: 'Before' });
    expect(parts[1]).toMatchObject({
      functionCall: {
        name: 'read_file',
        args: { path: 'b.txt' },
      },
    });
    expect(parts[2]).toMatchObject({ text: ' after' });
  });
});
