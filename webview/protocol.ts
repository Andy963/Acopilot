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
  chatMode?: 'chat' | 'plan' | 'agent';
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

export type GuardedHandlerMessageType =
  | 'validation.runCommand'
  | 'storagePath.migrate'
  | 'tools.setToolEnabled'
  | 'tools.updateToolConfig'
  | 'tools.setToolAutoExec'
  | 'tools.updateMaxToolIterations'
  | 'tools.updateListFilesConfig'
  | 'tools.updateFindFilesConfig'
  | 'tools.updateSearchInFilesConfig'
  | 'tools.updateApplyDiffConfig'
  | 'tools.updateExecuteCommandConfig';

export type ValidationRunCommandPayload = {
  conversationId: string;
  toolCallId: string;
  command: string;
  cwd?: string;
  shell?: string;
  timeout?: number;
  presetId?: string;
  presetLabel?: string;
};

export type StoragePathMigratePayload = {
  path: string;
};

export type ToolEnabledPayload = {
  toolName: string;
  enabled: boolean;
};

export type ToolAutoExecPayload = {
  toolName: string;
  autoExec: boolean;
};

export type ToolConfigUpdatePayload = {
  toolName: string;
  config: Record<string, unknown>;
};

export type MaxToolIterationsPayload = {
  maxIterations: number;
};

export type ConfigUpdatePayload = {
  config: Record<string, unknown>;
};

export type GuardedHandlerPayloadByType = {
  'validation.runCommand': ValidationRunCommandPayload;
  'storagePath.migrate': StoragePathMigratePayload;
  'tools.setToolEnabled': ToolEnabledPayload;
  'tools.updateToolConfig': ToolConfigUpdatePayload;
  'tools.setToolAutoExec': ToolAutoExecPayload;
  'tools.updateMaxToolIterations': MaxToolIterationsPayload;
  'tools.updateListFilesConfig': ConfigUpdatePayload;
  'tools.updateFindFilesConfig': ConfigUpdatePayload;
  'tools.updateSearchInFilesConfig': ConfigUpdatePayload;
  'tools.updateApplyDiffConfig': ConfigUpdatePayload;
  'tools.updateExecuteCommandConfig': ConfigUpdatePayload;
};

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function parseConfigUpdatePayload(type: string, data: unknown): ParseResult<ConfigUpdatePayload> {
  if (!isRecord(data)) return err(`${type} requires an object payload`);
  if (!isRecord(data.config)) return err(`${type} requires data.config (object)`);
  return ok({ config: data.config });
}

export function parseGuardedHandlerPayload(
  type: 'validation.runCommand',
  data: unknown
): ParseResult<ValidationRunCommandPayload>;
export function parseGuardedHandlerPayload(
  type: 'storagePath.migrate',
  data: unknown
): ParseResult<StoragePathMigratePayload>;
export function parseGuardedHandlerPayload(
  type: 'tools.setToolEnabled',
  data: unknown
): ParseResult<ToolEnabledPayload>;
export function parseGuardedHandlerPayload(
  type: 'tools.updateToolConfig',
  data: unknown
): ParseResult<ToolConfigUpdatePayload>;
export function parseGuardedHandlerPayload(
  type: 'tools.setToolAutoExec',
  data: unknown
): ParseResult<ToolAutoExecPayload>;
export function parseGuardedHandlerPayload(
  type: 'tools.updateMaxToolIterations',
  data: unknown
): ParseResult<MaxToolIterationsPayload>;
export function parseGuardedHandlerPayload(
  type: 'tools.updateListFilesConfig',
  data: unknown
): ParseResult<ConfigUpdatePayload>;
export function parseGuardedHandlerPayload(
  type: 'tools.updateFindFilesConfig',
  data: unknown
): ParseResult<ConfigUpdatePayload>;
export function parseGuardedHandlerPayload(
  type: 'tools.updateSearchInFilesConfig',
  data: unknown
): ParseResult<ConfigUpdatePayload>;
export function parseGuardedHandlerPayload(
  type: 'tools.updateApplyDiffConfig',
  data: unknown
): ParseResult<ConfigUpdatePayload>;
export function parseGuardedHandlerPayload(
  type: 'tools.updateExecuteCommandConfig',
  data: unknown
): ParseResult<ConfigUpdatePayload>;
export function parseGuardedHandlerPayload(
  type: string,
  data: unknown
): ParseResult<Record<string, unknown>> | null;
export function parseGuardedHandlerPayload(type: string, data: unknown): ParseResult<Record<string, unknown>> | null {
  switch (type) {
    case 'validation.runCommand': {
      if (!isRecord(data)) return err(`${type} requires an object payload`);
      const conversationId = asNonEmptyString(data.conversationId);
      const toolCallId = asNonEmptyString(data.toolCallId);
      const command = asNonEmptyString(data.command);
      const cwd = data.cwd === undefined ? undefined : asString(data.cwd);
      const shell = data.shell === undefined ? undefined : asString(data.shell);
      const timeout = data.timeout === undefined ? undefined : asFiniteNumber(data.timeout);
      const presetId = data.presetId === undefined ? undefined : asString(data.presetId);
      const presetLabel = data.presetLabel === undefined ? undefined : asString(data.presetLabel);

      if (!conversationId) return err(`${type} requires data.conversationId (string)`);
      if (!toolCallId) return err(`${type} requires data.toolCallId (string)`);
      if (!command) return err(`${type} requires data.command (string)`);
      if (data.cwd !== undefined && cwd === undefined) return err(`${type} requires data.cwd (string) when provided`);
      if (data.shell !== undefined && shell === undefined) return err(`${type} requires data.shell (string) when provided`);
      if (data.timeout !== undefined && timeout === undefined) return err(`${type} requires data.timeout (number) when provided`);
      if (data.presetId !== undefined && presetId === undefined) return err(`${type} requires data.presetId (string) when provided`);
      if (data.presetLabel !== undefined && presetLabel === undefined) return err(`${type} requires data.presetLabel (string) when provided`);

      return ok({ conversationId, toolCallId, command, cwd, shell, timeout, presetId, presetLabel });
    }
    case 'storagePath.migrate': {
      if (!isRecord(data)) return err(`${type} requires an object payload`);
      const targetPath = asNonEmptyString(data.path);
      if (!targetPath) return err(`${type} requires data.path (string)`);
      return ok({ path: targetPath });
    }
    case 'tools.setToolEnabled': {
      if (!isRecord(data)) return err(`${type} requires an object payload`);
      const toolName = asNonEmptyString(data.toolName);
      const enabled = asBoolean(data.enabled);
      if (!toolName) return err(`${type} requires data.toolName (string)`);
      if (enabled === undefined) return err(`${type} requires data.enabled (boolean)`);
      return ok({ toolName, enabled });
    }
    case 'tools.updateToolConfig': {
      if (!isRecord(data)) return err(`${type} requires an object payload`);
      const toolName = asNonEmptyString(data.toolName);
      if (!toolName) return err(`${type} requires data.toolName (string)`);
      if (!isRecord(data.config)) return err(`${type} requires data.config (object)`);
      return ok({ toolName, config: data.config });
    }
    case 'tools.setToolAutoExec': {
      if (!isRecord(data)) return err(`${type} requires an object payload`);
      const toolName = asNonEmptyString(data.toolName);
      const autoExec = asBoolean(data.autoExec);
      if (!toolName) return err(`${type} requires data.toolName (string)`);
      if (autoExec === undefined) return err(`${type} requires data.autoExec (boolean)`);
      return ok({ toolName, autoExec });
    }
    case 'tools.updateMaxToolIterations': {
      if (!isRecord(data)) return err(`${type} requires an object payload`);
      const maxIterations = asFiniteNumber(data.maxIterations);
      if (maxIterations === undefined) return err(`${type} requires data.maxIterations (number)`);
      return ok({ maxIterations });
    }
    case 'tools.updateListFilesConfig':
    case 'tools.updateFindFilesConfig':
    case 'tools.updateSearchInFilesConfig':
    case 'tools.updateApplyDiffConfig':
    case 'tools.updateExecuteCommandConfig':
      return parseConfigUpdatePayload(type, data);
    default:
      return null;
  }
}

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
      const chatMode =
        data.chatMode === undefined
          ? undefined
          : data.chatMode === 'chat' || data.chatMode === 'plan' || data.chatMode === 'agent'
            ? data.chatMode
            : undefined;
      const taskContext = data.taskContext === undefined ? undefined : asString(data.taskContext);

      if (!conversationId) return err('chatStream requires data.conversationId (string)');
      if (!configId) return err('chatStream requires data.configId (string)');
      if (message === undefined) return err('chatStream requires data.message (string)');
      if (data.chatMode !== undefined && chatMode === undefined) {
        return err('chatStream requires data.chatMode ("chat" | "plan" | "agent") when provided');
      }
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
        chatMode,
        attachments: attachmentsResult.value,
        selectionReferences: selectionReferencesResult.value,
        contextOverrides: contextOverrides as ContextInjectionOverrides | undefined,
        taskContext
      });
    }
  }
}
