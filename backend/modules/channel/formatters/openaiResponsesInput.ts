import type { Content } from '../../conversation/types';
import {
  decodeBase64ToUtf8,
  formatTextAttachment,
  formatUnsupportedAttachment,
  isImageMimeType,
  isTextMimeType
} from './inlineDataUtils';

export function convertToResponsesInput(history: Content[]): any[] {
  const input: any[] = [];

  for (const content of history) {
    const role = content.role === 'model' ? 'assistant' : content.role;

    let messageParts: any[] = [];

    const flushMessage = () => {
      if (messageParts.length > 0) {
        input.push({
          type: 'message',
          role,
          content: messageParts
        });
        messageParts = [];
      }
    };

    for (const part of content.parts) {
      if (part.thoughtSignatures?.['openai-responses']) {
        flushMessage();
        const reasoningItem: any = {
          type: 'reasoning',
          encrypted_content: part.thoughtSignatures['openai-responses'],
          content: null,
          summary: []
        };

        if ('text' in part && part.text) {
          reasoningItem.summary = [
            {
              type: 'summary_text',
              text: part.text
            }
          ];
        }

        input.push(reasoningItem);
        continue;
      }

      if (part.redactedThinking) {
        flushMessage();
        input.push({
          type: 'redacted_thinking',
          data: part.redactedThinking
        });
        continue;
      }

      if (part.thought) {
        continue;
      }

      if (part.functionCall) {
        flushMessage();
        input.push({
          type: 'function_call',
          name: part.functionCall.name,
          call_id: part.functionCall.id,
          arguments: typeof part.functionCall.args === 'string'
            ? part.functionCall.args
            : JSON.stringify(part.functionCall.args)
        });
        continue;
      }

      if (part.functionResponse) {
        flushMessage();
        input.push({
          type: 'function_call_output',
          call_id: part.functionResponse.id,
          output: typeof part.functionResponse.response === 'string'
            ? part.functionResponse.response
            : JSON.stringify(part.functionResponse.response)
        });

        if (part.functionResponse.parts && part.functionResponse.parts.length > 0) {
          const toolContentParts = part.functionResponse.parts
            .map(p => {
              if (!p.inlineData) {
                return null;
              }

              const mimeType = p.inlineData.mimeType;

              if (isImageMimeType(mimeType)) {
                return {
                  type: 'input_image',
                  image_url: `data:${mimeType};base64,${p.inlineData.data}`
                };
              }

              if (isTextMimeType(mimeType)) {
                const decoded = decodeBase64ToUtf8(p.inlineData.data);
                return {
                  type: 'input_text',
                  text: decoded !== null
                    ? formatTextAttachment({
                      mimeType,
                      text: decoded,
                      displayName: p.inlineData.displayName
                    })
                    : formatUnsupportedAttachment({
                      mimeType,
                      displayName: p.inlineData.displayName
                    })
                };
              }

              return {
                type: 'input_text',
                text: formatUnsupportedAttachment({
                  mimeType,
                  displayName: p.inlineData.displayName
                })
              };
            })
            .filter(p => p !== null);

          if (toolContentParts.length > 0) {
            input.push({
              type: 'message',
              role: 'user',
              content: toolContentParts
            });
          }
        }

        continue;
      }

      if (part.inlineData) {
        const mimeType = part.inlineData.mimeType;
        if (isImageMimeType(mimeType)) {
          messageParts.push({
            type: 'input_image',
            image_url: `data:${mimeType};base64,${part.inlineData.data}`
          });
          continue;
        }

        if (isTextMimeType(mimeType)) {
          const decoded = decodeBase64ToUtf8(part.inlineData.data);
          messageParts.push({
            type: role === 'assistant' ? 'output_text' : 'input_text',
            text: decoded !== null
              ? formatTextAttachment({
                mimeType,
                text: decoded,
                displayName: part.inlineData.displayName
              })
              : formatUnsupportedAttachment({
                mimeType,
                displayName: part.inlineData.displayName
              })
          });
          continue;
        }

        messageParts.push({
          type: role === 'assistant' ? 'output_text' : 'input_text',
          text: formatUnsupportedAttachment({
            mimeType,
            displayName: part.inlineData.displayName
          })
        });
        continue;
      }

      if (part.fileData) {
        messageParts.push({
          type: 'input_file',
          file_url: part.fileData.fileUri
        });
        continue;
      }

      if ('text' in part && part.text) {
        messageParts.push({
          type: role === 'assistant' ? 'output_text' : 'input_text',
          text: part.text
        });
      }
    }

    flushMessage();
  }

  return input;
}
