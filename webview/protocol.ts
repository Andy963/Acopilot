export type WebviewRequest = {
  type: string;
  requestId: string;
  data: unknown;
};

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

import type { AttachmentData } from '../backend/modules/api/chat/types';
import type { ContextInjectionOverrides, SelectionReference } from '../backend/modules/conversation/types';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parseWebviewRequest(message: unknown): WebviewRequest | null {
  if (!isRecord(message)) return null;
  const type = typeof message.type === 'string' ? message.type : undefined;
  const requestId = typeof message.requestId === 'string' ? message.requestId : undefined;
  if (!type || !requestId) return null;
  const data = Object.prototype.hasOwnProperty.call(message, 'data') ? message.data : undefined;
  return { type, requestId, data };
}

function ok<T>(value: T): ParseResult<T> {
  return { ok: true, value };
}

function err<T>(error: string): ParseResult<T> {
  return { ok: false, error };
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== 'number') return undefined;
  return Number.isFinite(value) ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

const ALLOWED_ATTACHMENT_TYPES = new Set(['image', 'video', 'audio', 'document', 'code']);

function parseAttachments(value: unknown): ParseResult<AttachmentData[] | undefined> {
  if (value === undefined) return ok(undefined);
  if (!Array.isArray(value)) return err('attachments must be an array');

  const attachments: AttachmentData[] = [];
  for (const item of value) {
    if (!isRecord(item)) return err('attachments items must be objects');
    const id = asString(item.id);
    const name = asString(item.name);
    const typeRaw = asString(item.type);
    const size = asFiniteNumber(item.size);
    const mimeType = asString(item.mimeType);
    const data = asString(item.data);
    const thumbnail = item.thumbnail === undefined ? undefined : asString(item.thumbnail);

    if (!id) return err('attachments[].id must be a string');
    if (!name) return err('attachments[].name must be a string');
    if (!typeRaw) return err('attachments[].type must be a string');
    if (!ALLOWED_ATTACHMENT_TYPES.has(typeRaw)) return err('attachments[].type must be one of: image, video, audio, document, code');
    if (size === undefined) return err('attachments[].size must be a finite number');
    if (!mimeType) return err('attachments[].mimeType must be a string');
    if (data === undefined) return err('attachments[].data must be a string');
    if (item.thumbnail !== undefined && thumbnail === undefined) return err('attachments[].thumbnail must be a string');

    attachments.push({ id, name, type: typeRaw as AttachmentData['type'], size, mimeType, data, thumbnail });
  }

  return ok(attachments);
}

function parseSelectionReferences(value: unknown): ParseResult<SelectionReference[] | undefined> {
  if (value === undefined) return ok(undefined);
  if (!Array.isArray(value)) return err('selectionReferences must be an array');

  const refs: SelectionReference[] = [];
  for (const item of value) {
    if (!isRecord(item)) return err('selectionReferences items must be objects');
    const path = asString(item.path);
    const text = asString(item.text);
    if (!path) return err('selectionReferences[].path must be a string');
    if (text === undefined) return err('selectionReferences[].text must be a string');
    refs.push(item as unknown as SelectionReference);
  }

  return ok(refs);
}

export type StreamMessageType =
  | 'chatStream'
  | 'retryStream'
  | 'editAndRetryStream'
  | 'toolConfirmation'
  | 'cancelStream';

export type ChatStreamPayload = {
  conversationId: string;
  configId: string;
  message: string;
  mode?: 'locate';
  attachments?: AttachmentData[];
  selectionReferences?: SelectionReference[];
  contextOverrides?: ContextInjectionOverrides;
  taskContext?: string;
};

export type RetryStreamPayload = {
  conversationId: string;
  configId: string;
};

export type EditAndRetryStreamPayload = {
  conversationId: string;
  messageIndex: number;
  newMessage: string;
  configId: string;
  attachments?: AttachmentData[];
};

export type ToolConfirmationStreamPayload = {
  conversationId: string;
  configId: string;
  toolResponses: Array<{ id: string; name: string; confirmed: boolean }>;
  annotation?: string;
};

export type CancelStreamPayload = {
  conversationId: string;
};

export type StreamPayloadByType = {
  chatStream: ChatStreamPayload;
  retryStream: RetryStreamPayload;
  editAndRetryStream: EditAndRetryStreamPayload;
  toolConfirmation: ToolConfirmationStreamPayload;
  cancelStream: CancelStreamPayload;
};

export function parseStreamPayload(type: 'chatStream', data: unknown): ParseResult<ChatStreamPayload>;
export function parseStreamPayload(type: 'retryStream', data: unknown): ParseResult<RetryStreamPayload>;
export function parseStreamPayload(type: 'editAndRetryStream', data: unknown): ParseResult<EditAndRetryStreamPayload>;
export function parseStreamPayload(type: 'toolConfirmation', data: unknown): ParseResult<ToolConfirmationStreamPayload>;
export function parseStreamPayload(type: 'cancelStream', data: unknown): ParseResult<CancelStreamPayload>;
export function parseStreamPayload(type: StreamMessageType, data: unknown): ParseResult<StreamPayloadByType[StreamMessageType]> {
  if (!isRecord(data)) return err(`${type} requires an object payload`);

  switch (type) {
    case 'cancelStream': {
      const conversationId = asString(data.conversationId);
      if (!conversationId) return err('cancelStream requires data.conversationId (string)');
      return ok({ conversationId });
    }
    case 'retryStream': {
      const conversationId = asString(data.conversationId);
      const configId = asString(data.configId);
      if (!conversationId) return err('retryStream requires data.conversationId (string)');
      if (!configId) return err('retryStream requires data.configId (string)');
      return ok({ conversationId, configId });
    }
    case 'editAndRetryStream': {
      const conversationId = asString(data.conversationId);
      const configId = asString(data.configId);
      const messageIndex = asFiniteNumber(data.messageIndex);
      const newMessage = asString(data.newMessage);
      if (!conversationId) return err('editAndRetryStream requires data.conversationId (string)');
      if (!configId) return err('editAndRetryStream requires data.configId (string)');
      if (messageIndex === undefined) return err('editAndRetryStream requires data.messageIndex (number)');
      if (newMessage === undefined) return err('editAndRetryStream requires data.newMessage (string)');

      const attachmentsResult = parseAttachments(data.attachments);
      if (attachmentsResult.ok === false) return err(`editAndRetryStream: ${attachmentsResult.error}`);

      return ok(
        { conversationId, configId, messageIndex, newMessage, attachments: attachmentsResult.value }
      );
    }
    case 'toolConfirmation': {
      const conversationId = asString(data.conversationId);
      const configId = asString(data.configId);
      const annotation = data.annotation === undefined || data.annotation === null ? undefined : asString(data.annotation);
      const toolResponsesRaw = data.toolResponses;
      if (!conversationId) return err('toolConfirmation requires data.conversationId (string)');
      if (!configId) return err('toolConfirmation requires data.configId (string)');
      if (data.annotation !== undefined && data.annotation !== null && annotation === undefined) {
        return err('toolConfirmation requires data.annotation (string) when provided');
      }
      if (!Array.isArray(toolResponsesRaw)) return err('toolConfirmation requires data.toolResponses (array)');

      const toolResponses: Array<{ id: string; name: string; confirmed: boolean }> = [];
      for (const item of toolResponsesRaw) {
        if (!isRecord(item)) return err('toolConfirmation toolResponses items must be objects');
        const id = asString(item.id);
        const name = asString(item.name);
        const confirmed = asBoolean(item.confirmed);
        if (!id) return err('toolConfirmation toolResponses[].id must be a string');
        if (!name) return err('toolConfirmation toolResponses[].name must be a string');
        if (confirmed === undefined) return err('toolConfirmation toolResponses[].confirmed must be a boolean');
        toolResponses.push({ id, name, confirmed });
      }

      return ok({ conversationId, configId, toolResponses, annotation });
    }
    case 'chatStream': {
      const conversationId = asString(data.conversationId);
      const configId = asString(data.configId);
      const message = asString(data.message);
      const mode = data.mode === undefined ? undefined : data.mode === 'locate' ? 'locate' : undefined;
      const taskContext = data.taskContext === undefined ? undefined : asString(data.taskContext);

      if (!conversationId) return err('chatStream requires data.conversationId (string)');
      if (!configId) return err('chatStream requires data.configId (string)');
      if (message === undefined) return err('chatStream requires data.message (string)');
      if (data.mode !== undefined && mode === undefined) return err('chatStream requires data.mode (\"locate\") when provided');
      if (data.taskContext !== undefined && taskContext === undefined) return err('chatStream requires data.taskContext (string) when provided');

      const attachmentsResult = parseAttachments(data.attachments);
      if (attachmentsResult.ok === false) return err(`chatStream: ${attachmentsResult.error}`);

      const selectionReferencesResult = parseSelectionReferences(data.selectionReferences);
      if (selectionReferencesResult.ok === false) return err(`chatStream: ${selectionReferencesResult.error}`);

      const contextOverrides =
        data.contextOverrides === undefined ? undefined : isRecord(data.contextOverrides) ? data.contextOverrides : undefined;
      if (data.contextOverrides !== undefined && contextOverrides === undefined) {
        return err('chatStream requires data.contextOverrides (object) when provided');
      }

      return ok({
        conversationId,
        configId,
        message,
        mode,
        attachments: attachmentsResult.value,
        selectionReferences: selectionReferencesResult.value,
        contextOverrides: contextOverrides as ContextInjectionOverrides | undefined,
        taskContext
      });
    }
  }
}
