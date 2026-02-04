import type { Content, ContentPart } from '../../../conversation/types';
import { convertFunctionCallToXML, convertFunctionResponseToXML } from '../../../../tools/xmlFormatter';
import { convertFunctionCallToJSON, convertFunctionResponseToJSON } from '../../../../tools/jsonFormatter';
import { decodeBase64ToUtf8, formatTextAttachment, isTextMimeType } from '../inlineDataUtils';

const VALID_CONTENT_ROLES = new Set(['user', 'model']);

export function sanitizeContents(contents: unknown): Content[] {
  if (!Array.isArray(contents)) {
    return [];
  }

  const cleaned: Content[] = [];
  for (const item of contents) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const rawRole = (item as any).role;
    const role = typeof rawRole === 'string' ? rawRole.trim().toLowerCase() : '';
    if (!VALID_CONTENT_ROLES.has(role)) {
      continue;
    }

    const rawParts = (item as any).parts;
    if (!Array.isArray(rawParts)) {
      continue;
    }

    const parts: ContentPart[] = [];
    for (const rawPart of rawParts) {
      if (!rawPart || typeof rawPart !== 'object') {
        continue;
      }

      const part: ContentPart = {};

      const text = (rawPart as any).text;
      if (typeof text === 'string') {
        part.text = text;
      }

      const inlineData = (rawPart as any).inlineData;
      if (inlineData && typeof inlineData === 'object') {
        const mimeType = (inlineData as any).mimeType;
        const data = (inlineData as any).data;
        if (typeof mimeType === 'string' && typeof data === 'string') {
          part.inlineData = { mimeType, data };
          const displayName = (inlineData as any).displayName;
          if (typeof displayName === 'string' && displayName.trim()) {
            part.inlineData.displayName = displayName;
          }
        }
      }

      const fileData = (rawPart as any).fileData;
      if (fileData && typeof fileData === 'object') {
        part.fileData = { ...(fileData as any) };
      }

      const functionCall = (rawPart as any).functionCall;
      if (functionCall && typeof functionCall === 'object') {
        const name = (functionCall as any).name;
        const args = (functionCall as any).args;
        if (typeof name === 'string' && name.trim()) {
          part.functionCall = {
            name: name.trim(),
            args: args ?? {},
          };
        }
      }

      const functionResponse = (rawPart as any).functionResponse;
      if (functionResponse && typeof functionResponse === 'object') {
        const name = (functionResponse as any).name;
        const responseValue = (functionResponse as any).response;
        if (typeof name === 'string' && name.trim()) {
          part.functionResponse = {
            name: name.trim(),
            response: responseValue && typeof responseValue === 'object' ? responseValue : { output: responseValue },
          };
        }
      }

      const thoughtSignature = (rawPart as any).thoughtSignature;
      if (typeof thoughtSignature === 'string' && thoughtSignature.trim()) {
        (part as any).thoughtSignature = thoughtSignature;
      }

      const thought = (rawPart as any).thought;
      if (thought !== undefined) {
        (part as any).thought = thought;
      }

      if (Object.keys(part).length > 0) {
        parts.push(part);
      }
    }

    if (parts.length === 0) {
      continue;
    }

    cleaned.push({
      role: role as 'user' | 'model',
      parts,
    });
  }

  return cleaned;
}

export function normalizeHistoryRoles(history: Content[]): Content[] {
  const normalized = history
    .map((content) => {
      const rawRole = (content as any).role;
      const roleKey = typeof rawRole === 'string' ? rawRole.trim().toLowerCase() : rawRole;

      let role: 'user' | 'model' | null = null;
      if (roleKey === 'user' || roleKey === 'model') {
        role = roleKey;
      } else if (roleKey === 'assistant' || roleKey === 'bot' || roleKey === 'ai') {
        role = 'model';
      } else if (roleKey === 'human') {
        role = 'user';
      }

      if (!role) {
        return null;
      }

      return {
        ...content,
        role,
      } as Content;
    })
    .filter((c): c is Content => c !== null);

  const firstUserIndex = normalized.findIndex((m) => m.role === 'user');
  const normalizedFromUser = firstUserIndex >= 0 ? normalized.slice(firstUserIndex) : normalized;

  const coalesced: Content[] = [];
  for (const message of normalizedFromUser) {
    const last = coalesced[coalesced.length - 1];
    if (!last || last.role !== message.role) {
      coalesced.push(message);
      continue;
    }

    coalesced[coalesced.length - 1] = {
      ...last,
      parts: [...(last.parts || []), ...(message.parts || [])],
    };
  }

  return coalesced;
}

export function convertTextInlineDataToTextParts(history: Content[]): Content[] {
  return history.map((content) => ({
    ...content,
    parts: content.parts.flatMap((part) => {
      if (!part.inlineData) {
        return [part];
      }

      const mimeType = part.inlineData.mimeType;
      if (!isTextMimeType(mimeType)) {
        return [part];
      }

      const decoded = decodeBase64ToUtf8(part.inlineData.data);
      if (decoded === null) {
        return [part];
      }

      return [
        {
          text: formatTextAttachment({
            mimeType,
            text: decoded,
            displayName: part.inlineData.displayName,
          }),
        },
      ];
    }),
  }));
}

export function convertGeminiThoughtSignatures(history: Content[]): Content[] {
  return history.map((content) => ({
    role: content.role,
    parts: content.parts.map((part) => {
      if (part.thoughtSignatures?.gemini) {
        const { thoughtSignatures, ...restPart } = part;
        return {
          ...restPart,
          thoughtSignature: thoughtSignatures.gemini,
        };
      }

      if (part.thoughtSignatures) {
        const { thoughtSignatures, ...restPart } = part;
        return restPart;
      }

      return part;
    }),
  }));
}

export function convertHistoryToXMLMode(history: Content[]): Content[] {
  return history.map((content) => {
    const newParts: ContentPart[] = [];

    for (const part of content.parts) {
      if (part.functionCall) {
        const xmlText = convertFunctionCallToXML(part.functionCall.name, part.functionCall.args);
        newParts.push({ text: xmlText });
        continue;
      }

      if (part.functionResponse) {
        const xmlText = convertFunctionResponseToXML(part.functionResponse.name, part.functionResponse.response);
        newParts.push({ text: xmlText });

        if (part.functionResponse.parts && part.functionResponse.parts.length > 0) {
          for (const responsePart of part.functionResponse.parts) {
            if (responsePart.inlineData || responsePart.fileData) {
              newParts.push(responsePart);
            }
          }
        }
        continue;
      }

      newParts.push(part);
    }

    return {
      ...content,
      parts: newParts,
    };
  });
}

export function convertHistoryToJSONMode(history: Content[]): Content[] {
  return history.map((content) => {
    const newParts: ContentPart[] = [];

    for (const part of content.parts) {
      if (part.functionCall) {
        const jsonText = convertFunctionCallToJSON(part.functionCall.name, part.functionCall.args);
        newParts.push({ text: jsonText });
        continue;
      }

      if (part.functionResponse) {
        const jsonText = convertFunctionResponseToJSON(part.functionResponse.name, part.functionResponse.response);
        newParts.push({ text: jsonText });

        if (part.functionResponse.parts && part.functionResponse.parts.length > 0) {
          for (const responsePart of part.functionResponse.parts) {
            if (responsePart.inlineData || responsePart.fileData) {
              newParts.push(responsePart);
            }
          }
        }
        continue;
      }

      newParts.push(part);
    }

    return {
      ...content,
      parts: newParts,
    };
  });
}

