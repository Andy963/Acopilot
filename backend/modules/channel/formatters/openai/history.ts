import type { Content, ContentPart } from '../../../conversation/types';
import { convertFunctionCallToXML, convertFunctionResponseToXML } from '../../../../tools/xmlFormatter';
import { convertFunctionCallToJSON, convertFunctionResponseToJSON } from '../../../../tools/jsonFormatter';
import {
  decodeBase64ToUtf8,
  formatTextAttachment,
  formatUnsupportedAttachment,
  isImageMimeType,
  isTextMimeType,
} from '../inlineDataUtils';

export function convertToOpenAIMessages(
  history: Content[],
  systemInstruction?: string,
  toolMode: string = 'function_call',
): any[] {
  const messages: any[] = [];

  if (systemInstruction) {
    messages.push({
      role: 'system',
      content: systemInstruction,
    });
  }

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
    const thoughtParts = content.parts.filter((p) => 'text' in p && p.thought === true);
    const functionCallParts = content.parts.filter((p) => p.functionCall);
    const functionResponseParts = content.parts.filter((p) => p.functionResponse);
    const mediaParts = content.parts.filter((p) => p.inlineData || p.fileData);

    if (functionCallParts.length > 0) {
      const toolCalls = functionCallParts.map((p, index) => ({
        id: p.functionCall!.id || `call_${Date.now()}_${index}`,
        type: 'function',
        function: {
          name: p.functionCall!.name,
          arguments: JSON.stringify(p.functionCall!.args),
        },
      }));

      const message: any = {
        role: 'assistant',
        content: textParts.length > 0 ? textParts.map((p) => p.text).join('\n') : null,
        tool_calls: toolCalls,
      };

      if (thoughtParts.length > 0) {
        const reasoningContent = thoughtParts.map((p) => p.text).join('\n');
        if (reasoningContent) {
          message.reasoning_content = reasoningContent;
        }
      }

      messages.push(message);
      continue;
    }

    if (functionResponseParts.length > 0) {
      for (const part of functionResponseParts) {
        const resp = part.functionResponse!;
        messages.push({
          role: 'tool',
          tool_call_id: resp.id || `call_${Date.now()}`,
          name: resp.name,
          content: JSON.stringify(resp.response),
        });
      }
      continue;
    }

    if (textParts.length > 0 || thoughtParts.length > 0 || mediaParts.length > 0) {
      const messageContent = buildMessageContent(textParts, mediaParts);

      const message: any = {
        role,
        content: messageContent,
      };

      if (role === 'assistant' && thoughtParts.length > 0) {
        const reasoningContent = thoughtParts.map((p) => p.text).join('\n');
        if (reasoningContent) {
          message.reasoning_content = reasoningContent;
        }
      }

      messages.push(message);
    }
  }
}

function buildMessageContent(textParts: ContentPart[], mediaParts: ContentPart[]): string | any[] {
  if (mediaParts.length === 0) {
    return textParts.map((p) => p.text).join('\n');
  }

  const contentArray: any[] = [];

  for (const part of textParts) {
    if (part.text) {
      contentArray.push({
        type: 'text',
        text: part.text,
      });
    }
  }

  for (const part of mediaParts) {
    if (part.inlineData) {
      const mimeType = part.inlineData.mimeType;

      if (isImageMimeType(mimeType)) {
        const dataUri = `data:${mimeType};base64,${part.inlineData.data}`;
        contentArray.push({
          type: 'image_url',
          image_url: {
            url: dataUri,
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
        type: 'image_url',
        image_url: {
          url: part.fileData.fileUri,
        },
      });
    }
  }

  return contentArray;
}

function convertHistoryTextMode(history: Content[], messages: any[], mode: 'xml' | 'json'): void {
  for (const content of history) {
    const role = content.role === 'model' ? 'assistant' : content.role;

    const functionResponseParts = content.parts.filter((p) => p.functionResponse);
    const thoughtParts = content.parts.filter((p) => 'text' in p && p.thought === true);
    const mediaParts = content.parts.filter((p) => p.inlineData || p.fileData);

    if (functionResponseParts.length > 0) {
      const responseTextParts: ContentPart[] = [];

      for (const part of functionResponseParts) {
        const resp = part.functionResponse!;
        const responseText =
          mode === 'xml'
            ? convertFunctionResponseToXML(resp.name, resp.response)
            : convertFunctionResponseToJSON(resp.name, resp.response);
        responseTextParts.push({ text: responseText });
      }

      const messageContent = buildMessageContent(responseTextParts, mediaParts);
      messages.push({
        role: 'user',
        content: messageContent,
      });
      continue;
    }

    const textContentParts: ContentPart[] = [];

    for (const part of content.parts) {
      if (part.thought) continue;
      if (part.inlineData || part.fileData) continue;

      if (part.functionCall) {
        const callText =
          mode === 'xml'
            ? convertFunctionCallToXML(part.functionCall.name, part.functionCall.args)
            : convertFunctionCallToJSON(part.functionCall.name, part.functionCall.args);
        textContentParts.push({ text: callText });
        continue;
      }

      if ('text' in part && part.text) {
        textContentParts.push({ text: part.text });
      }
    }

    if (textContentParts.length > 0 || thoughtParts.length > 0 || mediaParts.length > 0) {
      const messageContent = buildMessageContent(textContentParts, mediaParts);

      const message: any = {
        role,
        content: messageContent,
      };

      if (role === 'assistant' && thoughtParts.length > 0) {
        const reasoningContent = thoughtParts.map((p) => p.text).join('\n');
        if (reasoningContent) {
          message.reasoning_content = reasoningContent;
        }
      }

      messages.push(message);
    }
  }
}

