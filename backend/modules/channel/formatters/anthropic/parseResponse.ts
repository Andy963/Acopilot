import { t } from '../../../../i18n';
import type { Content, ContentPart } from '../../../conversation/types';
import type { GenerateResponse } from '../../types';
import { parseTextToolCallsForHistory } from './history';

export function parseAnthropicResponse(response: any): GenerateResponse {
  if (!response || !response.content) {
    throw new Error(t('modules.channel.formatters.anthropic.errors.invalidResponse'));
  }

  let parts: ContentPart[] = [];

  for (const block of response.content) {
    if (block.type === 'thinking') {
      if (block.thinking) {
        parts.push({
          text: block.thinking,
          thought: true,
        });
      }

      if (block.signature) {
        parts.push({
          thoughtSignatures: {
            anthropic: block.signature,
          },
        });
      }
      continue;
    }

    if (block.type === 'redacted_thinking') {
      if (block.data) {
        parts.push({
          redactedThinking: block.data,
        });
      }
      continue;
    }

    if (block.type === 'text') {
      parts.push({ text: block.text });
      continue;
    }

    if (block.type === 'tool_use') {
      parts.push({
        functionCall: {
          name: block.name,
          args: block.input || {},
          id: block.id,
        },
      });
    }
  }

  const hasToolUse = response.content.some((b: any) => b.type === 'tool_use');
  if (!hasToolUse) {
    const textContent = parts
      .filter((p) => 'text' in p && !p.thought)
      .map((p) => p.text)
      .join('\n');

    if (textContent) {
      const thoughtParts = parts.filter((p) => p.thought || p.thoughtSignatures);
      const detectedParts = parseTextToolCallsForHistory(textContent);
      parts = [...thoughtParts, ...detectedParts];
    }
  }

  const content: Content = {
    role: 'model',
    parts,
    modelVersion: response.model,
  };

  if (response.usage) {
    content.usageMetadata = {
      promptTokenCount: response.usage.input_tokens,
      candidatesTokenCount: response.usage.output_tokens,
      totalTokenCount: (response.usage.input_tokens || 0) + (response.usage.output_tokens || 0),
    };
  }

  const finishReason = response.stop_reason;

  return {
    content,
    finishReason,
    model: response.model,
    raw: response,
  };
}

