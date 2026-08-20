import { t } from '../../../../i18n';
import type { Content, ContentPart } from '../../../conversation/types';
import type { GenerateResponse } from '../../types';
import { parseXMLToolCalls } from '../../../../tools/xmlFormatter';
import { TOOL_CALL_END, TOOL_CALL_START } from '../../../../tools/jsonFormatter';

export function parseOpenAIResponse(response: any): GenerateResponse {
  if (!response || !response.choices || response.choices.length === 0) {
    throw new Error(t('modules.channel.formatters.openai.errors.invalidResponse'));
  }

  const choice = response.choices[0];
  const message = choice.message;

  let parts: ContentPart[] = [];

  if (message.reasoning_content) {
    parts.push({
      text: message.reasoning_content,
      thought: true,
    });
  }

  if (message.tool_calls && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
    parts = parseResponseFunctionCallMode(message, parts);
  } else if (message.content) {
    parts = parseResponseAutoDetect(message, parts);
  }

  const content: Content = {
    role: 'model',
    parts,
    modelVersion: response.model,
  };

  if (response.usage) {
    const usage = response.usage;
    const completionTokens = usage.completion_tokens || 0;
    const reasoningTokens = usage.completion_tokens_details?.reasoning_tokens || 0;
    const candidatesTokenCount = completionTokens - reasoningTokens;

    content.usageMetadata = {
      promptTokenCount: usage.prompt_tokens,
      cachedPromptTokenCount: usage.prompt_tokens_details?.cached_tokens,
      candidatesTokenCount: candidatesTokenCount > 0 ? candidatesTokenCount : undefined,
      totalTokenCount: usage.total_tokens,
      thoughtsTokenCount: reasoningTokens > 0 ? reasoningTokens : undefined,
    };
  }

  const finishReason = choice.finish_reason;
  const model = response.model;

  return {
    content,
    finishReason,
    model,
    raw: response,
  };
}

function parseResponseFunctionCallMode(message: any, parts: ContentPart[]): ContentPart[] {
  if (message.content) {
    parts.push({ text: message.content });
  }

  if (message.tool_calls && Array.isArray(message.tool_calls)) {
    for (const toolCall of message.tool_calls) {
      if (toolCall.type === 'function') {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(toolCall.function.arguments || '{}');
        } catch {
          args = {};
        }
        parts.push({
          functionCall: {
            name: toolCall.function.name,
            args,
            id: toolCall.id,
          },
        });
      }
    }
  }

  return parts;
}

function parseResponseAutoDetect(message: any, parts: ContentPart[]): ContentPart[] {
  if (!message.content) {
    return parts;
  }

  const contentText = message.content as string;

  if (contentText.includes(TOOL_CALL_START)) {
    return extractJSONToolCallsFromContent(contentText, parts);
  }

  if (contentText.includes('<tool_use>')) {
    return extractXMLToolCallsFromContent(contentText, parts);
  }

  if (contentText.trim()) {
    parts.push({ text: contentText });
  }
  return parts;
}

function extractJSONToolCallsFromContent(content: string, existingParts: ContentPart[]): ContentPart[] {
  const parts = [...existingParts];
  const segments = content.split(TOOL_CALL_START);

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];

    if (i === 0) {
      const text = segment.trim();
      if (text) {
        parts.push({ text });
      }
      continue;
    }

    const endIndex = segment.indexOf(TOOL_CALL_END);
    if (endIndex !== -1) {
      const jsonStr = segment.substring(0, endIndex).trim();
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.tool && typeof parsed.tool === 'string') {
          parts.push({
            functionCall: {
              name: parsed.tool,
              args: parsed.parameters || {},
              id: `call_${Date.now()}_${i}`,
            },
          });
        }
      } catch (error) {
        console.warn('Failed to parse JSON tool call:', error);
        parts.push({ text: `${TOOL_CALL_START}${jsonStr}${TOOL_CALL_END}` });
      }

      const afterText = segment.substring(endIndex + TOOL_CALL_END.length).trim();
      if (afterText) {
        parts.push({ text: afterText });
      }
      continue;
    }

    parts.push({ text: `${TOOL_CALL_START}${segment}` });
  }

  return parts;
}

function extractXMLToolCallsFromContent(content: string, existingParts: ContentPart[]): ContentPart[] {
  const parts = [...existingParts];

  const toolUseRegex = /<tool_use>([\s\S]*?)<\/tool_use>/g;
  let lastIndex = 0;
  let match;

  while ((match = toolUseRegex.exec(content)) !== null) {
    const beforeText = content.substring(lastIndex, match.index).trim();
    if (beforeText) {
      parts.push({ text: beforeText });
    }

    const toolCalls = parseXMLToolCalls(match[0]);
    for (const call of toolCalls) {
      parts.push({
        functionCall: {
          name: call.name,
          args: call.args,
          id: `call_${Date.now()}_${parts.length}`,
        },
      });
    }

    lastIndex = match.index + match[0].length;
  }

  const afterText = content.substring(lastIndex).trim();
  if (afterText) {
    parts.push({ text: afterText });
  }

  if (parts.length === existingParts.length && content.trim()) {
    parts.push({ text: content });
  }

  return parts;
}
