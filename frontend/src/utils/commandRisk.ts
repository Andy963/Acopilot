export type CommandRiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface CommandRiskAssessment {
  level: CommandRiskLevel
  reasons: string[]
}

function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

export function assessCommandRisk(command: string): CommandRiskAssessment {
  const cmd = (command || '').trim()
  const lower = cmd.toLowerCase()

  const reasons: string[] = []
  let level: CommandRiskLevel = 'low'

  const hasSudo = /(^|\s)(sudo)\b/.test(lower)
  if (hasSudo) {
    reasons.push('includes sudo')
    level = 'medium'
  }

  const hasNetwork =
    /(^|\s)(curl|wget)\b/.test(lower) ||
    /\b(npm|pnpm|yarn|pip|pip3)\s+(install|add)\b/.test(lower) ||
    /\bgit\s+clone\b/.test(lower)
  if (hasNetwork) {
    reasons.push('downloads or installs dependencies')
    if (level === 'low') level = 'medium'
  }

  const hasRedirection = /(^|[^<])>\s*\S/.test(cmd)
  if (hasRedirection) {
    reasons.push('uses output redirection (>)')
    if (level === 'low') level = 'medium'
  }

  const isRm = /(^|\s)rm\b/.test(lower)
  const isWindowsDelete = /(^|\s)(del|erase)\b/.test(lower)
  const isRmdir = /(^|\s)rmdir\b/.test(lower)
  const isGitRestore = /\bgit\s+restore\b/.test(lower)
  const isGitResetHard = /\bgit\s+reset\b/.test(lower) && /\s--hard(\s|$)/.test(lower)
  const isGitClean = /\bgit\s+clean\b/.test(lower) && /\s-[^\n]*f/.test(lower)
  const isGitPushForce = /\bgit\s+push\b/.test(lower) && /\s--force(\s|$)/.test(lower)

  const isCurlPipeSh = /\b(curl|wget)\b[^|]*\|\s*\b(sh|bash|zsh|pwsh|powershell)\b/.test(lower)
  if (isCurlPipeSh) {
    reasons.push('pipes network output to a shell')
    level = 'critical'
  }

  const hasForceDeleteFlag =
    (isRm && /(^|\s)-[^\n]*f/.test(lower)) ||
    (isRmdir && /\s\/s(\s|$)/.test(lower)) ||
    (isWindowsDelete && /\s\/f(\s|$)/.test(lower))
  const hasRecursiveFlag =
    (isRm && /(^|\s)-[^\n]*r/.test(lower)) || (isRmdir && /\s\/s(\s|$)/.test(lower))

  const targetsRootLike =
    /\brm\b[^\n]*\s\/(\s|$)/.test(lower) ||
    /\brm\b[^\n]*\s~(\s|$)/.test(lower) ||
    /\brm\b[^\n]*\s\.\.(\s|$)/.test(lower) ||
    /\brmdir\b[^\n]*\s(c:\\|\\)(\s|$)/.test(lower) ||
    /\bdel\b[^\n]*\s(c:\\|\\)(\s|$)/.test(lower)

  if (targetsRootLike && (hasForceDeleteFlag || hasRecursiveFlag)) {
    reasons.push('targets root-like path with recursive/force flags')
    level = 'critical'
  } else if (isGitPushForce || isGitResetHard || isGitClean) {
    reasons.push('git history/working tree destructive operation')
    level = 'high'
  } else if ((isRm || isRmdir || isWindowsDelete) && (hasForceDeleteFlag || hasRecursiveFlag)) {
    reasons.push('delete with force/recursive flags')
    level = 'high'
  } else if (isGitRestore) {
    reasons.push('git restore can discard changes')
    if (level === 'low') level = 'medium'
  } else if (isRm || isWindowsDelete || isRmdir) {
    reasons.push('deletes files')
    if (level === 'low') level = 'medium'
  }

  return { level, reasons: uniq(reasons) }
}

