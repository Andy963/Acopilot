import type { Content, ContentPart } from '../../../conversation/types';
import {
  convertFunctionCallToXML,
  convertFunctionResponseToXML,
  parseXMLToolCalls,
} from '../../../../tools/xmlFormatter';
import {
  convertFunctionCallToJSON,
  convertFunctionResponseToJSON,
  TOOL_CALL_END,
  TOOL_CALL_START,
} from '../../../../tools/jsonFormatter';
import {
  decodeBase64ToUtf8,
  formatTextAttachment,
  formatUnsupportedAttachment,
  isImageMimeType,
  isTextMimeType,
} from '../inlineDataUtils';

export function convertThoughtSignatures(history: Content[]): Content[] {
  return history.map((content) => ({
    role: content.role,
    parts: content.parts.map((part) => {
      if (part.thoughtSignatures?.anthropic) {
        const { thoughtSignatures, ...restPart } = part;
        return {
          ...restPart,
          signature: thoughtSignatures.anthropic,
        } as ContentPart;
      }

      if (part.thoughtSignatures) {
        const { thoughtSignatures, ...restPart } = part;
        return restPart;
      }

      return part;
    }),
  }));
}

export function convertToAnthropicMessages(history: Content[], toolMode: string = 'function_call'): any[] {
  const messages: any[] = [];

  if (toolMode === 'function_call') {
    convertHistoryFunctionCallMode(history, messages);
  } else {
    convertHistoryTextMode(history, messages, toolMode as 'xml' | 'json');
  }

  return messages;
}

function convertHistoryFunctionCallMode(history: Content[], messages: any[]): void {
  for (const content of history) {
    const role = content.role === 'model' ? 'assistant' : content.role;

    const textParts = content.parts.filter((p) => 'text' in p && !p.thought);
    const thoughtParts = content.parts.filter((p) => 'text' in p && p.thought);
    const redactedThinkingParts = content.parts.filter((p) => p.redactedThinking);
    const signatureParts = content.parts.filter((p) => (p as any).signature);
    const functionCallParts = content.parts.filter((p) => p.functionCall);
    const functionResponseParts = content.parts.filter((p) => p.functionResponse);
    const mediaParts = content.parts.filter((p) => p.inlineData || p.fileData);

    if (functionCallParts.length > 0) {
      const contentArray: any[] = [];

      addThinkingBlocks(contentArray, thoughtParts, redactedThinkingParts, signatureParts);

      for (const part of textParts) {
        if (part.text) {
          contentArray.push({
            type: 'text',
            text: part.text,
          });
        }
      }

      for (const part of functionCallParts) {
        const fc = part.functionCall!;
        contentArray.push({
          type: 'tool_use',
          id: fc.id || `toolu_${Date.now()}`,
          name: fc.name,
          input: fc.args,
        });
      }

      messages.push({
        role: 'assistant',
        content: contentArray,
      });
      continue;
    }

    if (functionResponseParts.length > 0) {
      const contentArray: any[] = [];

      for (const part of functionResponseParts) {
        const resp = part.functionResponse!;
        contentArray.push({
          type: 'tool_result',
          tool_use_id: resp.id || `toolu_${Date.now()}`,
          content: JSON.stringify(resp.response),
        });
      }

      messages.push({
        role: 'user',
        content: contentArray,
      });
      continue;
    }

    if (textParts.length > 0 || mediaParts.length > 0 || thoughtParts.length > 0 || redactedThinkingParts.length > 0) {
      const contentArray: any[] = [];

      addThinkingBlocks(contentArray, thoughtParts, redactedThinkingParts, signatureParts);

      contentArray.push(...buildMessageContent(textParts, mediaParts));

      messages.push({
        role,
        content: contentArray,
      });
    }
  }
}

function addThinkingBlocks(
  contentArray: any[],
  thoughtParts: ContentPart[],
  redactedThinkingParts: ContentPart[],
  signatureParts: ContentPart[],
): void {
  if (thoughtParts.length > 0) {
    const thinkingText = thoughtParts.map((p) => p.text).join('\n');
    const thinkingBlock: any = {
      type: 'thinking',
      thinking: thinkingText,
    };

    if (signatureParts.length > 0) {
      thinkingBlock.signature = (signatureParts[0] as any).signature;
    }

    contentArray.push(thinkingBlock);
  }

  for (const part of redactedThinkingParts) {
    if (part.redactedThinking) {
      contentArray.push({
        type: 'redacted_thinking',
        data: part.redactedThinking,
      });
    }
  }
}

function buildMessageContent(textParts: ContentPart[], mediaParts: ContentPart[]): any[] {
  const contentArray: any[] = [];

  for (const part of mediaParts) {
    if (part.inlineData) {
      const mimeType = part.inlineData.mimeType;

      if (isImageMimeType(mimeType)) {
        contentArray.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: mimeType,
            data: part.inlineData.data,
          },
        });
        continue;
      }

      if (isTextMimeType(mimeType)) {
        const decoded = decodeBase64ToUtf8(part.inlineData.data);
        contentArray.push({
          type: 'text',
          text:
            decoded !== null
              ? formatTextAttachment({
                  mimeType,
                  text: decoded,
                  displayName: part.inlineData.displayName,
                })
              : formatUnsupportedAttachment({
                  mimeType,
                  displayName: part.inlineData.displayName,
                }),
        });
        continue;
      }

      contentArray.push({
        type: 'text',
        text: formatUnsupportedAttachment({
          mimeType,
          displayName: part.inlineData.displayName,
        }),
      });
      continue;
    }

    if (part.fileData) {
      contentArray.push({
        type: 'image',
        source: {
          type: 'url',
          url: part.fileData.fileUri,
        },
      });
    }
  }

  for (const part of textParts) {
    if (part.text) {
      contentArray.push({
        type: 'text',
        text: part.text,
      });
    }
  }

  return contentArray;
}

function convertHistoryTextMode(history: Content[], messages: any[], mode: 'xml' | 'json'): void {
  for (const content of history) {
    const role = content.role === 'model' ? 'assistant' : content.role;

    const functionResponseParts = content.parts.filter((p) => p.functionResponse);
    const mediaParts = content.parts.filter((p) => p.inlineData || p.fileData);

    if (functionResponseParts.length > 0) {
      const contentArray: any[] = [];

      for (const part of functionResponseParts) {
        const resp = part.functionResponse!;
        const responseText =
          mode === 'xml'
            ? convertFunctionResponseToXML(resp.name, resp.response)
            : convertFunctionResponseToJSON(resp.name, resp.response);

        contentArray.push({
          type: 'text',
          text: responseText,
        });
      }

      messages.push({
        role: 'user',
        content: contentArray,
      });
      continue;
    }

    const textParts: ContentPart[] = [];

    for (const part of content.parts) {
      if (part.thought) continue;
      if (part.inlineData || part.fileData) continue;

      if (part.functionCall) {
        const callText =
          mode === 'xml'
            ? convertFunctionCallToXML(part.functionCall.name, part.functionCall.args)
            : convertFunctionCallToJSON(part.functionCall.name, part.functionCall.args);
        textParts.push({ text: callText });
        continue;
      }

      if ('text' in part && part.text) {
        textParts.push({ text: part.text });
      }
    }

    if (textParts.length > 0 || mediaParts.length > 0) {
      const contentArray = buildMessageContent(textParts, mediaParts);
      messages.push({
        role,
        content: contentArray,
      });
    }
  }
}

export function parseTextToolCallsForHistory(contentText: string): ContentPart[] {
  const parts: ContentPart[] = [];

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
              id: `toolu_${Date.now()}_${i}`,
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
          id: `toolu_${Date.now()}_${parts.length}`,
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
