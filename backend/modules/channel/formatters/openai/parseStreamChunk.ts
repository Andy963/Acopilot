import { debugLog } from '../../../../core/logger';
import type { ContentPart } from '../../../conversation/types';
import type { StreamChunk } from '../../types';

export function parseOpenAIStreamChunk(chunk: any): StreamChunk {
  if (chunk && typeof chunk === 'object' && (chunk as any).__acopilot_sse_done === true) {
    return {
      delta: [],
      done: true,
      finishReason: 'done',
    };
  }

  const choice = chunk.choices?.[0];
  const parts: ContentPart[] = [];

  if (choice) {
    const delta = choice.delta;

    if (delta?.reasoning_content) {
      parts.push({
        text: delta.reasoning_content,
        thought: true,
      });
    }

    if (delta?.content) {
      parts.push({ text: delta.content });
    }

    if (delta?.tool_calls && Array.isArray(delta.tool_calls)) {
      for (const toolCall of delta.tool_calls) {
        if (toolCall.function) {
          debugLog(
            '[OpenAI Stream] tool_call chunk:',
            JSON.stringify({
              index: toolCall.index,
              id: toolCall.id,
              name: toolCall.function.name,
              arguments: toolCall.function.arguments,
            }),
          );
          parts.push({
            functionCall: {
              name: toolCall.function.name || '',
              args: {},
              partialArgs: toolCall.function.arguments,
              id: toolCall.id,
              index: toolCall.index,
            } as any,
          });
        }
      }
    }
  }

  const hasFinishReason = !!choice?.finish_reason;
  const hasUsage = !!chunk.usage;
  const done = hasFinishReason || hasUsage;

  const streamChunk: StreamChunk = {
    delta: parts,
    done,
  };

  if (hasUsage) {
    const usage = chunk.usage;
    const completionTokens = usage.completion_tokens || 0;
    const reasoningTokens = usage.completion_tokens_details?.reasoning_tokens || 0;
    const candidatesTokenCount = completionTokens - reasoningTokens;

    streamChunk.usage = {
      promptTokenCount: usage.prompt_tokens,
      candidatesTokenCount: candidatesTokenCount > 0 ? candidatesTokenCount : undefined,
      totalTokenCount: usage.total_tokens,
      thoughtsTokenCount: reasoningTokens > 0 ? reasoningTokens : undefined,
    };
  }

  if (hasFinishReason) {
    streamChunk.finishReason = choice.finish_reason;
  }

  if (chunk.model) {
    streamChunk.modelVersion = chunk.model;
  }

  return streamChunk;
}

