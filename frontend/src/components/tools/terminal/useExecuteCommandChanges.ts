import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import { loadDiffContent as loadDiffContentFromBackend, sendToExtension } from '../../../utils/vscode'
import {
  computeDiffLines,
  getDiffStats,
  type ChangedFileEntry,
  type ChangesSummary,
  type DiffContent,
  type DiffLine,
  type DiffStats,
  type FileChangeAction
} from './executeCommandDiff'

export interface ExecuteCommandPanelProps {
  args: Record<string, unknown>
  result?: Record<string, unknown>
  error?: string
  status?: 'pending' | 'running' | 'success' | 'error' | 'warning'
  toolId?: string
  embedded?: boolean
}

export function useExecuteCommandChanges(options: {
  t: (key: string, params?: Record<string, unknown>) => string
  props: ExecuteCommandPanelProps
  resultData: ComputedRef<Record<string, any>>
  isRunning: ComputedRef<boolean>
  expanded: Ref<boolean>
  toggleExpanded: () => void
}) {
  const { t, props, resultData, isRunning, expanded, toggleExpanded } = options

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

  const changeCount = computed(() => changesSummary.value?.totalFiles ?? changedFiles.value.length)

  const hasChangeSection = computed(() => {
    if (isRunning.value) return false
    const summary = changesSummary.value
    if (summary?.unsupportedReason) return true
    return changeCount.value > 0
  })

  const changeHeaderMeta = computed(() => {
    const s = changesSummary.value
    if (!s) return ''

    if (s.unsupportedReason) {
      return t('components.tools.terminal.executeCommandPanel.fileChanges.unsupported')
    }

    const parts: string[] = []
    if (s.diffAvailableFiles > 0) {
      parts.push(
        t('components.tools.terminal.executeCommandPanel.fileChanges.diffAvailable', { count: s.diffAvailableFiles })
      )
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

  function toggleChangesExpanded() {
    changesExpanded.value = !changesExpanded.value
  }

  watch(
    () => props.toolId,
    () => {
      changesExpanded.value = false
    },
    { immediate: true }
  )

  const headerChangesPreviewLimit = 2

  function getPathBasename(p: string): string {
    const normalized = String(p || '').replace(/\\/g, '/')
    const parts = normalized.split('/').filter(Boolean)
    return parts.length > 0 ? parts[parts.length - 1] : normalized
  }

  const showHeaderChangesPreview = computed(() => {
    if (isRunning.value) return false
    if (expanded.value) return false
    return changedFiles.value.length > 0
  })

  const headerPreviewFiles = computed(() => changedFiles.value.slice(0, headerChangesPreviewLimit))

  const headerMoreCount = computed(() => {
    const total = changeCount.value
    const shown = headerPreviewFiles.value.length
    return Math.max(0, total - shown)
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

  function setDiffExpanded(filePath: string, nextExpanded: boolean) {
    const next = new Set(expandedDiffFiles.value)
    if (nextExpanded) next.add(filePath)
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

  async function handleHeaderChangeClick(file: ChangedFileEntry) {
    if (!file.path) return

    if (file.diffContentId) {
      await openFileDiffInVSCode(file)
      return
    }

    toggleExpanded()
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

  const expandedFiles = ref<Set<string>>(new Set())

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

  return {
    changedFiles,
    changesSummary,
    hasChangeSection,
    changeCount,
    changeHeaderMeta,
    changesExpanded,
    toggleChangesExpanded,
    getPathBasename,
    showHeaderChangesPreview,
    headerPreviewFiles,
    headerMoreCount,
    handleHeaderChangeClick,
    toggleFileDiff,
    isDiffExpanded,
    isLoadingDiff,
    getDiffContent,
    getDiffLines,
    getDiffError,
    getDiffStatsForFile,
    openFileDiffInVSCode,
    openChangedFile,
    getActionLabel,
    getActionIcon,
    needsDiffExpand,
    getDisplayDiffLines,
    toggleDiffExpand,
    isDiffFullyExpanded,
    previewDiffLineCount
  }
}

