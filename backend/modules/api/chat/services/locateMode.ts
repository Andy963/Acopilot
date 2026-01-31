import type { ConversationManager } from '../../../conversation/ConversationManager';
import type { SettingsManager } from '../../../settings/SettingsManager';
import type { ContextInjectionOverrides } from '../../../conversation/types';
import {
  LOCATE_CARRYOVER_METADATA_KEY,
  buildLocateCarryoverTaskContext,
  createLocateCarryoverState,
  parseLocateCarryoverState,
} from './locateCarryover';

export const LOCATE_TOOL_ALLOWLIST = [
  'search_in_files',
  'find_files',
  'read_file',
  'get_errors',
  'get_usages',
  'open_file',
] as const;

export const LOCATE_TASK_CONTEXT = [
  'LOCATE MODE:',
  '- Goal: quickly locate the relevant file/line and open it.',
  '- Do NOT modify code and do NOT propose patches.',
  '- Use tools (read/search/lsp) to narrow down the location.',
  '- Once confident, call open_file(path, start_line, start_column) to open the best match.',
  '- After opening, reply with a short note of what you opened (file:line) and wait for the user to edit.',
].join('\n');

export type LocateModeResolution =
  | {
      ok: true;
      effectiveMessage: string;
      effectiveContextOverrides: ContextInjectionOverrides | undefined;
      effectiveTaskContext: string | undefined;
    }
  | { ok: false; error: { code: 'LOCATE_DISABLED'; message: string } };

async function applyPendingLocateCarryover(input: {
  conversationManager: ConversationManager;
  conversationId: string;
  isLocateMode: boolean;
  taskContext: string | undefined;
}): Promise<string | undefined> {
  if (input.isLocateMode) return input.taskContext;

  const raw = await input.conversationManager.getCustomMetadata(input.conversationId, LOCATE_CARRYOVER_METADATA_KEY);
  const state = parseLocateCarryoverState(raw);
  if (!state || !state.pending) return input.taskContext;

  const carryoverBlock = buildLocateCarryoverTaskContext(state);
  const nextTaskContext = [carryoverBlock, input.taskContext?.trim() ? input.taskContext.trim() : '']
    .filter(Boolean)
    .join('\n\n');

  await input.conversationManager.setCustomMetadata(input.conversationId, LOCATE_CARRYOVER_METADATA_KEY, {
    ...state,
    pending: false,
    updatedAt: Date.now(),
  });

  return nextTaskContext;
}

export async function resolveLocateModeParams(input: {
  conversationManager: ConversationManager;
  settingsManager: SettingsManager | undefined;
  conversationId: string;
  mode: string | undefined;
  message: string | undefined;
  contextOverrides: ContextInjectionOverrides | undefined;
  taskContext: string | undefined;
}): Promise<LocateModeResolution> {
  const isLocateMode = input.mode === 'locate';
  const rawMessage = String(input.message || '');
  const effectiveMessage = isLocateMode ? rawMessage.replace(/^\s*\/locate\b\s*/i, '') : rawMessage;

  let effectiveContextOverrides = input.contextOverrides;
  let effectiveTaskContext = input.taskContext;

  if (isLocateMode) {
    if (input.settingsManager && input.settingsManager.isToolEnabled('locate') === false) {
      return { ok: false, error: { code: 'LOCATE_DISABLED', message: 'Locate is disabled in settings.' } };
    }

    const locateModel = (() => {
      const cfg = input.settingsManager?.getToolsConfig?.();
      const raw = (cfg as any)?.locate?.model;
      return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
    })();

    effectiveContextOverrides = {
      ...(effectiveContextOverrides || {}),
      mode: 'locate',
      includeTools: true,
      toolAllowList: [...LOCATE_TOOL_ALLOWLIST],
      ...(locateModel ? { modelOverride: locateModel } : {}),
    };

    const userTaskContext =
      typeof effectiveTaskContext === 'string' && effectiveTaskContext.trim() ? effectiveTaskContext.trim() : '';
    effectiveTaskContext = [LOCATE_TASK_CONTEXT, userTaskContext].filter(Boolean).join('\n\n');

    const carryover = createLocateCarryoverState(effectiveMessage);
    if (carryover) {
      await input.conversationManager.setCustomMetadata(input.conversationId, LOCATE_CARRYOVER_METADATA_KEY, carryover);
    }
  }

  effectiveTaskContext = await applyPendingLocateCarryover({
    conversationManager: input.conversationManager,
    conversationId: input.conversationId,
    isLocateMode,
    taskContext: effectiveTaskContext,
  });

  return {
    ok: true,
    effectiveMessage,
    effectiveContextOverrides,
    effectiveTaskContext,
  };
}

