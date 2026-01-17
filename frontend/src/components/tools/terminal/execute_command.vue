<script setup lang="ts">
/**
 * execute_command 工具的内容面板
 *
 * 显示：
 * - 命令执行状态
 * - 终端输出（实时更新）
 * - 杀掉终端按钮
 *
 * 使用 terminalStore 管理实时输出
 */

import { computed, ref, watch, onMounted, nextTick } from 'vue'
import { useTerminalStore } from '../../../stores/terminalStore'
import CustomScrollbar from '../../common/CustomScrollbar.vue'
import { useI18n } from '../../../composables/useI18n'
import { loadDiffContent as loadDiffContentFromBackend, sendToExtension } from '../../../utils/vscode'

const { t } = useI18n()

type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun'

const packageManagerCache = new Map<string, PackageManager | null>()
const packageManagerPromiseCache = new Map<string, Promise<PackageManager | null>>()

const props = defineProps<{
  args: Record<string, unknown>
  result?: Record<string, unknown>
  error?: string
  status?: 'pending' | 'running' | 'success' | 'error'
  toolId?: string
}>()

const emit = defineEmits<{
  (e: 'update-result', result: Record<string, unknown>): void
}>()

// 终端 store
const terminalStore = useTerminalStore()

// 杀掉终端的加载状态
const killing = ref(false)

const outputScrollRef = ref<InstanceType<typeof CustomScrollbar> | null>(null)

// 获取命令参数
const command = computed(() => props.args.command as string || '')
const cwd = computed(() => props.args.cwd as string || '')
const shell = computed(() => props.args.shell as string || 'default')

// 获取结果数据（来自工具执行结果）
const resultData = computed(() => {
  const result = props.result as Record<string, any> | undefined
  return result?.data || {}
})

// 终端 ID（来自工具执行结果）
const terminalId = computed(() => resultData.value.terminalId as string || '')

// 从 store 获取终端状态
// 优先通过 terminalId 获取，如果没有则尝试通过命令匹配
const terminalState = computed(() => {
  if (terminalId.value) {
    return terminalStore.getTerminal(terminalId.value)
  }
  
  if (command.value) {
    const matchedId = terminalStore.findTerminalByCommand(command.value, cwd.value || undefined)
    if (matchedId) {
      return terminalStore.getTerminal(matchedId)
    }
  }
  
  return null
})

// 输出内容 - 优先使用 store 中的实时输出，否则使用结果中的静态输出
const output = computed(() => {
  // 如果有实时终端状态，使用实时输出
  if (terminalState.value) {
    return terminalState.value.output
  }
  // 否则使用结果中的静态输出（历史记录）
  return resultData.value.output as string || ''
})

// 执行状态
const exitCode = computed(() => {
  // 优先使用实时状态
  if (terminalState.value && terminalState.value.exitCode !== undefined) {
    return terminalState.value.exitCode
  }
  return resultData.value.exitCode as number | undefined
})

const killed = computed(() => {
  // 优先使用实时状态
  if (terminalState.value) {
    return terminalState.value.killed || false
  }
  return resultData.value.killed as boolean || false
})

// 是否被用户取消
const cancelled = computed(() => {
  const result = props.result as Record<string, any> | undefined
  return result?.cancelled as boolean || false
})

const duration = computed(() => {
  // 优先使用实时状态
  if (terminalState.value && terminalState.value.duration !== undefined) {
    return terminalState.value.duration
  }
  return resultData.value.duration as number | undefined
})

const truncated = computed(() => resultData.value.truncated as boolean || false)
const totalLines = computed(() => resultData.value.totalLines as number || 0)
const outputLines = computed(() => resultData.value.outputLines as number || 0)

// ========== 文件变更（git diff）==========
type FileChangeAction = 'created' | 'modified' | 'deleted' | 'renamed'

interface ChangedFileEntry {
  path: string
  action: FileChangeAction
  fromPath?: string
  diffContentId?: string | null
  skippedReason?: string | null
}

interface ChangesSummary {
  totalFiles: number
  diffAvailableFiles: number
  skippedFiles: number
  truncatedFiles?: number
  unsupportedReason?: string
}

interface DiffContent {
  originalContent: string
  newContent: string
  filePath: string
}

interface DiffLine {
  type: 'unchanged' | 'deleted' | 'added'
  content: string
  oldLineNum?: number
  newLineNum?: number
}

interface DiffStats {
  added: number
  deleted: number
}

const changedFiles = computed((): ChangedFileEntry[] => {
  const raw = (resultData.value.changedFiles as unknown) ?? []
  if (!Array.isArray(raw)) return []

  return raw
    .map((r: any) => ({
      path: String(r?.path || '').trim(),
      action: String(r?.action || 'modified') as FileChangeAction,
      fromPath: r?.fromPath ? String(r.fromPath) : undefined,
      diffContentId: r?.diffContentId ?? null,
      skippedReason: r?.skippedReason ?? null
    }))
    .filter((f) => Boolean(f.path))
})

const changesSummary = computed((): ChangesSummary | null => {
  const s = resultData.value.changesSummary as any
  if (!s || typeof s !== 'object') return null
  return {
    totalFiles: Number(s.totalFiles) || 0,
    diffAvailableFiles: Number(s.diffAvailableFiles) || 0,
    skippedFiles: Number(s.skippedFiles) || 0,
    truncatedFiles: s.truncatedFiles !== undefined ? Number(s.truncatedFiles) : undefined,
    unsupportedReason: s.unsupportedReason ? String(s.unsupportedReason) : undefined
  }
})

const hasChangeSection = computed(() => {
  if (isRunning.value) return false
  return Boolean(changesSummary.value || changedFiles.value.length > 0)
})

const changeCount = computed(() => changesSummary.value?.totalFiles ?? changedFiles.value.length)

const changeHeaderMeta = computed(() => {
  const s = changesSummary.value
  if (!s) return ''

  if (s.unsupportedReason) {
    return t('components.tools.terminal.executeCommandPanel.fileChanges.unsupported')
  }

  const parts: string[] = []
  if (s.diffAvailableFiles > 0) {
    parts.push(t('components.tools.terminal.executeCommandPanel.fileChanges.diffAvailable', { count: s.diffAvailableFiles }))
  }
  if (s.skippedFiles > 0) {
    parts.push(t('components.tools.terminal.executeCommandPanel.fileChanges.skipped', { count: s.skippedFiles }))
  }
  if (s.truncatedFiles && s.truncatedFiles > 0) {
    parts.push(t('components.tools.terminal.executeCommandPanel.fileChanges.truncated', { count: s.truncatedFiles }))
  }
  return parts.join(' · ')
})

const changesExpanded = ref(false)
const changesUserToggled = ref(false)

const defaultChangesExpanded = computed(() => {
  const s = changesSummary.value
  if (s?.unsupportedReason) return false
  return changeCount.value > 0
})

function toggleChangesExpanded() {
  changesExpanded.value = !changesExpanded.value
  changesUserToggled.value = true
}

watch(() => props.toolId, () => {
  changesUserToggled.value = false
  changesExpanded.value = defaultChangesExpanded.value
}, { immediate: true })

watch(defaultChangesExpanded, (next) => {
  if (!changesUserToggled.value) {
    changesExpanded.value = next
  }
})

const expandedDiffFiles = ref<Set<string>>(new Set())
const diffContents = ref<Map<string, DiffContent>>(new Map())
const loadingDiffs = ref<Set<string>>(new Set())
const diffLoadErrors = ref<Map<string, string>>(new Map())
const diffLinesByFile = ref<Map<string, DiffLine[]>>(new Map())
const diffStats = ref<Map<string, DiffStats>>(new Map())

const previewDiffLineCount = 20

function isDiffExpanded(filePath: string): boolean {
  return expandedDiffFiles.value.has(filePath)
}

function setDiffExpanded(filePath: string, expanded: boolean) {
  const next = new Set(expandedDiffFiles.value)
  if (expanded) next.add(filePath)
  else next.delete(filePath)
  expandedDiffFiles.value = next
}

function isLoadingDiff(filePath: string): boolean {
  return loadingDiffs.value.has(filePath)
}

function setLoadingDiff(filePath: string, loading: boolean) {
  const next = new Set(loadingDiffs.value)
  if (loading) next.add(filePath)
  else next.delete(filePath)
  loadingDiffs.value = next
}

function getDiffContent(filePath: string): DiffContent | null {
  return diffContents.value.get(filePath) || null
}

function getDiffLines(filePath: string): DiffLine[] | null {
  return diffLinesByFile.value.get(filePath) || null
}

function getDiffError(filePath: string): string | null {
  return diffLoadErrors.value.get(filePath) || null
}

function getDiffStatsForFile(filePath: string): DiffStats | null {
  return diffStats.value.get(filePath) || null
}

async function ensureDiffLoaded(file: ChangedFileEntry) {
  if (!file.diffContentId) return
  if (diffContents.value.has(file.path)) return
  if (loadingDiffs.value.has(file.path)) return

  setLoadingDiff(file.path, true)
  diffLoadErrors.value.delete(file.path)
  try {
    const resp = await loadDiffContentFromBackend(String(file.diffContentId))
    if (!resp) {
      throw new Error('Failed to load diff content')
    }

    diffContents.value.set(file.path, resp as unknown as DiffContent)

    const lines = computeDiffLines(resp.originalContent, resp.newContent)
    diffLinesByFile.value.set(file.path, lines)
    diffStats.value.set(file.path, getDiffStats(lines))
  } catch (err: any) {
    diffLoadErrors.value.set(file.path, err?.message || t('common.failed'))
  } finally {
    setLoadingDiff(file.path, false)
  }
}

async function toggleFileDiff(file: ChangedFileEntry) {
  if (!file.path) return
  const next = !isDiffExpanded(file.path)
  setDiffExpanded(file.path, next)
  if (next) {
    await ensureDiffLoaded(file)
  }
}

async function openFileDiffInVSCode(file: ChangedFileEntry) {
  if (!file.diffContentId) return

  try {
    const serializedArgs = JSON.parse(JSON.stringify(props.args || {}))
    const serializedResult = props.result ? JSON.parse(JSON.stringify(props.result)) : undefined

    await sendToExtension('diff.openPreview', {
      toolId: props.toolId || '',
      toolName: 'execute_command',
      filePaths: [file.path],
      args: serializedArgs,
      result: serializedResult
    })
  } catch (err) {
    console.warn('Failed to open diff preview:', err)
  }
}

async function openChangedFile(file: ChangedFileEntry) {
  if (!file.path) return
  try {
    await sendToExtension('openWorkspaceFile', { path: file.path })
  } catch (err) {
    console.warn('Failed to open file:', err)
  }
}

function getActionLabel(action: FileChangeAction): string {
  switch (action) {
    case 'created':
      return t('components.tools.terminal.executeCommandPanel.fileChanges.actions.created')
    case 'deleted':
      return t('components.tools.terminal.executeCommandPanel.fileChanges.actions.deleted')
    case 'renamed':
      return t('components.tools.terminal.executeCommandPanel.fileChanges.actions.renamed')
    case 'modified':
    default:
      return t('components.tools.terminal.executeCommandPanel.fileChanges.actions.modified')
  }
}

function getActionIcon(action: FileChangeAction): string {
  switch (action) {
    case 'created':
      return 'codicon-new-file'
    case 'deleted':
      return 'codicon-trash'
    case 'renamed':
      return 'codicon-arrow-right'
    case 'modified':
    default:
      return 'codicon-edit'
  }
}

function getDiffLineNumWidth(diffContent: DiffContent): number {
  const oldLines = diffContent.originalContent.split('\n').length
  const newLines = diffContent.newContent.split('\n').length
  return String(Math.max(oldLines, newLines)).length
}

function formatLineNum(num: number | undefined, width: number): string {
  if (num === undefined) return ' '.repeat(width)
  return String(num).padStart(width)
}

function getDiffStats(lines: DiffLine[]): DiffStats {
  const deleted = lines.filter(l => l.type === 'deleted').length
  const added = lines.filter(l => l.type === 'added').length
  return { added, deleted }
}

function needsDiffExpand(lines: DiffLine[]): boolean {
  return lines.length > previewDiffLineCount
}

function getDisplayDiffLines(lines: DiffLine[], filePath: string): DiffLine[] {
  if (!needsDiffExpand(lines)) return lines
  if (expandedFiles.value.has(filePath + '_diff')) return lines
  return lines.slice(0, previewDiffLineCount)
}

function toggleDiffExpand(filePath: string) {
  const key = filePath + '_diff'
  if (expandedFiles.value.has(key)) {
    expandedFiles.value.delete(key)
  } else {
    expandedFiles.value.add(key)
  }
}

function isDiffFullyExpanded(filePath: string): boolean {
  return expandedFiles.value.has(filePath + '_diff')
}

function computeDiffLines(originalContent: string, newContent: string): DiffLine[] {
  const oldLines = originalContent.split('\n')
  const newLines = newContent.split('\n')
  const result: DiffLine[] = []

  const lcs = computeLCS(oldLines, newLines)

  let oldIdx = 0
  let newIdx = 0
  let oldLineNum = 1
  let newLineNum = 1

  for (const match of lcs) {
    while (oldIdx < match.oldIndex) {
      result.push({
        type: 'deleted',
        content: oldLines[oldIdx],
        oldLineNum: oldLineNum++
      })
      oldIdx++
    }

    while (newIdx < match.newIndex) {
      result.push({
        type: 'added',
        content: newLines[newIdx],
        newLineNum: newLineNum++
      })
      newIdx++
    }

    result.push({
      type: 'unchanged',
      content: oldLines[oldIdx],
      oldLineNum: oldLineNum++,
      newLineNum: newLineNum++
    })
    oldIdx++
    newIdx++
  }

  while (oldIdx < oldLines.length) {
    result.push({
      type: 'deleted',
      content: oldLines[oldIdx],
      oldLineNum: oldLineNum++
    })
    oldIdx++
  }

  while (newIdx < newLines.length) {
    result.push({
      type: 'added',
      content: newLines[newIdx],
      newLineNum: newLineNum++
    })
    newIdx++
  }

  return result
}

interface LCSMatch {
  oldIndex: number
  newIndex: number
}

function computeLCS(oldLines: string[], newLines: string[]): LCSMatch[] {
  const m = oldLines.length
  const n = newLines.length

  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  const result: LCSMatch[] = []
  let i = m, j = n

  while (i > 0 && j > 0) {
    if (oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({ oldIndex: i - 1, newIndex: j - 1 })
      i--
      j--
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--
    } else {
      j--
    }
  }

  return result
}

// 是否正在运行
const isRunning = computed(() => {
  if (props.error) return false
  
  const result = props.result as Record<string, any> | undefined
  if (result?.error) return false
  
  if (props.status === 'running' || props.status === 'pending') {
    return true
  }
  
  if (terminalState.value) {
    return terminalState.value.running
  }
  
  if (killed.value) return false
  if (exitCode.value !== undefined) return false
  return !!terminalId.value
})

// 执行状态标签
const statusLabel = computed(() => {
  // 检查结果中的 error 字段
  const result = props.result as Record<string, any> | undefined
  const resultError = result?.error as string | undefined
  
  // 优先检测取消状态（用户点击了取消按钮）
  if (cancelled.value || killed.value) {
    return t('components.tools.terminal.executeCommandPanel.status.terminated')
  }
  if (props.error || resultError) return t('components.tools.terminal.executeCommandPanel.status.failed')
  if (exitCode.value === 0) return t('components.tools.terminal.executeCommandPanel.status.success')
  if (exitCode.value !== undefined) return t('components.tools.terminal.executeCommandPanel.status.exitCode', { code: exitCode.value })
  if (isRunning.value) return t('components.tools.terminal.executeCommandPanel.status.running')
  return t('components.tools.terminal.executeCommandPanel.status.pending')
})

// 状态颜色类
const statusClass = computed(() => {
  // 检查结果中的 error 字段
  const result = props.result as Record<string, any> | undefined
  const resultError = result?.error as string | undefined
  
  // 优先检测取消状态（用户点击了取消按钮）
  if (cancelled.value || killed.value) return 'terminated'
  if (props.error || resultError) return 'error'
  if (exitCode.value !== undefined && exitCode.value !== 0) return 'error'
  if (exitCode.value === 0) return 'success'
  if (isRunning.value) return 'running'
  return 'pending'
})

// 格式化持续时间
function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return ''
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

const statusIcon = computed(() => {
  // 检查结果中的 error 字段
  const result = props.result as Record<string, any> | undefined
  const resultError = result?.error as string | undefined

  if (cancelled.value || killed.value) return 'codicon-circle-slash'
  if (props.error || resultError) return 'codicon-error'
  if (exitCode.value !== undefined && exitCode.value !== 0) return 'codicon-error'
  if (exitCode.value === 0) return 'codicon-pass'
  if (isRunning.value) return 'codicon-loading'
  return 'codicon-clock'
})

const commandTooltip = computed(() => {
  const lines: string[] = []

  if (command.value) lines.push(command.value)
  if (cwd.value) lines.push(`CWD: ${cwd.value}`)
  if (shell.value && shell.value !== 'default') lines.push(`Shell: ${shell.value}`)
  if (duration.value !== undefined) lines.push(formatDuration(duration.value))
  if (statusLabel.value) lines.push(statusLabel.value)

  return lines.join('\n')
})

const defaultExpanded = computed(() => {
  // 运行中 / 失败 / 退出码非 0 / 被终止：默认展开
  if (isRunning.value) return true
  if (cancelled.value || killed.value) return true
  if (props.error) return true
  const result = props.result as Record<string, any> | undefined
  if (result?.error) return true
  if (exitCode.value !== undefined && exitCode.value !== 0) return true
  return false
})

// ========== 错误定位（打开报错文件/跳转到行列）==========

interface FileLocation {
  path: string
  line: number
  column: number
}

function stripAnsi(input: string): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/\u001b\[[0-9;]*m/g, '')
}

function normalizePathToken(p: string): string {
  return p.trim().replace(/^[`"'(]+/, '').replace(/[`"'),;]+$/, '')
}

function looksLikeFilePath(p: string): boolean {
  if (!p) return false
  if (p.includes('://')) return false
  return p.includes('/') || p.includes('\\') || p.includes('.')
}

function parseFirstFileLocation(text: string): FileLocation | null {
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

const hasFailure = computed(() => {
  const result = props.result as Record<string, any> | undefined
  const resultError = result?.error as string | undefined

  if (props.error || resultError) return true
  if (exitCode.value !== undefined && exitCode.value !== 0) return true

  return false
})

const diagnosticText = computed(() => {
  if (output.value) return output.value
  if (props.error) return props.error
  const result = props.result as Record<string, any> | undefined
  const resultError = result?.error as string | undefined
  return resultError || ''
})

const firstErrorLocation = computed(() => parseFirstFileLocation(diagnosticText.value))

// ========== 建议下一条命令（基于错误类型）==========

function inferPackageManagerFromCommand(cmd: string): PackageManager | null {
  const lower = String(cmd || '').toLowerCase()
  if (/\bpnpm\b/.test(lower)) return 'pnpm'
  if (/\byarn\b/.test(lower)) return 'yarn'
  if (/\bbunx?\b/.test(lower)) return 'bun'
  if (/\bnpm\b/.test(lower) || /\bnpx\b/.test(lower)) return 'npm'
  return null
}

function joinPath(base: string, file: string): string {
  const b = String(base || '').trim().replace(/\\/g, '/').replace(/\/+$/, '')
  if (!b) return file
  return `${b}/${file}`
}

async function workspaceFileExists(filePath: string): Promise<boolean> {
  try {
    const resp = await sendToExtension<{ success: boolean; exists: boolean }>(
      'patch.getWorkspaceFileState',
      { path: filePath }
    )
    return Boolean(resp?.success && resp.exists)
  } catch {
    return false
  }
}

async function detectPackageManager(cmd: string, cwdPath: string): Promise<PackageManager | null> {
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
    const searchDirs = [cwdPath, ''].map(s => String(s || '').trim()).filter((v, i, arr) => arr.indexOf(v) === i)

    const candidates: Array<{ pm: PackageManager; files: string[] }> = [
      { pm: 'pnpm', files: ['pnpm-lock.yaml', 'pnpm-workspace.yaml'] },
      { pm: 'yarn', files: ['yarn.lock'] },
      { pm: 'npm', files: ['package-lock.json'] },
      { pm: 'bun', files: ['bun.lockb', 'bun.lock'] }
    ]

    for (const dir of searchDirs) {
      for (const c of candidates) {
        const checks = await Promise.all(c.files.map(f => workspaceFileExists(joinPath(dir, f))))
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

function extractMissingCommand(text: string): string | null {
  const raw = stripAnsi(String(text || ''))

  // zsh: command not found: pnpm
  let m = raw.match(/command not found:\s*([A-Za-z0-9._-]+)/i)
  if (m?.[1]) return m[1]

  // bash: pnpm: command not found
  m = raw.match(/(?:^|\n|:)\s*([A-Za-z0-9._-]+):\s*command not found\b/i)
  if (m?.[1]) return m[1]

  // Windows: 'pnpm' is not recognized as an internal or external command
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

function escapeRegExp(input: string): string {
  return String(input || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function uniq(list: string[]): string[] {
  return Array.from(new Set(list.map(s => String(s || '').trim()).filter(Boolean)))
}

function buildNextCommandSuggestions(rawCmd: string, text: string, pm: PackageManager | null): string[] {
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

const detectedPackageManager = ref<PackageManager | null>(null)
const detectingPackageManager = ref(false)

async function refreshPackageManager() {
  if (detectingPackageManager.value) return
  detectingPackageManager.value = true
  try {
    detectedPackageManager.value = await detectPackageManager(command.value, cwd.value)
  } finally {
    detectingPackageManager.value = false
  }
}

onMounted(() => {
  refreshPackageManager()
})

watch([command, cwd], () => {
  refreshPackageManager()
})

const nextCommandSuggestions = computed(() => {
  if (!hasFailure.value || isRunning.value) return []
  return buildNextCommandSuggestions(command.value, diagnosticText.value, detectedPackageManager.value)
})

const hasNextSuggestions = computed(() => nextCommandSuggestions.value.length > 0)

const copiedSuggestion = ref<string>('')
async function copySuggestionCommand(cmd: string) {
  if (!cmd) return
  try {
    await navigator.clipboard.writeText(cmd)
    copiedSuggestion.value = cmd
    setTimeout(() => {
      if (copiedSuggestion.value === cmd) copiedSuggestion.value = ''
    }, 1000)
  } catch (err) {
    console.error('复制建议命令失败:', err)
  }
}

const canOpenFirstError = computed(() =>
  hasFailure.value && !isRunning.value && !!firstErrorLocation.value
)

const openFirstErrorTitle = computed(() => {
  const loc = firstErrorLocation.value
  if (!loc) return ''
  return t('components.tools.terminal.executeCommandPanel.jumpToErrorTooltip', {
    path: loc.path,
    line: loc.line,
    column: loc.column
  })
})

const opening = ref(false)

async function openFirstError() {
  const loc = firstErrorLocation.value
  if (!loc || opening.value) return

  opening.value = true
  try {
    await sendToExtension('openWorkspaceFileAtLocation', {
      path: loc.path,
      line: loc.line,
      column: loc.column
    })
  } catch (err) {
    console.warn('Failed to open error location:', err)
  } finally {
    opening.value = false
  }
}

const expanded = ref(false)
const userToggled = ref(false)
const expandedFiles = ref<Set<string>>(new Set())

function toggleExpanded() {
  expanded.value = !expanded.value
  userToggled.value = true
}

// 实际的终端标识（用于注册和杀死）
// 优先使用 result 中的 terminalId，其次通过命令匹配
const effectiveTerminalId = computed(() => {
  if (terminalId.value) {
    return terminalId.value
  }
  
  if (command.value) {
    const matchedId = terminalStore.findTerminalByCommand(command.value, cwd.value || undefined)
    if (matchedId) {
      return matchedId
    }
  }
  
  if (terminalState.value) {
    return terminalState.value.id
  }
  
  return props.toolId || ''
})

// 杀掉终端
async function handleKillTerminal() {
  if (!effectiveTerminalId.value || killing.value) {
    return
  }
  
  killing.value = true
  
  try {
    const result = await terminalStore.killTerminal(effectiveTerminalId.value)
    
    if (result.success) {
      // 更新结果显示被杀掉
      emit('update-result', {
        ...props.result,
        data: {
          ...resultData.value,
          killed: true,
          output: result.output || resultData.value.output,
          endTime: Date.now()
        }
      })
    }
  } catch (err) {
    console.error('杀掉终端失败:', err)
  } finally {
    killing.value = false
  }
}

// 复制输出
const copied = ref(false)
async function copyOutput() {
  if (!output.value) return
  
  try {
    await navigator.clipboard.writeText(output.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 1000)
  } catch (err) {
    console.error('复制失败:', err)
  }
}

// 组件挂载时，如果正在运行，注册到 store
onMounted(() => {
  if (isRunning.value && effectiveTerminalId.value) {
    terminalStore.registerTerminal(effectiveTerminalId.value)
  }
})

// 初始化/同步默认展开状态（成功默认收起）
watch(() => props.toolId, () => {
  userToggled.value = false
  expanded.value = defaultExpanded.value
}, { immediate: true })

watch(defaultExpanded, (next) => {
  if (!userToggled.value && next) {
    expanded.value = true
  }
})

// 展开时，默认滚动到最底部（更像终端）
watch(expanded, (isExpanded) => {
  if (!isExpanded) return
  nextTick(() => {
    outputScrollRef.value?.scrollToBottom()
  })
})

// 监听终端 ID 变化
watch(effectiveTerminalId, (newId) => {
  if (newId && isRunning.value) {
    terminalStore.registerTerminal(newId)
  }
})

// 监听运行状态变化
watch(isRunning, (running) => {
  if (running && effectiveTerminalId.value) {
    terminalStore.registerTerminal(effectiveTerminalId.value)
  }
})
</script>

<template>
  <div class="execute-command-panel" :class="[statusClass, { running: isRunning, expanded }]">
    <!-- 头部信息栏 -->
    <div
      class="panel-header"
      role="button"
      tabindex="0"
      :title="commandTooltip"
      @click="toggleExpanded"
      @keydown.enter.prevent="toggleExpanded"
      @keydown.space.prevent="toggleExpanded"
    >
      <span
        class="status-icon codicon"
        :class="[statusIcon, statusClass, { 'codicon-modifier-spin': isRunning }]"
        :title="statusLabel"
      ></span>
      <span class="prompt">$</span>
      <code class="command-text" :title="commandTooltip">{{ command }}</code>

      <span
        v-if="truncated && !isRunning"
        class="truncated-indicator codicon codicon-warning"
        :title="t('components.tools.terminal.executeCommandPanel.truncatedInfo', { outputLines, totalLines })"
      ></span>

      <span v-if="duration !== undefined" class="duration">
        {{ formatDuration(duration) }}
      </span>

      <div class="header-actions" @click.stop>
        <button
          v-if="isRunning"
          class="icon-btn danger"
          :disabled="killing"
          :title="t('components.tools.terminal.executeCommandPanel.terminateTooltip')"
          @click.stop="handleKillTerminal"
        >
          <span class="codicon codicon-debug-stop"></span>
        </button>

        <button
          v-if="canOpenFirstError"
          class="icon-btn"
          :disabled="opening"
          :title="openFirstErrorTitle"
          @click.stop="openFirstError"
        >
          <span class="codicon codicon-go-to-file"></span>
        </button>

        <button
          v-if="output"
          class="icon-btn"
          :class="{ success: copied }"
          :title="copied ? t('components.tools.terminal.executeCommandPanel.copied') : t('components.tools.terminal.executeCommandPanel.copyOutput')"
          @click.stop="copyOutput"
        >
          <span :class="['codicon', copied ? 'codicon-check' : 'codicon-copy']"></span>
        </button>

        <button
          class="icon-btn"
          :title="expanded ? t('common.collapse') : t('common.expand')"
          @click.stop="toggleExpanded"
        >
          <span :class="['codicon', expanded ? 'codicon-chevron-down' : 'codicon-chevron-right']"></span>
        </button>
      </div>
    </div>

    <!-- 终端输出块 -->
    <div v-if="expanded" class="panel-body">
      <div v-if="hasChangeSection" class="changes-card">
        <div class="changes-header" @click="toggleChangesExpanded">
          <i class="codicon" :class="changesExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'"></i>
          <i class="codicon codicon-diff"></i>
          <span class="changes-title">{{ t('components.tools.terminal.executeCommandPanel.fileChanges.title') }}</span>
          <span v-if="changeCount > 0" class="changes-count">({{ changeCount }})</span>
          <span v-if="changeHeaderMeta" class="changes-meta">{{ changeHeaderMeta }}</span>
        </div>

        <div v-if="changesExpanded" class="changes-body">
          <div v-if="changesSummary?.unsupportedReason" class="changes-empty warning">
            <i class="codicon codicon-info"></i>
            <span>{{ t('components.tools.terminal.executeCommandPanel.fileChanges.notSupported') }}</span>
          </div>

          <div v-else-if="changedFiles.length === 0" class="changes-empty">
            <i class="codicon codicon-check"></i>
            <span>{{ t('components.tools.terminal.executeCommandPanel.fileChanges.noChanges') }}</span>
          </div>

          <div v-else class="changes-list">
            <div v-for="f in changedFiles" :key="f.path" class="change-item">
              <div class="change-row">
                <i class="codicon change-icon" :class="getActionIcon(f.action)"></i>
                <code class="change-path" :title="f.fromPath ? `${f.fromPath} → ${f.path}` : f.path">
                  {{ f.fromPath ? `${f.fromPath} → ${f.path}` : f.path }}
                </code>
                <span class="change-action" :class="`action-${f.action}`">{{ getActionLabel(f.action) }}</span>

                <span v-if="getDiffStatsForFile(f.path)" class="change-stats">
                  +{{ getDiffStatsForFile(f.path)!.added }} / -{{ getDiffStatsForFile(f.path)!.deleted }}
                </span>
                <span v-else-if="f.diffContentId" class="change-stats placeholder">+— / -—</span>

                <span v-if="f.skippedReason" class="change-skipped" :title="String(f.skippedReason)">
                  {{ t('components.tools.terminal.executeCommandPanel.fileChanges.diffUnavailable') }}
                </span>

                <div class="change-actions" @click.stop>
                  <button
                    class="small-btn"
                    :disabled="!f.diffContentId"
                    :title="f.diffContentId ? t('components.tools.terminal.executeCommandPanel.fileChanges.expandDiff') : (f.skippedReason || t('components.tools.terminal.executeCommandPanel.fileChanges.diffUnavailable'))"
                    @click.stop="toggleFileDiff(f)"
                  >
                    <i class="codicon" :class="isDiffExpanded(f.path) ? 'codicon-chevron-up' : 'codicon-chevron-down'"></i>
                    {{ t('components.tools.terminal.executeCommandPanel.fileChanges.expandDiff') }}
                  </button>
                  <button
                    class="small-btn"
                    :disabled="!f.diffContentId"
                    @click.stop="openFileDiffInVSCode(f)"
                  >
                    <i class="codicon codicon-open-preview"></i>
                    {{ t('components.tools.terminal.executeCommandPanel.fileChanges.viewInVSCode') }}
                  </button>
                  <button class="small-btn" @click.stop="openChangedFile(f)">
                    <i class="codicon codicon-go-to-file"></i>
                    {{ t('components.tools.terminal.executeCommandPanel.fileChanges.openFile') }}
                  </button>
                </div>
              </div>

              <div v-if="isDiffExpanded(f.path)" class="change-diff">
                <div v-if="isLoadingDiff(f.path)" class="diff-loading">
                  <i class="codicon codicon-loading codicon-modifier-spin"></i>
                  <span>{{ t('components.tools.terminal.executeCommandPanel.fileChanges.loadingDiff') }}</span>
                </div>

                <div v-else-if="getDiffError(f.path)" class="diff-loading error">
                  <i class="codicon codicon-error"></i>
                  <span>{{ getDiffError(f.path) }}</span>
                </div>

                <div v-else-if="getDiffContent(f.path)" class="diff-view">
                  <CustomScrollbar :horizontal="true" :max-height="260">
                    <div class="diff-lines">
                      <div
                        v-for="(line, idx) in getDisplayDiffLines(getDiffLines(f.path) || [], f.path)"
                        :key="idx"
                        :class="['diff-line', `line-${line.type}`]"
                      >
                        <span class="line-nums">
                          <span class="old-num">{{ formatLineNum(line.oldLineNum, getDiffLineNumWidth(getDiffContent(f.path)!)) }}</span>
                          <span class="new-num">{{ formatLineNum(line.newLineNum, getDiffLineNumWidth(getDiffContent(f.path)!)) }}</span>
                        </span>
                        <span class="line-marker">
                          <span v-if="line.type === 'deleted'" class="marker deleted">-</span>
                          <span v-else-if="line.type === 'added'" class="marker added">+</span>
                          <span v-else class="marker unchanged">&nbsp;</span>
                        </span>
                        <span class="line-content">{{ line.content || ' ' }}</span>
                      </div>
                    </div>
                  </CustomScrollbar>

                  <div
                    v-if="needsDiffExpand(getDiffLines(f.path) || [])"
                    class="expand-section"
                  >
                    <button class="expand-btn" @click.stop="toggleDiffExpand(f.path)">
                      <i class="codicon" :class="isDiffFullyExpanded(f.path) ? 'codicon-chevron-up' : 'codicon-chevron-down'"></i>
                      {{
                        isDiffFullyExpanded(f.path)
                          ? t('common.collapse')
                          : t('components.tools.terminal.executeCommandPanel.fileChanges.expandRemaining', {
                              count: (getDiffLines(f.path) || []).length - previewDiffLineCount
                            })
                      }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="hasNextSuggestions" class="next-commands">
        <div class="next-commands-title">
          <i class="codicon codicon-lightbulb"></i>
          <span>{{ t('components.tools.terminal.executeCommandPanel.nextCommandsTitle') }}</span>
        </div>
        <div class="next-commands-list">
          <div v-for="c in nextCommandSuggestions" :key="c" class="next-command-row">
            <code class="next-command-code">{{ c }}</code>
            <button
              class="icon-btn"
              :class="{ success: copiedSuggestion === c }"
              :title="copiedSuggestion === c ? t('common.copied') : t('common.copy')"
              @click.stop="copySuggestionCommand(c)"
            >
              <span :class="['codicon', copiedSuggestion === c ? 'codicon-check' : 'codicon-copy']"></span>
            </button>
          </div>
        </div>
      </div>

      <div v-if="error || resultData.error" class="output-content error">
        <pre class="output-code"><code>{{ error || resultData.error }}</code></pre>
      </div>

      <div v-else-if="output || isRunning" class="output-content">
        <CustomScrollbar
          ref="outputScrollRef"
          :horizontal="true"
          :max-height="300"
          :sticky-bottom="isRunning"
        >
          <pre class="output-code"><code>{{ output || t('components.tools.terminal.executeCommandPanel.waitingOutput') }}</code></pre>
        </CustomScrollbar>
      </div>

      <div v-else class="output-empty">
        <span class="codicon codicon-info"></span>
        <span>{{ t('components.tools.terminal.executeCommandPanel.noOutput') }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.execute-command-panel {
  border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
  border-radius: 8px;
  overflow: hidden;
  background: var(--vscode-editor-background);
}

/* 头部信息栏 */
.panel-header {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--vscode-editor-inactiveSelectionBackground);
  cursor: pointer;
  user-select: none;
  min-width: 0;
}

.panel-header:hover {
  background: var(--vscode-list-hoverBackground);
}

.execute-command-panel.running .panel-header::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--vscode-charts-blue) 30%,
    transparent 60%
  );
  background-size: 200% 100%;
  animation: running-bar 1.2s linear infinite;
  opacity: 0.7;
}

@keyframes running-bar {
  from {
    background-position: 0% 0%;
  }
  to {
    background-position: 200% 0%;
  }
}

.status-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.status-icon.success {
  color: var(--vscode-testing-iconPassed);
}

.status-icon.error {
  color: var(--vscode-testing-iconFailed);
}

.status-icon.terminated {
  color: var(--vscode-descriptionForeground);
}

.status-icon.running {
  color: var(--vscode-charts-blue);
}

.status-icon.pending {
  color: var(--vscode-descriptionForeground);
}

.prompt {
  color: var(--vscode-terminal-ansiGreen);
  font-family: var(--vscode-editor-font-family);
  font-weight: 700;
  flex-shrink: 0;
}

.changes-card {
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  overflow: hidden;
  background: rgba(127, 127, 127, 0.04);
  margin-bottom: 10px;
}

.changes-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  cursor: pointer;
  user-select: none;
}

.changes-header:hover {
  background: var(--vscode-list-hoverBackground);
}

.changes-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--vscode-foreground);
  flex-shrink: 0;
}

.changes-count {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  flex-shrink: 0;
}

.changes-meta {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.changes-body {
  border-top: 1px solid var(--vscode-panel-border);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.changes-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}

.changes-empty.warning {
  color: var(--vscode-notificationsWarningIcon-foreground, #cca700);
}

.changes-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.change-item {
  border: 1px solid rgba(128, 128, 128, 0.18);
  border-radius: 8px;
  overflow: hidden;
  background: rgba(127, 127, 127, 0.03);
}

.change-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  min-width: 0;
}

.change-icon {
  font-size: 14px;
  opacity: 0.85;
  flex-shrink: 0;
}

.change-path {
  font-family: var(--vscode-editor-font-family);
  font-size: 11px;
  color: var(--vscode-foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 1;
}

.change-action {
  display: inline-flex;
  align-items: center;
  height: 16px;
  padding: 0 6px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  border: 1px solid transparent;
  white-space: nowrap;
  flex-shrink: 0;
  opacity: 0.9;
}

.change-action.action-created {
  color: var(--vscode-testing-iconPassed, #2ea043);
  background: rgba(40, 167, 69, 0.15);
  border-color: rgba(40, 167, 69, 0.35);
}

.change-action.action-modified {
  color: var(--vscode-charts-blue, #2f81f7);
  background: rgba(47, 129, 247, 0.15);
  border-color: rgba(47, 129, 247, 0.35);
}

.change-action.action-deleted {
  color: var(--vscode-testing-iconFailed, #f85149);
  background: rgba(248, 81, 73, 0.15);
  border-color: rgba(248, 81, 73, 0.35);
}

.change-action.action-renamed {
  color: var(--vscode-charts-yellow, #d29922);
  background: rgba(210, 153, 34, 0.15);
  border-color: rgba(210, 153, 34, 0.35);
}

.change-stats {
  font-size: 10px;
  color: var(--vscode-descriptionForeground);
  white-space: nowrap;
  flex-shrink: 0;
  opacity: 0.85;
}

.change-stats.placeholder {
  opacity: 0.6;
}

.change-skipped {
  font-size: 10px;
  color: var(--vscode-notificationsWarningIcon-foreground, #cca700);
  white-space: nowrap;
  flex-shrink: 0;
}

.change-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.small-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid rgba(128, 128, 128, 0.22);
  background: rgba(127, 127, 127, 0.04);
  color: var(--vscode-foreground);
  font-size: 11px;
  cursor: pointer;
  transition: background-color var(--transition-fast, 0.1s), border-color var(--transition-fast, 0.1s);
  white-space: nowrap;
}

.small-btn:hover:not(:disabled) {
  background: rgba(127, 127, 127, 0.07);
  border-color: rgba(128, 128, 128, 0.32);
}

.small-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.change-diff {
  border-top: 1px solid rgba(128, 128, 128, 0.18);
  padding: 8px 10px 10px;
}

.diff-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}

.diff-loading.error {
  color: var(--vscode-testing-iconFailed, #f85149);
}

.diff-view {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.expand-section {
  display: flex;
  justify-content: center;
}

.expand-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 8px;
  border: 1px solid rgba(128, 128, 128, 0.22);
  background: rgba(127, 127, 127, 0.04);
  color: var(--vscode-descriptionForeground);
  cursor: pointer;
  font-size: 11px;
  transition: background-color var(--transition-fast, 0.1s), border-color var(--transition-fast, 0.1s);
}

.expand-btn:hover {
  background: rgba(127, 127, 127, 0.07);
  border-color: rgba(128, 128, 128, 0.32);
}

.diff-lines {
  font-family: var(--vscode-editor-font-family);
  font-size: 11px;
  line-height: 1.6;
}

.diff-line {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 0 6px;
  white-space: pre;
}

.diff-line.line-unchanged {
  background: transparent;
}

.diff-line.line-deleted {
  background: rgba(248, 81, 73, 0.12);
}

.diff-line.line-added {
  background: rgba(40, 167, 69, 0.12);
}

.line-nums {
  display: inline-flex;
  gap: 6px;
  color: var(--vscode-editorLineNumber-foreground);
  opacity: 0.8;
  min-width: 64px;
  flex-shrink: 0;
}

.line-nums .old-num,
.line-nums .new-num {
  display: inline-block;
  min-width: 1ch;
}

.line-marker {
  display: inline-flex;
  justify-content: center;
  width: 12px;
  flex-shrink: 0;
  opacity: 0.9;
}

.marker.deleted {
  color: var(--vscode-testing-iconFailed, #f85149);
}

.marker.added {
  color: var(--vscode-testing-iconPassed, #2ea043);
}

.line-content {
  min-width: 0;
}

.command-text {
  flex: 1;
  min-width: 0;
  font-family: var(--vscode-editor-font-family);
  font-size: 12px;
  font-weight: 600;
  color: var(--vscode-foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.truncated-indicator {
  font-size: 14px;
  color: var(--vscode-descriptionForeground);
  flex-shrink: 0;
  opacity: 0.8;
}

.duration {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  flex-shrink: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  opacity: 0.75;
  transition: opacity var(--transition-fast, 0.1s);
}

.execute-command-panel:hover .header-actions {
  opacity: 1;
}

.icon-btn {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: var(--vscode-descriptionForeground);
  cursor: pointer;
  transition: background var(--transition-fast, 0.1s),
    color var(--transition-fast, 0.1s),
    opacity var(--transition-fast, 0.1s);
}

.icon-btn:hover {
  background: var(--vscode-toolbar-hoverBackground);
  color: var(--vscode-foreground);
}

.icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.icon-btn.success {
  color: var(--vscode-testing-iconPassed);
}

.icon-btn.danger {
  color: var(--vscode-testing-iconFailed);
}

.icon-btn.danger:hover {
  background: var(--vscode-inputValidation-errorBackground);
  border-color: var(--vscode-inputValidation-errorBorder);
  color: var(--vscode-inputValidation-errorForeground);
}

/* 输出块 */
.panel-body {
  border-top: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
}

.next-commands {
  border-bottom: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
  background: rgba(127, 127, 127, 0.04);
}

.next-commands-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--vscode-foreground);
}

.next-commands-list {
  display: flex;
  flex-direction: column;
}

.next-command-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-top: 1px solid var(--vscode-panel-border);
}

.next-command-row:first-child {
  border-top: none;
}

.next-command-code {
  flex: 1;
  min-width: 0;
  font-family: var(--vscode-editor-font-family);
  font-size: 12px;
  color: var(--vscode-foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.output-content {
  background: var(--vscode-terminal-background, var(--vscode-editor-background));
}

.output-content.error {
  background: var(--vscode-inputValidation-errorBackground);
}

.output-content :deep(.scroll-container) {
  background: transparent;
}

.output-code {
  margin: 0;
  padding: 8px 12px;
  font-size: 12px;
  font-family: var(--vscode-editor-font-family);
  color: var(--vscode-terminal-foreground, var(--vscode-foreground));
  line-height: 1.4;
  white-space: pre;
}

.output-code code {
  font-family: inherit;
}

.output-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 12px;
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
}
</style>
