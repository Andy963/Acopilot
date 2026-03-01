import type { ToolUsage } from '../../types'
import { isReadOnlyShellCommand } from '../../utils/commandReadOnly'
import { getToolConfig } from '../../utils/toolRegistry'

export type Translator = (key: string, params?: Record<string, unknown>) => string

export type RiskBadgeLevel = 'low' | 'medium' | 'high' | 'critical'

export interface RiskBadgeInfo {
  level: RiskBadgeLevel
  label: string
}

export interface RiskPrefixParseResult {
  badge: RiskBadgeInfo
  text: string
}

export type ParseRiskPrefix = (description: string) => RiskPrefixParseResult | null

export function riskLevelFromLabel(label: string): RiskBadgeLevel | null {
  const normalized = (label || '').trim().toLowerCase()
  if (!normalized) return null

  const map: Record<string, RiskBadgeLevel> = {
    '低': 'low',
    low: 'low',
    '中': 'medium',
    medium: 'medium',
    '高': 'high',
    high: 'high',
    '致命': 'critical',
    critical: 'critical',
    fatal: 'critical'
  }

  return map[normalized] ?? null
}

export const parseRiskPrefix: ParseRiskPrefix = (description: string): RiskPrefixParseResult | null => {
  const input = description ?? ''
  const trimmed = input.trimStart()
  const match = trimmed.match(/^\[(风险|Risk)\s*:\s*([^\]]+)\]\s*(.*)$/s)
  if (!match) return null

  const label = match[2].trim()
  const level = riskLevelFromLabel(label)
  if (!level) return null

  return {
    badge: { level, label },
    text: match[3] ?? ''
  }
}

export interface ReadFileHeaderStats {
  total: number
  success?: number
  fail?: number
}

export interface DisplayToolUsage extends ToolUsage {
  description: string
  descriptionText: string
  riskBadge?: RiskBadgeInfo
  readFileHeaderStats?: ReadFileHeaderStats | null
}

export function toolClassName(name: string): string {
  const normalized = String(name || 'tool')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  return normalized ? `tool-${normalized}` : 'tool'
}

export function getToolLabel(tool: ToolUsage): string {
  const config = getToolConfig(tool.name)
  return config?.label || tool.name
}

export function getToolIcon(tool: ToolUsage): string {
  const config = getToolConfig(tool.name)
  return config?.icon || 'codicon-tools'
}

export function getToolDescription(tool: ToolUsage, t: Translator): string {
  const config = getToolConfig(tool.name)
  if (config?.descriptionFormatter) {
    return config.descriptionFormatter(tool.args)
  }

  const argCount = Object.keys(tool.args || {}).length
  return t('components.message.tool.paramCount', { count: argCount })
}

export function getReadFileHeaderStats(tool: ToolUsage): ReadFileHeaderStats | null {
  if (tool.name !== 'read_file') return null

  const args = (tool.args ?? {}) as Record<string, unknown>
  const result = tool.result as Record<string, any> | undefined

  const results = result?.data?.results
  const hasResults = Array.isArray(results)
  const totalFromResult =
    typeof result?.data?.totalCount === 'number'
      ? (result.data.totalCount as number)
      : undefined

  const totalFromArgs = Array.isArray(args.files) ? args.files.length : 0
  const totalFromResults = hasResults ? results.length : 0

  const total = totalFromResult ?? (totalFromArgs > 0 ? totalFromArgs : totalFromResults)

  const success =
    typeof result?.data?.successCount === 'number'
      ? (result.data.successCount as number)
      : (hasResults ? results.filter((r: any) => !!r?.success).length : undefined)

  const fail =
    typeof result?.data?.failCount === 'number'
      ? (result.data.failCount as number)
      : (hasResults ? results.filter((r: any) => !r?.success).length : undefined)

  return { total, success, fail }
}

function getBasename(filePath: string): string {
  const parts = (filePath || '').split(/[/\\]/)
  return parts[parts.length - 1] || filePath
}

export function getReadFileSinglePath(tool: ToolUsage): string | null {
  if (tool.name !== 'read_file') return null
  const stats = getReadFileHeaderStats(tool)
  if (!stats || stats.total !== 1) return null
  const args = (tool.args ?? {}) as Record<string, unknown>
  const result = tool.result as Record<string, any> | undefined

  const results = result?.data?.results
  if (Array.isArray(results) && results.length === 1) {
    const p = results[0]?.path
    return typeof p === 'string' ? p : null
  }

  const files = Array.isArray(args.files) ? (args.files as any[]) : null
  if (files && files.length === 1) {
    const p = files[0]?.path
    return typeof p === 'string' ? p : null
  }

  return null
}

export function getReadFileSingleDisplayName(tool: ToolUsage): string | null {
  const p = getReadFileSinglePath(tool)
  if (!p) return null
  return getBasename(p)
}

export function getReadFileSingleLineCount(tool: ToolUsage): number | null {
  if (tool.name !== 'read_file') return null
  const stats = getReadFileHeaderStats(tool)
  if (!stats || stats.total !== 1) return null
  const result = tool.result as Record<string, any> | undefined
  const results = result?.data?.results
  if (!Array.isArray(results) || results.length !== 1) return null
  const lc = results[0]?.lineCount
  return typeof lc === 'number' ? lc : null
}

export function getReadFileSingleContent(tool: ToolUsage): string | null {
  if (tool.name !== 'read_file') return null
  const stats = getReadFileHeaderStats(tool)
  if (!stats || stats.total !== 1) return null
  const result = tool.result as Record<string, any> | undefined
  const results = result?.data?.results
  if (!Array.isArray(results) || results.length !== 1) return null
  const content = results[0]?.content
  return typeof content === 'string' && content.length > 0 ? content : null
}

function getReadFileArgsFiles(tool: ToolUsage): any[] {
  const args = (tool.args ?? {}) as Record<string, any>
  return Array.isArray(args.files) ? args.files : []
}

function getReadFileResultEntries(tool: ToolUsage): any[] {
  const result = tool.result as Record<string, any> | undefined
  const results = result?.data?.results
  return Array.isArray(results) ? results : []
}

function mergeStatusForGroup(tools: ToolUsage[]): ToolUsage['status'] {
  const statuses = tools
    .map((t) => t.status)
    .filter((s): s is NonNullable<ToolUsage['status']> => !!s)

  if (statuses.some((s) => s === 'running' || s === 'pending')) return 'running'

  const hasError = statuses.some((s) => s === 'error')
  const hasSuccess = statuses.some((s) => s === 'success')
  const hasWarning = statuses.some((s) => s === 'warning')

  if (hasWarning) return 'warning'
  if (hasError && hasSuccess) return 'warning'
  if (hasError) return 'error'
  if (hasSuccess) return 'success'
  return undefined
}

function buildReadFileGroup(tools: DisplayToolUsage[]): DisplayToolUsage {
  const groupId = `read_file_group:${tools[0]?.id || 'unknown'}`

  const files = tools.flatMap((t) => getReadFileArgsFiles(t))
  const results = tools.flatMap((t) => getReadFileResultEntries(t))

  const status = mergeStatusForGroup(tools)
  const isRunning = status === 'running' || status === 'pending'

  const totalCount = files.length > 0 ? files.length : results.length

  let successCount: number | undefined
  let failCount: number | undefined

  if (!isRunning) {
    let ok = 0
    let fail = 0

    for (const t of tools) {
      const r = t.result as any
      if (typeof r?.data?.successCount === 'number' && typeof r?.data?.failCount === 'number') {
        ok += r.data.successCount
        fail += r.data.failCount
        continue
      }

      const entries = getReadFileResultEntries(t)
      if (entries.length > 0) {
        ok += entries.filter((e: any) => !!e?.success).length
        fail += entries.filter((e: any) => !e?.success).length
        continue
      }

      const reqs = getReadFileArgsFiles(t)
      if (t.error && reqs.length > 0) {
        fail += reqs.length
      }
    }

    successCount = ok
    failCount = fail
  }

  const result: Record<string, any> = {
    success: failCount ? failCount === 0 : undefined,
    data: {
      results,
      totalCount,
      ...(typeof successCount === 'number' ? { successCount } : {}),
      ...(typeof failCount === 'number' ? { failCount } : {})
    }
  }

  const description = tools[0]?.description ?? ''
  const descriptionText = tools[0]?.descriptionText ?? ''
  const riskBadge = tools[0]?.riskBadge

  const group: DisplayToolUsage = {
    id: groupId,
    name: 'read_file',
    args: { files },
    status,
    result,
    description,
    descriptionText,
    riskBadge,
    readFileHeaderStats: null
  }

  group.readFileHeaderStats = getReadFileHeaderStats(group)
  return group
}

export function mergeConsecutiveReadFileTools(tools: DisplayToolUsage[]): DisplayToolUsage[] {
  const merged: DisplayToolUsage[] = []
  let buffer: DisplayToolUsage[] = []

  const flush = () => {
    if (buffer.length === 0) return
    if (buffer.length === 1) merged.push(buffer[0])
    else merged.push(buildReadFileGroup(buffer))
    buffer = []
  }

  for (const tool of tools) {
    if (tool.name === 'read_file') {
      buffer.push(tool)
      continue
    }
    flush()
    merged.push(tool)
  }

  flush()
  return merged
}

export function getExecuteCommandArgs(tool: ToolUsage): { command: string; cwd?: string; shell?: string } {
  const args = (tool.args ?? {}) as Record<string, unknown>
  return {
    command: typeof args.command === 'string' ? args.command : '',
    cwd: typeof args.cwd === 'string' ? args.cwd : undefined,
    shell: typeof args.shell === 'string' ? args.shell : undefined
  }
}

function didExecuteCommandChangeWorkspace(tool: ToolUsage): boolean | null {
  const summary = (tool.result as any)?.data?.changesSummary as any
  if (!summary || typeof summary !== 'object') return false
  if (summary.unsupportedReason) return null
  const total = Number(summary.totalFiles)
  if (!Number.isFinite(total)) return null
  return total > 0
}

function isGroupableExecuteCommand(tool: ToolUsage): boolean {
  if (tool.name !== 'execute_command') return false
  if (!tool.result) return false
  if (tool.status === 'running' || tool.status === 'pending') return false

  const { command } = getExecuteCommandArgs(tool)
  if (!isReadOnlyShellCommand(command)) return false

  const changed = didExecuteCommandChangeWorkspace(tool)
  if (changed === null) return false
  return changed === false
}

function buildExecuteCommandGroup(
  tools: DisplayToolUsage[],
  describe: (tool: ToolUsage) => string,
  parseRiskPrefix: ParseRiskPrefix
): DisplayToolUsage {
  const groupId = `execute_command_group:${tools[0]?.id || 'unknown'}`
  const commands = tools.map((t) => getExecuteCommandArgs(t))
  const items = tools.map((t) => ({
    id: t.id,
    args: t.args,
    status: t.status,
    error: t.error,
    result: t.result
  }))

  const group: DisplayToolUsage = {
    id: groupId,
    name: 'execute_command_group',
    args: { commands, items },
    status: mergeStatusForGroup(tools),
    description: '',
    descriptionText: '',
    readFileHeaderStats: null
  }

  const description = describe(group)
  const parsed = parseRiskPrefix(description)
  group.description = description
  group.descriptionText = parsed ? parsed.text : description
  group.riskBadge = parsed?.badge

  return group
}

export function mergeConsecutiveExecuteCommandTools(
  tools: DisplayToolUsage[],
  options: { describe: (tool: ToolUsage) => string; parseRiskPrefix: ParseRiskPrefix }
): DisplayToolUsage[] {
  const merged: DisplayToolUsage[] = []
  let buffer: DisplayToolUsage[] = []

  const flush = () => {
    if (buffer.length === 0) return
    if (buffer.length === 1) merged.push(buffer[0])
    else merged.push(buildExecuteCommandGroup(buffer, options.describe, options.parseRiskPrefix))
    buffer = []
  }

  for (const tool of tools) {
    if (isGroupableExecuteCommand(tool)) {
      buffer.push(tool)
      continue
    }
    flush()
    merged.push(tool)
  }

  flush()
  return merged
}
