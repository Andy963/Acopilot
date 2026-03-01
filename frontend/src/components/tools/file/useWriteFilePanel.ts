import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  applyWorkspaceFileContent,
  deleteWorkspaceFile,
  loadDiffContent as loadDiffContentFromBackend,
  saveWorkspaceFile,
} from '@/utils/vscode'
import { getContentLines } from './writeFileUtils'
import { useWriteFileGit } from './useWriteFileGit'

export interface WriteFilePanelProps {
  args: Record<string, unknown>
  result?: Record<string, unknown>
  error?: string
}

interface WriteFileEntry {
  path: string
  content: string
}

interface WriteResult {
  path: string
  success: boolean
  action?: 'created' | 'modified' | 'unchanged'
  status?: string
  error?: string
  diffContentId?: string
  lineCount?: number
}

interface DiffContent {
  originalContent: string
  newContent: string
  filePath: string
}

interface MergedFile {
  path: string
  content: string
  result: WriteResult | undefined
}

export function useWriteFilePanel(props: WriteFilePanelProps, options: { t: (key: string, params?: any) => string }) {
  const { t } = options

  const expandedFiles = ref<Set<string>>(new Set())

  const copiedFiles = ref<Set<string>>(new Set())
  const copyTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

  const diffContents = ref<Map<string, DiffContent>>(new Map())
  const loadingDiffs = ref<Set<string>>(new Set())
  const diffLoadErrors = ref<Map<string, string>>(new Map())

  const viewModes = ref<Map<string, 'content' | 'diff'>>(new Map())

  const fileList = computed((): WriteFileEntry[] => {
    const files = props.args.files as WriteFileEntry[] | undefined
    return files && Array.isArray(files) ? files : []
  })

  const writeResults = computed((): WriteResult[] => {
    const result = props.result as Record<string, any> | undefined
    if (result?.data?.results) {
      return result.data.results as WriteResult[]
    }

    return fileList.value.map((f) => ({
      path: f.path,
      success: !props.error,
      lineCount: f.content?.split('\n').length,
      error: props.error
    }))
  })

  const mergedFiles = computed((): MergedFile[] => {
    return fileList.value.map((entry) => {
      const result = writeResults.value.find((r) => r.path === entry.path)
      return {
        path: entry.path,
        content: entry.content,
        result
      }
    })
  })

  const appliedFiles = ref<Set<string>>(new Set())
  const fileBusy = ref<Set<string>>(new Set())
  const fileOpErrors = ref<Map<string, string>>(new Map())

  const filePaths = computed(() => mergedFiles.value.map((f) => f.path))
  const { getGitStatus, isGitLoading, refreshGitStatus, handleStageFile, handleUnstageFile } = useWriteFileGit(filePaths)

  watch(
    writeResults,
    (results) => {
      const next = new Set<string>()
      for (const result of results) {
        if (result.status === 'accepted') next.add(result.path)
      }
      appliedFiles.value = next
      fileOpErrors.value = new Map()
    },
    { immediate: true }
  )

  function isFileApplied(path: string): boolean {
    return appliedFiles.value.has(path)
  }

  function canApplyFile(file: MergedFile): boolean {
    return file.result?.action !== 'unchanged'
  }

  function canUndoFile(file: MergedFile): boolean {
    if (file.result?.action === 'unchanged') return false
    if (file.result?.action === 'created') return true
    return !!getDiffContent(file.path)
  }

  function isFileBusy(path: string): boolean {
    return fileBusy.value.has(path)
  }

  function setFileBusy(path: string, busy: boolean) {
    const next = new Set(fileBusy.value)
    if (busy) next.add(path)
    else next.delete(path)
    fileBusy.value = next
  }

  function getFileOpError(path: string): string | null {
    return fileOpErrors.value.get(path) || null
  }

  function setFileOpError(path: string, message: string | null) {
    const next = new Map(fileOpErrors.value)
    if (!message) next.delete(path)
    else next.set(path, message)
    fileOpErrors.value = next
  }

  async function handleApplyFile(file: MergedFile) {
    if (!file.path || isFileBusy(file.path) || !canApplyFile(file)) return

    setFileBusy(file.path, true)
    setFileOpError(file.path, null)
    try {
      const diff = getDiffContent(file.path)
      const contentToApply = diff ? diff.newContent : file.content || ''
      const resp = await applyWorkspaceFileContent(file.path, contentToApply, false)

      if (!resp?.success) {
        setFileOpError(file.path, t('common.failed'))
        return
      }

      const next = new Set(appliedFiles.value)
      next.add(file.path)
      appliedFiles.value = next
      await refreshGitStatus([file.path])
    } catch (err: any) {
      setFileOpError(file.path, err?.message || t('common.failed'))
    } finally {
      setFileBusy(file.path, false)
    }
  }

  async function handleUndoFile(file: MergedFile) {
    if (!file.path || isFileBusy(file.path) || !canUndoFile(file)) return

    setFileBusy(file.path, true)
    setFileOpError(file.path, null)
    try {
      if (file.result?.action === 'created') {
        const status = getGitStatus(file.path)
        if (status?.staged) {
          await handleUnstageFile(file.path)
        }

        const resp = await deleteWorkspaceFile(file.path)
        if (!resp?.success) {
          setFileOpError(file.path, t('common.failed'))
          return
        }

        const next = new Set(appliedFiles.value)
        next.delete(file.path)
        appliedFiles.value = next
        await refreshGitStatus([file.path])
        return
      }

      const diff = getDiffContent(file.path)
      if (!diff) {
        setFileOpError(file.path, t('common.failed'))
        return
      }

      const resp = await applyWorkspaceFileContent(file.path, diff.originalContent, false)
      if (!resp?.success) {
        setFileOpError(file.path, t('common.failed'))
        return
      }

      const next = new Set(appliedFiles.value)
      next.delete(file.path)
      appliedFiles.value = next
      await refreshGitStatus([file.path])
    } catch (err: any) {
      setFileOpError(file.path, err?.message || t('common.failed'))
    } finally {
      setFileBusy(file.path, false)
    }
  }

  async function handleSaveFile(file: MergedFile) {
    if (!file.path || isFileBusy(file.path)) return

    setFileBusy(file.path, true)
    setFileOpError(file.path, null)
    try {
      const resp = await saveWorkspaceFile(file.path)
      if (!resp?.success) {
        setFileOpError(file.path, t('common.failed'))
        return
      }

      await refreshGitStatus([file.path])
    } catch (err: any) {
      setFileOpError(file.path, err?.message || t('common.failed'))
    } finally {
      setFileBusy(file.path, false)
    }
  }

  watch(
    writeResults,
    async (results) => {
      for (const result of results) {
        if (result.diffContentId && !diffContents.value.has(result.path) && !loadingDiffs.value.has(result.path)) {
          await loadDiffContent(result.path, result.diffContentId)
        }
      }
    },
    { immediate: true }
  )

  async function loadDiffContent(filePath: string, diffContentId: string) {
    if (loadingDiffs.value.has(filePath)) return

    loadingDiffs.value.add(filePath)
    diffLoadErrors.value.delete(filePath)

    try {
      const response = await loadDiffContentFromBackend(diffContentId)

      if (response) {
        diffContents.value.set(filePath, response)
        viewModes.value.set(filePath, 'diff')
      } else {
        throw new Error('Failed to load diff content')
      }
    } catch (err) {
      diffLoadErrors.value.set(filePath, err instanceof Error ? err.message : String(err))
      console.error('Failed to load diff content:', err)
    } finally {
      loadingDiffs.value.delete(filePath)
    }
  }

  function getViewMode(path: string): 'content' | 'diff' {
    return viewModes.value.get(path) || 'content'
  }

  function hasDiffContent(path: string): boolean {
    return diffContents.value.has(path)
  }

  function getDiffContent(path: string): DiffContent | undefined {
    return diffContents.value.get(path)
  }

  function isLoadingDiff(path: string): boolean {
    return loadingDiffs.value.has(path)
  }

  const successCount = computed(() => {
    const result = props.result as Record<string, any> | undefined
    if (result?.data?.successCount !== undefined) {
      return result.data.successCount as number
    }
    return writeResults.value.filter((r) => r.success).length
  })

  const failCount = computed(() => {
    const result = props.result as Record<string, any> | undefined
    if (result?.data?.failCount !== undefined) {
      return result.data.failCount as number
    }
    return writeResults.value.filter((r) => !r.success).length
  })

  const previewLineCount = 15

  function getDisplayContent(file: MergedFile): string {
    if (!file.content) return ''
    const lines = getContentLines(file.content)
    const padWidth = String(lines.length).length

    const displayLines = isFileExpanded(file.path) || lines.length <= previewLineCount ? lines : lines.slice(0, previewLineCount)

    return displayLines
      .map((line, index) => `${String(index + 1).padStart(padWidth)} | ${line}`)
      .join('\n')
  }

  function needsExpand(file: MergedFile): boolean {
    const lines = getContentLines(file.content)
    return lines.length > previewLineCount
  }

  function toggleFile(path: string) {
    if (expandedFiles.value.has(path)) {
      expandedFiles.value.delete(path)
    } else {
      expandedFiles.value.add(path)
    }
  }

  function isFileExpanded(path: string): boolean {
    return expandedFiles.value.has(path)
  }

  function isCopied(path: string): boolean {
    return copiedFiles.value.has(path)
  }

  async function copyFileContent(file: MergedFile) {
    if (!file.content) return

    try {
      await navigator.clipboard.writeText(file.content)
      copiedFiles.value.add(file.path)

      const existingTimeout = copyTimeouts.get(file.path)
      if (existingTimeout) {
        clearTimeout(existingTimeout)
      }

      const timeout = setTimeout(() => {
        copiedFiles.value.delete(file.path)
        copyTimeouts.delete(file.path)
      }, 1000)
      copyTimeouts.set(file.path, timeout)
    } catch (err) {
      console.error('Failed to copy file content:', err)
    }
  }

  function getActionIcon(action?: string): string {
    switch (action) {
      case 'created':
        return 'codicon-new-file'
      case 'modified':
        return 'codicon-edit'
      case 'unchanged':
        return 'codicon-file'
      default:
        return 'codicon-save'
    }
  }

  function getActionLabel(action?: string): string {
    switch (action) {
      case 'created':
        return t('components.tools.file.writeFilePanel.actions.created')
      case 'modified':
        return t('components.tools.file.writeFilePanel.actions.modified')
      case 'unchanged':
        return t('components.tools.file.writeFilePanel.actions.unchanged')
      default:
        return t('components.tools.file.writeFilePanel.actions.write')
    }
  }

  const previewDiffLineCount = 20

  function needsDiffExpand(diffLines: any[]): boolean {
    return diffLines.length > previewDiffLineCount
  }

  function getDisplayDiffLines(diffLines: any[], path: string): any[] {
    if (expandedFiles.value.has(path + '_diff') || diffLines.length <= previewDiffLineCount) {
      return diffLines
    }
    return diffLines.slice(0, previewDiffLineCount)
  }

  function toggleDiffExpand(path: string) {
    const key = path + '_diff'
    if (expandedFiles.value.has(key)) {
      expandedFiles.value.delete(key)
    } else {
      expandedFiles.value.add(key)
    }
  }

  function isDiffExpanded(path: string): boolean {
    return expandedFiles.value.has(path + '_diff')
  }

  onBeforeUnmount(() => {
    for (const timeout of copyTimeouts.values()) {
      clearTimeout(timeout)
    }
    copyTimeouts.clear()
  })

  return {
    mergedFiles,
    viewModes,
    writeResults,
    successCount,
    failCount,
    isFileApplied,
    canApplyFile,
    canUndoFile,
    isFileBusy,
    getFileOpError,
    getGitStatus,
    isGitLoading,
    handleApplyFile,
    handleUndoFile,
    handleSaveFile,
    handleStageFile,
    handleUnstageFile,
    getViewMode,
    hasDiffContent,
    getDiffContent,
    isLoadingDiff,
    getDisplayContent,
    needsExpand,
    toggleFile,
    isFileExpanded,
    isCopied,
    copyFileContent,
    getActionIcon,
    getActionLabel,
    needsDiffExpand,
    getDisplayDiffLines,
    toggleDiffExpand,
    isDiffExpanded,
    previewLineCount,
    previewDiffLineCount
  }
}
