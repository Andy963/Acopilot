export type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun'

export interface FileLocation {
  path: string
  line: number
  column: number
}

export function stripAnsi(input: string): string {
  // eslint-disable-next-line no-control-regex
  return String(input || '').replace(/\u001b\[[0-9;]*m/g, '')
}

function normalizePathToken(p: string): string {
  return String(p || '')
    .trim()
    .replace(/^[`"'(]+/, '')
    .replace(/[`"'),;]+$/, '')
}

function looksLikeFilePath(p: string): boolean {
  if (!p) return false
  if (p.includes('://')) return false
  return p.includes('/') || p.includes('\\') || p.includes('.')
}

export function parseFirstFileLocation(text: string): FileLocation | null {
  if (!text) return null
  const lines = stripAnsi(text).split(/\r?\n/)

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    // tsc: path(line,col)
    let m = line.match(/(.+?)\((\d+),(\d+)\)/)
    if (m) {
      const p = normalizePathToken(m[1])
      if (looksLikeFilePath(p)) return { path: p, line: Number(m[2]), column: Number(m[3]) }
    }

    // Windows: C:\path\to\file:line:col
    m = line.match(/([A-Za-z]:\\.+?):(\d+):(\d+)/)
    if (m) {
      const p = normalizePathToken(m[1])
      if (looksLikeFilePath(p)) return { path: p, line: Number(m[2]), column: Number(m[3]) }
    }

    // Common: path:line:col
    m = line.match(/([^\s:()]+):(\d+):(\d+)/)
    if (m) {
      const p = normalizePathToken(m[1])
      if (looksLikeFilePath(p)) return { path: p, line: Number(m[2]), column: Number(m[3]) }
    }
  }

  return null
}

export function inferPackageManagerFromCommand(cmd: string): PackageManager | null {
  const lower = String(cmd || '').toLowerCase()
  if (/\bpnpm\b/.test(lower)) return 'pnpm'
  if (/\byarn\b/.test(lower)) return 'yarn'
  if (/\bbunx?\b/.test(lower)) return 'bun'
  if (/\bnpm\b/.test(lower) || /\bnpx\b/.test(lower)) return 'npm'
  return null
}

export function joinPath(base: string, file: string): string {
  const b = String(base || '').trim().replace(/\\/g, '/').replace(/\/+$/, '')
  if (!b) return file
  return `${b}/${file}`
}

export type SendToExtension = (command: string, payload: Record<string, unknown>) => Promise<any>

export function createWorkspaceFileExists(sendToExtension: SendToExtension) {
  return async (filePath: string): Promise<boolean> => {
    try {
      const resp = await sendToExtension('patch.getWorkspaceFileState', { path: filePath })
      return Boolean(resp?.success && resp.exists)
    } catch {
      return false
    }
  }
}

const packageManagerCache = new Map<string, PackageManager | null>()
const packageManagerPromiseCache = new Map<string, Promise<PackageManager | null>>()

export async function detectPackageManager(
  cmd: string,
  cwdPath: string,
  workspaceFileExists: (filePath: string) => Promise<boolean>
): Promise<PackageManager | null> {
  const fromCmd = inferPackageManagerFromCommand(cmd)
  if (fromCmd) return fromCmd

  const cacheKey = `${cwdPath || ''}`
  if (packageManagerCache.has(cacheKey)) {
    return packageManagerCache.get(cacheKey) || null
  }
  if (packageManagerPromiseCache.has(cacheKey)) {
    return await packageManagerPromiseCache.get(cacheKey)!
  }

  const promise = (async (): Promise<PackageManager | null> => {
    const searchDirs = [cwdPath, '']
      .map((s) => String(s || '').trim())
      .filter((v, i, arr) => arr.indexOf(v) === i)

    const candidates: Array<{ pm: PackageManager; files: string[] }> = [
      { pm: 'pnpm', files: ['pnpm-lock.yaml', 'pnpm-workspace.yaml'] },
      { pm: 'yarn', files: ['yarn.lock'] },
      { pm: 'npm', files: ['package-lock.json'] },
      { pm: 'bun', files: ['bun.lockb', 'bun.lock'] }
    ]

    for (const dir of searchDirs) {
      for (const c of candidates) {
        const checks = await Promise.all(c.files.map((f) => workspaceFileExists(joinPath(dir, f))))
        if (checks.some(Boolean)) {
          packageManagerCache.set(cacheKey, c.pm)
          return c.pm
        }
      }
    }

    packageManagerCache.set(cacheKey, null)
    return null
  })()

  packageManagerPromiseCache.set(cacheKey, promise)
  const result = await promise.finally(() => {
    packageManagerPromiseCache.delete(cacheKey)
  })
  return result
}

function escapeRegExp(input: string): string {
  return String(input || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function uniq(list: string[]): string[] {
  return Array.from(new Set(list.map((s) => String(s || '').trim()).filter(Boolean)))
}

function extractMissingCommand(text: string): string | null {
  const raw = stripAnsi(String(text || ''))

  let m = raw.match(/command not found:\s*([A-Za-z0-9._-]+)/i)
  if (m?.[1]) return m[1]

  m = raw.match(/(?:^|\n|:)\s*([A-Za-z0-9._-]+):\s*command not found\b/i)
  if (m?.[1]) return m[1]

  m = raw.match(/'([^']+)'\s+is not recognized as an internal or external command/i)
  if (m?.[1]) return m[1]

  return null
}

function wrapExec(pm: PackageManager, original: string): string {
  const cmd = String(original || '').trim()
  if (!cmd) return cmd
  if (pm === 'pnpm') return `pnpm exec ${cmd}`
  if (pm === 'npm') return `npm exec -- ${cmd}`
  if (pm === 'yarn') return `yarn ${cmd}`
  return `bunx ${cmd}`
}

export function buildNextCommandSuggestions(rawCmd: string, text: string, pm: PackageManager | null): string[] {
  const cmd = String(rawCmd || '').trim()
  const lower = stripAnsi(String(text || '')).toLowerCase()
  const suggestions: string[] = []

  const missing = extractMissingCommand(text)
  const effectivePm = pm || inferPackageManagerFromCommand(cmd)

  if (missing) {
    const missingLower = missing.toLowerCase()
    if (missingLower === 'pnpm' || missingLower === 'yarn') {
      suggestions.push('corepack enable')
    }

    if (effectivePm && ['tsc', 'eslint', 'jest', 'vitest', 'prettier', 'turbo', 'nx'].includes(missingLower)) {
      const startsWithMissing = new RegExp(`^${escapeRegExp(missingLower)}(\\s|$)`, 'i').test(cmd)
      if (startsWithMissing) {
        suggestions.push(wrapExec(effectivePm, cmd))
      }
    }
  }

  const looksLikeMissingNodeDeps =
    lower.includes('cannot find module') ||
    lower.includes('err_module_not_found') ||
    lower.includes('module_not_found') ||
    lower.includes('cannot find package') ||
    (lower.includes('node_modules') && lower.includes('enoent'))

  if (looksLikeMissingNodeDeps) {
    const pmCmd = effectivePm || 'npm'
    suggestions.push(`${pmCmd} install`)
  }

  const looksLikeMissingScript =
    lower.includes('missing script:') ||
    lower.includes('err_pnpm_no_script') ||
    lower.includes('no script named') ||
    lower.includes('missing script')

  if (looksLikeMissingScript) {
    const pmCmd = effectivePm || 'npm'
    suggestions.push(`${pmCmd} run`)
  }

  return uniq(suggestions).slice(0, 3)
}

export function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return ''
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}
