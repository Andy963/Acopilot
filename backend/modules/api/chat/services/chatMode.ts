import type { ContextInjectionOverrides } from '../../../conversation/types';
import type { ChatMode } from '../types';

export const CHAT_MODE_TOOL_ALLOWLIST = [
  'search_in_files',
  'find_files',
  'read_file',
  'open_file',
  'get_symbols',
  'get_usages',
  'get_errors',
  'goto_definition',
  'find_references',
] as const;

export const CHAT_MODE_TASK_CONTEXT = [
  'CHAT MODE:',
  '- Answer the user directly.',
  '- Use tools only when necessary.',
  '- Prefer minimal reads; do not explore the codebase unless required.',
  '- Do not modify files or call write_file, apply_diff, delete_file, replace_in_files, or execute_command.',
].join('\n');

export const PLAN_MODE_TASK_CONTEXT = [
  'PLAN MODE:',
  '- Produce a concrete, step-by-step plan with clear checkpoints.',
  '- Do not propose patches or code changes yet; wait for confirmation.',
  '- You may use read-only tools if needed to understand the codebase.',
  '- Do not modify files or call write_file, apply_diff, delete_file, replace_in_files, or execute_command.',
].join('\n');

function normalizeTaskContext(value: string | undefined): string {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function intersectAllowLists(a: string[] | undefined, b: string[] | undefined): string[] | undefined {
  const aList = Array.isArray(a) ? a.filter((n) => typeof n === 'string' && n.trim()).map((n) => n.trim()) : [];
  const bList = Array.isArray(b) ? b.filter((n) => typeof n === 'string' && n.trim()).map((n) => n.trim()) : [];

  if (aList.length === 0 && bList.length === 0) return undefined;
  if (aList.length === 0) return bList;
  if (bList.length === 0) return aList;

  const allowSet = new Set(aList);
  return bList.filter((n) => allowSet.has(n));
}

function clampBooleanWithPolicy(
  requested: boolean | undefined,
  policy: boolean | undefined
): boolean | undefined {
  if (policy === undefined) return requested;
  if (policy === false) return false;
  return requested === false ? false : true;
}

export interface ChatModePolicyResult {
  chatMode: ChatMode;
  effectiveContextOverrides: ContextInjectionOverrides | undefined;
  effectiveTaskContext: string | undefined;
  maxToolIterations?: number;
}

function getPolicyForMode(chatMode: ChatMode): {
  contextOverrides?: ContextInjectionOverrides;
  taskContextPrefix?: string;
  maxToolIterations?: number;
} {
  if (chatMode === 'chat') {
    return {
      contextOverrides: {
        includeWorkspaceFiles: false,
        includeOpenTabs: false,
        includeActiveEditor: false,
        includeDiagnostics: false,
        includeTools: true,
        toolAllowList: [...CHAT_MODE_TOOL_ALLOWLIST],
      },
      taskContextPrefix: CHAT_MODE_TASK_CONTEXT,
      maxToolIterations: undefined,
    };
  }

  if (chatMode === 'plan') {
    return {
      contextOverrides: {
        includeWorkspaceFiles: true,
        includeOpenTabs: true,
        includeActiveEditor: true,
        includeDiagnostics: true,
        includeTools: true,
        toolAllowList: [...CHAT_MODE_TOOL_ALLOWLIST],
      },
      taskContextPrefix: PLAN_MODE_TASK_CONTEXT,
      maxToolIterations: undefined,
    };
  }

  return {
    contextOverrides: undefined,
    taskContextPrefix: undefined,
    maxToolIterations: undefined,
  };
}

export function resolveChatModePolicy(input: {
  chatMode: ChatMode;
  contextOverrides: ContextInjectionOverrides | undefined;
  taskContext: string | undefined;
}): ChatModePolicyResult {
  const policy = getPolicyForMode(input.chatMode);
  const userOverrides = input.contextOverrides || undefined;

  const effective: ContextInjectionOverrides | undefined = (() => {
    const policyOverrides = policy.contextOverrides;
    if (!policyOverrides && !userOverrides) return undefined;

    const next: ContextInjectionOverrides = { ...(userOverrides || {}) };

    next.includeWorkspaceFiles = clampBooleanWithPolicy(next.includeWorkspaceFiles, policyOverrides?.includeWorkspaceFiles);
    next.includeOpenTabs = clampBooleanWithPolicy(next.includeOpenTabs, policyOverrides?.includeOpenTabs);
    next.includeActiveEditor = clampBooleanWithPolicy(next.includeActiveEditor, policyOverrides?.includeActiveEditor);
    next.includeDiagnostics = clampBooleanWithPolicy(next.includeDiagnostics, policyOverrides?.includeDiagnostics);
    next.includeTools = clampBooleanWithPolicy(next.includeTools, policyOverrides?.includeTools);

    if (policyOverrides?.toolAllowList || next.toolAllowList) {
      next.toolAllowList = intersectAllowLists(policyOverrides?.toolAllowList, next.toolAllowList);
    }

    return next;
  })();

  const effectiveTaskContext = (() => {
    const prefix = normalizeTaskContext(policy.taskContextPrefix);
    const user = normalizeTaskContext(input.taskContext);
    const combined = [prefix, user].filter(Boolean).join('\n\n');
    return combined ? combined : undefined;
  })();

  return {
    chatMode: input.chatMode,
    effectiveContextOverrides: effective,
    effectiveTaskContext,
    maxToolIterations: policy.maxToolIterations,
  };
}
