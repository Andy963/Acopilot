function splitShellCommand(command: string): string[] {
  return String(command || '')
    .split(/\s*(?:&&|\|\||;)\s*/g)
    .map(s => s.trim())
    .filter(Boolean)
}

function isReadOnlyGitCommand(cmd: string): boolean {
  const s = cmd.trim().toLowerCase()
  if (!s.startsWith('git ')) return false

  const match = s.match(/^git\s+([a-z0-9-]+)\b/)
  const sub = match?.[1] || ''
  const allowed = new Set([
    'diff',
    'status',
    'log',
    'show',
    'blame',
    'rev-parse',
    'ls-files',
    'grep',
    'describe'
  ])

  if (!allowed.has(sub)) return false
  if (/\s--output(?:=|\s)/.test(s)) return false
  return true
}

function isReadOnlyShellStage(stage: string): boolean {
  const s = stage.trim()
  if (!s) return false
  if (/>/.test(s)) return false

  const lower = s.toLowerCase()
  if (/\bsed\b[^\n]*\s-i\b/.test(lower)) return false
  if (/\btee\b/.test(lower)) return false
  if (/\b(rm|mv|cp|mkdir|rmdir|touch|chmod|chown|ln)\b/.test(lower)) return false

  if (isReadOnlyGitCommand(lower)) return true

  const allowPrefixes = [
    /^rg\b/,
    /^ripgrep\b/,
    /^grep\b/,
    /^egrep\b/,
    /^fgrep\b/,
    /^sed\b/,
    /^awk\b/,
    /^cat\b/,
    /^head\b/,
    /^tail\b/,
    /^wc\b/,
    /^ls\b/,
    /^find\b/,
    /^stat\b/,
    /^file\b/,
    /^pwd\b/,
    /^which\b/
  ]

  return allowPrefixes.some(re => re.test(lower))
}

export function isReadOnlyShellCommand(command: string): boolean {
  const segments = splitShellCommand(command)
  if (segments.length === 0) return false

  return segments.every((seg) => {
    const stages = seg.split('|').map(s => s.trim()).filter(Boolean)
    if (stages.length === 0) return false
    return stages.every(isReadOnlyShellStage)
  })
}

