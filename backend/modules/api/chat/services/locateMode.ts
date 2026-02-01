import type { ConversationManager } from '../../../conversation/ConversationManager';
import type { SettingsManager } from '../../../settings/SettingsManager';
import type { LocateToolConfig } from '../../../settings/types';
import { DEFAULT_LOCATE_CONFIG } from '../../../settings/types';
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

const LOCATE_SLASH_PREFIX = /^\s*\/locate\b/i;

const LOCATE_EDIT_INTENT_KEYWORDS = [
  'fix',
  'modify',
  'change',
  'update',
  'edit',
  'implement',
  'refactor',
  'add',
  'remove',
  'delete',
  'rename',
  'rewrite',
  'patch',
  'apply',
  'write',
  'create',
  'replace',
  'bug',
  '\u4fee\u590d',
  '\u4fee\u6539',
  '\u5b9e\u73b0',
  '\u91cd\u6784',
  '\u6539',
  '\u5220\u9664',
  '\u66ff\u6362',
  '\u589e\u52a0',
  '\u6dfb\u52a0'
] as const;

function normalizeForMatch(value: string): string {
  return String(value || '').toLowerCase();
}

function hasAnyKeyword(haystack: string, keywords: readonly string[]): boolean {
  const text = normalizeForMatch(haystack);
  for (const raw of keywords) {
    const k = String(raw || '').trim();
    if (!k) continue;
    if (text.includes(k.toLowerCase())) return true;
  }
  return false;
}

function getLocateConfig(settingsManager: SettingsManager | undefined): LocateToolConfig {
  if (!settingsManager) return DEFAULT_LOCATE_CONFIG;
  return settingsManager.getLocateConfig();
}

function shouldAutoEnterLocateMode(message: string, config: LocateToolConfig): boolean {
  if (config.autoTriggerEnabled === false) return false;

  const raw = String(message || '');
  const trimmed = raw.trim();
  if (!trimmed) return false;

  // Do not infer locate mode for other slash commands.
  if (/^\s*\/\w+/.test(trimmed)) return false;

  if (hasAnyKeyword(trimmed, LOCATE_EDIT_INTENT_KEYWORDS)) return false;

  const keywords = Array.isArray(config.triggerKeywords) ? config.triggerKeywords : [];
  if (keywords.length === 0) return false;

  return hasAnyKeyword(trimmed, keywords);
}

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
  const rawMessage = String(input.message || '');

  const locateConfig = getLocateConfig(input.settingsManager);
  const locateToolEnabled = input.settingsManager ? input.settingsManager.isToolEnabled('locate') !== false : true;

  const explicitLocateMode = input.mode === 'locate' || LOCATE_SLASH_PREFIX.test(rawMessage);
  const inferredLocateMode = !explicitLocateMode && locateToolEnabled && shouldAutoEnterLocateMode(rawMessage, locateConfig);
  const isLocateMode = explicitLocateMode || inferredLocateMode;

  if (explicitLocateMode && !locateToolEnabled) {
    return { ok: false, error: { code: 'LOCATE_DISABLED', message: 'Locate is disabled in settings.' } };
  }

  const effectiveMessage = LOCATE_SLASH_PREFIX.test(rawMessage)
    ? rawMessage.replace(/^\s*\/locate\b\s*/i, '')
    : rawMessage;

  let effectiveContextOverrides = input.contextOverrides;
  let effectiveTaskContext = input.taskContext;

  if (isLocateMode) {
    const locateModel = (() => {
      const raw = locateConfig.model;
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
