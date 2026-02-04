import type { ContentPart } from '../../../conversation/types';
import type { StreamChunk } from '../../types';

export function parseAnthropicStreamChunk(chunk: any): StreamChunk {
  if (chunk && typeof chunk === 'object' && (chunk as any).__acopilot_sse_done === true) {
    return {
      delta: [],
      done: true,
      finishReason: 'done',
    };
  }

  const parts: ContentPart[] = [];
  let done = false;
  let usage: any;
  let finishReason: string | undefined;

  if (chunk.type === 'content_block_delta') {
    const delta = chunk.delta;

    if (delta?.type === 'text_delta') {
      parts.push({ text: delta.text });
    } else if (delta?.type === 'thinking_delta') {
      parts.push({
        text: delta.thinking,
        thought: true,
      });
    } else if (delta?.type === 'signature_delta') {
      parts.push({
        thoughtSignatures: {
          anthropic: delta.signature,
        },
      });
    } else if (delta?.type === 'redacted_thinking_delta') {
      parts.push({
        redactedThinking: delta.data,
      });
    } else if (delta?.type === 'input_json_delta') {
      if (delta.partial_json !== undefined) {
        parts.push({
          functionCall: {
            name: '',
            args: {},
            partialArgs: delta.partial_json,
          },
        });
      }
    }
  } else if (chunk.type === 'content_block_start') {
    const block = chunk.content_block;

    if (block?.type === 'text') {
      if (block.text) {
        parts.push({ text: block.text });
      }
    } else if (block?.type === 'thinking') {
      if (block.thinking) {
        parts.push({
          text: block.thinking,
          thought: true,
        });
      }
    } else if (block?.type === 'redacted_thinking') {
      if (block.data) {
        parts.push({
          redactedThinking: block.data,
        });
      }
    } else if (block?.type === 'tool_use') {
      const args = block.input || {};
      parts.push({
        functionCall: {
          name: block.name,
          args,
          partialArgs: Object.keys(args).length > 0 ? JSON.stringify(args) : '',
          id: block.id,
        },
      });
    }
  } else if (chunk.type === 'message_delta') {
    finishReason = chunk.delta?.stop_reason;

    if (chunk.usage) {
      usage = {
        candidatesTokenCount: chunk.usage.output_tokens,
      };
    }
  } else if (chunk.type === 'message_stop') {
    done = true;
  } else if (chunk.type === 'message_start') {
    if (chunk.message?.usage) {
      usage = {
        promptTokenCount: chunk.message.usage.input_tokens,
      };
    }
  }

  const streamChunk: StreamChunk = {
    delta: parts,
    done,
  };

  if (finishReason) {
    streamChunk.finishReason = finishReason;
  }

  if (usage) {
    streamChunk.usage = usage;
  }

  return streamChunk;
}

