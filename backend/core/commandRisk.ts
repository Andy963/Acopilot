export type CommandRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type CommandRiskCategory =
  | 'destructive'
  | 'gitHistory'
  | 'privilege'
  | 'network'
  | 'unknown';

export interface CommandRiskAssessment {
  level: CommandRiskLevel;
  categories: CommandRiskCategory[];
  reasons: string[];
  matchedDenyPattern?: string;
  matchedAllowPattern?: string;
}

export interface ExecuteCommandRiskPolicy {
  enabled: boolean;
  autoExecuteUpTo: CommandRiskLevel;
  confirmOn: {
    destructive: boolean;
    gitHistory: boolean;
    privilege: boolean;
    network: boolean;
  };
  allowPatterns: string[];
  denyPatterns: string[];
}

export const DEFAULT_EXECUTE_COMMAND_RISK_POLICY: ExecuteCommandRiskPolicy = {
  enabled: true,
  autoExecuteUpTo: 'low',
  confirmOn: {
    destructive: true,
    gitHistory: true,
    privilege: true,
    network: true,
  },
  allowPatterns: [],
  denyPatterns: [],
};

function safeRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, 'i');
  } catch {
    return null;
  }
}

function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function hasAnyCategory(policy: ExecuteCommandRiskPolicy, categories: CommandRiskCategory[]): boolean {
  if (policy.confirmOn.destructive && categories.includes('destructive')) return true;
  if (policy.confirmOn.gitHistory && categories.includes('gitHistory')) return true;
  if (policy.confirmOn.privilege && categories.includes('privilege')) return true;
  if (policy.confirmOn.network && categories.includes('network')) return true;
  return false;
}

function normalizeCommand(command: string): string {
  return (command || '').trim();
}

function computeRiskFromCommand(command: string): Omit<CommandRiskAssessment, 'matchedAllowPattern' | 'matchedDenyPattern'> {
  const cmd = normalizeCommand(command);
  const lower = cmd.toLowerCase();

  const categories: CommandRiskCategory[] = [];
  const reasons: string[] = [];

  const hasSudo = /(^|\s)(sudo)\b/.test(lower);
  if (hasSudo) {
    categories.push('privilege');
    reasons.push('includes sudo');
  }

  const hasNetwork =
    /(^|\s)(curl|wget)\b/.test(lower) ||
    /\b(npm|pnpm|yarn|pip|pip3)\s+(install|add)\b/.test(lower) ||
    /\bgit\s+clone\b/.test(lower);
  if (hasNetwork) {
    categories.push('network');
    reasons.push('downloads or installs dependencies');
  }

  const hasRedirection = /(^|[^<])>\s*\S/.test(cmd);
  if (hasRedirection) {
    categories.push('destructive');
    reasons.push('uses output redirection (>)');
  }

  const isRm = /(^|\s)rm\b/.test(lower);
  const isWindowsDelete = /(^|\s)(del|erase)\b/.test(lower);
  const isRmdir = /(^|\s)rmdir\b/.test(lower);
  const isGitRestore = /\bgit\s+restore\b/.test(lower);
  const isGitResetHard = /\bgit\s+reset\b/.test(lower) && /\s--hard(\s|$)/.test(lower);
  const isGitClean = /\bgit\s+clean\b/.test(lower) && /\s-[^\n]*f/.test(lower);
  const isGitPushForce = /\bgit\s+push\b/.test(lower) && /\s--force(\s|$)/.test(lower);

  if (isRm || isWindowsDelete || isRmdir) {
    categories.push('destructive');
    reasons.push('deletes files');
  }
  if (isGitRestore) {
    categories.push('destructive');
    reasons.push('git restore can discard changes');
  }
  if (isGitResetHard || isGitClean || isGitPushForce) {
    categories.push('gitHistory');
    reasons.push('git history/working tree destructive operation');
  }

  // Determine level (simple MVP scoring)
  let level: CommandRiskLevel = 'low';

  const isCurlPipeSh = /\b(curl|wget)\b[^|]*\|\s*\b(sh|bash|zsh|pwsh|powershell)\b/.test(lower);
  if (isCurlPipeSh) {
    level = 'critical';
    categories.push('network');
    reasons.push('pipes network output to a shell');
  }

  const hasForceDeleteFlag =
    (isRm && /(^|\s)-[^\n]*f/.test(lower)) ||
    (isRmdir && /\s\/s(\s|$)/.test(lower)) ||
    (isWindowsDelete && /\s\/f(\s|$)/.test(lower));
  const hasRecursiveFlag =
    (isRm && /(^|\s)-[^\n]*r/.test(lower)) ||
    (isRmdir && /\s\/s(\s|$)/.test(lower));

  const targetsRootLike =
    /\brm\b[^\n]*\s\/(\s|$)/.test(lower) ||
    /\brm\b[^\n]*\s~(\s|$)/.test(lower) ||
    /\brm\b[^\n]*\s\.\.(\s|$)/.test(lower) ||
    /\brmdir\b[^\n]*\s(c:\\|\\)(\s|$)/.test(lower) ||
    /\bdel\b[^\n]*\s(c:\\|\\)(\s|$)/.test(lower);

  if (targetsRootLike && (hasForceDeleteFlag || hasRecursiveFlag)) {
    level = 'critical';
    reasons.push('targets root-like path with recursive/force flags');
  } else if (isGitPushForce || isGitResetHard || isGitClean) {
    level = 'high';
  } else if ((isRm || isRmdir || isWindowsDelete) && (hasForceDeleteFlag || hasRecursiveFlag)) {
    level = 'high';
  } else if (isGitRestore || hasRedirection) {
    level = 'medium';
  } else if (hasSudo || hasNetwork) {
    level = 'medium';
  }

  return {
    level,
    categories: uniq(categories),
    reasons: uniq(reasons),
  };
}

export function assessExecuteCommandRisk(command: string, policy?: Partial<ExecuteCommandRiskPolicy>): CommandRiskAssessment {
  const effectivePolicy: ExecuteCommandRiskPolicy = {
    ...DEFAULT_EXECUTE_COMMAND_RISK_POLICY,
    ...policy,
    confirmOn: {
      ...DEFAULT_EXECUTE_COMMAND_RISK_POLICY.confirmOn,
      ...(policy?.confirmOn || {}),
    },
    allowPatterns: policy?.allowPatterns ?? DEFAULT_EXECUTE_COMMAND_RISK_POLICY.allowPatterns,
    denyPatterns: policy?.denyPatterns ?? DEFAULT_EXECUTE_COMMAND_RISK_POLICY.denyPatterns,
  };

  const normalized = normalizeCommand(command);

  for (const pattern of effectivePolicy.denyPatterns || []) {
    const re = safeRegex(pattern);
    if (!re) continue;
    if (re.test(normalized)) {
      const base = computeRiskFromCommand(normalized);
      return {
        ...base,
        matchedDenyPattern: pattern,
      };
    }
  }

  for (const pattern of effectivePolicy.allowPatterns || []) {
    const re = safeRegex(pattern);
    if (!re) continue;
    if (re.test(normalized)) {
      const base = computeRiskFromCommand(normalized);
      return {
        ...base,
        matchedAllowPattern: pattern,
      };
    }
  }

  return computeRiskFromCommand(normalized);
}

export function shouldConfirmExecuteCommand(
  command: string,
  policy?: Partial<ExecuteCommandRiskPolicy>,
): { confirm: boolean; assessment: CommandRiskAssessment } {
  const assessment = assessExecuteCommandRisk(command, policy);
  const effectivePolicy: ExecuteCommandRiskPolicy = {
    ...DEFAULT_EXECUTE_COMMAND_RISK_POLICY,
    ...policy,
    confirmOn: {
      ...DEFAULT_EXECUTE_COMMAND_RISK_POLICY.confirmOn,
      ...(policy?.confirmOn || {}),
    },
    allowPatterns: policy?.allowPatterns ?? DEFAULT_EXECUTE_COMMAND_RISK_POLICY.allowPatterns,
    denyPatterns: policy?.denyPatterns ?? DEFAULT_EXECUTE_COMMAND_RISK_POLICY.denyPatterns,
  };

  if (!effectivePolicy.enabled) {
    return { confirm: false, assessment };
  }

  if (assessment.matchedAllowPattern) {
    return { confirm: false, assessment };
  }

  if (assessment.matchedDenyPattern) {
    return { confirm: true, assessment };
  }

  if (hasAnyCategory(effectivePolicy, assessment.categories)) {
    // category-based overrides: always confirm if enabled for that category
    return { confirm: true, assessment };
  }

  const order: Record<CommandRiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };
  const confirm = order[assessment.level] > order[effectivePolicy.autoExecuteUpTo];
  return { confirm, assessment };
}

