import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  applyWorkspaceFileDiffBlock,
  getGitStatusForPaths,
  saveWorkspaceFile,
  sendToExtension,
  stageGitFile,
  unstageGitFile
} from '@/utils/vscode'
import type { DiffLine } from './applyDiffDiff'

export interface ApplyDiffPanelProps {
  args: Record<string, unknown>
  result?: Record<string, unknown>
  error?: string
}

interface GitFileStatus {
  xy: string
  staged: boolean
  unstaged: boolean
  untracked: boolean
}

interface DiffBlock {
  search: string
  replace: string
  start_line?: number
  success?: boolean
  error?: string
}

export function useApplyDiffPanel(props: ApplyDiffPanelProps, options: { t: (key: string, params?: any) => string }) {
  const { t } = options

  const expanded = ref<Set<number>>(new Set())

  const appliedHunks = ref<Set<number>>(new Set())
  const hunkBusy = ref<Set<number>>(new Set())
  const hunkErrors = ref<Map<number, string>>(new Map())

  const gitStatus = ref<GitFileStatus | null>(null)
  const gitLoading = ref(false)

  const applyDiffAutoSave = ref(false)
  const applyDiffAutoSaveDelay = ref(3000)
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

  async function loadApplyDiffToolConfig() {
    try {
      const resp = await sendToExtension<{ config?: { autoSave?: boolean; autoSaveDelay?: number } }>('tools.getToolConfig', {
        toolName: 'apply_diff'
      })

      applyDiffAutoSave.value = resp?.config?.autoSave === true
      applyDiffAutoSaveDelay.value =
        typeof resp?.config?.autoSaveDelay === 'number' ? resp.config.autoSaveDelay : 3000
    } catch {
      applyDiffAutoSave.value = false
      applyDiffAutoSaveDelay.value = 3000
    }
  }

  const filePath = computed(() => {
    return (props.args.path as string) || ''
  })

  async function refreshGitStatus() {
    gitStatus.value = null
    if (!filePath.value) return

    gitLoading.value = true
    try {
      const resp = await getGitStatusForPaths([filePath.value])
      const entry = resp?.statuses?.[filePath.value] as any
      if (entry && !entry.error && (entry.staged || entry.unstaged || entry.untracked)) {
        gitStatus.value = entry as GitFileStatus
      }
    } finally {
      gitLoading.value = false
    }
  }

  async function handleStageCurrentFile() {
    if (!filePath.value || gitLoading.value) return
    gitLoading.value = true
    try {
      await saveWorkspaceFile(filePath.value)
      await stageGitFile(filePath.value)
    } finally {
      await refreshGitStatus()
    }
  }

  async function handleUnstageCurrentFile() {
    if (!filePath.value || gitLoading.value) return
    gitLoading.value = true
    try {
      await unstageGitFile(filePath.value)
    } finally {
      await refreshGitStatus()
    }
  }

  async function handleSaveCurrentFile() {
    if (!filePath.value || gitLoading.value) return
    gitLoading.value = true
    try {
      await saveWorkspaceFile(filePath.value)
    } finally {
      await refreshGitStatus()
    }
  }

  function scheduleAutoSaveIfEnabled() {
    if (!applyDiffAutoSave.value) return
    if (!filePath.value) return

    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer)
      autoSaveTimer = null
    }

    autoSaveTimer = setTimeout(async () => {
      try {
        await saveWorkspaceFile(filePath.value)
      } finally {
        await refreshGitStatus()
      }
    }, Math.max(0, applyDiffAutoSaveDelay.value || 0))
  }

  const copiedDiffs = ref<Set<number>>(new Set())
  const copyTimeouts = new Map<number, ReturnType<typeof setTimeout>>()

  const diffList = computed((): DiffBlock[] => {
    const argsDiffs = (props.args.diffs as DiffBlock[] | undefined) || []
    const failedDiffs = (props.result?.data as Record<string, any>)?.failedDiffs as any[] | undefined

    const data = props.result?.data as Record<string, any> | undefined
    if (data?.results || data?.diffs) {
      const results = data.results || data.diffs
      return argsDiffs.map((diff, i) => {
        const res = results.find((r: any) => r.index === i) || {}
        return {
          ...diff,
          success: res.success,
          error: res.error,
          start_line: res.matchedLine ?? res.start_line ?? diff.start_line ?? 1
        }
      })
    }

    return argsDiffs.map((diff, i) => {
      const failure = failedDiffs?.find((f) => f.index === i)
      return {
        ...diff,
        success: !failure,
        error: failure?.error,
        start_line: diff.start_line ?? 1
      }
    })
  })

  watch(
    diffList,
    (list) => {
      const next = new Set<number>()
      for (let i = 0; i < list.length; i++) {
        if (list[i].success !== false) next.add(i)
      }
      appliedHunks.value = next
      hunkErrors.value = new Map()
    },
    { immediate: true }
  )

  function isHunkApplied(index: number): boolean {
    return appliedHunks.value.has(index)
  }

  function isHunkLoading(index: number): boolean {
    return hunkBusy.value.has(index)
  }

  function getHunkError(index: number): string | null {
    return hunkErrors.value.get(index) || null
  }

  function setHunkError(index: number, message: string | null) {
    const next = new Map(hunkErrors.value)
    if (!message) next.delete(index)
    else next.set(index, message)
    hunkErrors.value = next
  }

  function setHunkBusy(index: number, busy: boolean) {
    const next = new Set(hunkBusy.value)
    if (busy) next.add(index)
    else next.delete(index)
    hunkBusy.value = next
  }

  async function applyHunk(diff: DiffBlock, index: number) {
    if (!filePath.value) return
    if (isHunkLoading(index)) return

    setHunkBusy(index, true)
    setHunkError(index, null)
    try {
      const resp = await applyWorkspaceFileDiffBlock({
        path: filePath.value,
        from: diff.search,
        to: diff.replace,
        startLine: diff.start_line,
        save: false
      })

      if (resp?.success) {
        const next = new Set(appliedHunks.value)
        next.add(index)
        appliedHunks.value = next
        await refreshGitStatus()
        scheduleAutoSaveIfEnabled()
        return
      }

      setHunkError(index, resp?.error || t('common.failed'))
    } catch (err: any) {
      setHunkError(index, err?.message || t('common.failed'))
    } finally {
      setHunkBusy(index, false)
    }
  }

  async function undoHunk(diff: DiffBlock, index: number) {
    if (!filePath.value) return
    if (isHunkLoading(index)) return

    setHunkBusy(index, true)
    setHunkError(index, null)
    try {
      const resp = await applyWorkspaceFileDiffBlock({
        path: filePath.value,
        from: diff.replace,
        to: diff.search,
        startLine: diff.start_line,
        save: false
      })

      if (resp?.success) {
        const next = new Set(appliedHunks.value)
        next.delete(index)
        appliedHunks.value = next
        await refreshGitStatus()
        scheduleAutoSaveIfEnabled()
        return
      }

      setHunkError(index, resp?.error || t('common.failed'))
    } catch (err: any) {
      setHunkError(index, err?.message || t('common.failed'))
    } finally {
      setHunkBusy(index, false)
    }
  }

  const resultData = computed(() => {
    const result = props.result as Record<string, any> | undefined
    return result?.data || null
  })

  const isFailed = computed(() => {
    return !!props.error || (resultData.value && resultData.value.appliedCount === 0)
  })

  const isPartial = computed(() => {
    const data = resultData.value
    return !props.error && data && data.appliedCount > 0 && data.failedCount > 0
  })

  const previewLineCount = 20

  function needsExpand(diffLines: DiffLine[]): boolean {
    return diffLines.length > previewLineCount
  }

  function getDisplayLines(diffLines: DiffLine[], index: number): DiffLine[] {
    if (expanded.value.has(index) || diffLines.length <= previewLineCount) {
      return diffLines
    }
    return diffLines.slice(0, previewLineCount)
  }

  function toggleExpand(index: number) {
    if (expanded.value.has(index)) {
      expanded.value.delete(index)
    } else {
      expanded.value.add(index)
    }
  }

  function isExpanded(index: number): boolean {
    return expanded.value.has(index)
  }

  function isCopied(index: number): boolean {
    return copiedDiffs.value.has(index)
  }

  async function copyReplace(diff: DiffBlock, index: number) {
    try {
      await navigator.clipboard.writeText(diff.replace)

      copiedDiffs.value.add(index)

      const existingTimeout = copyTimeouts.get(index)
      if (existingTimeout) {
        clearTimeout(existingTimeout)
      }

      const timeout = setTimeout(() => {
        copiedDiffs.value.delete(index)
        copyTimeouts.delete(index)
      }, 1000)
      copyTimeouts.set(index, timeout)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  onMounted(() => {
    refreshGitStatus()
    loadApplyDiffToolConfig()
  })

  watch(filePath, () => {
    refreshGitStatus()
  })

  onBeforeUnmount(() => {
    for (const timeout of copyTimeouts.values()) {
      clearTimeout(timeout)
    }
    copyTimeouts.clear()
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer)
      autoSaveTimer = null
    }
  })

  return {
    filePath,
    gitStatus,
    gitLoading,
    handleSaveCurrentFile,
    handleStageCurrentFile,
    handleUnstageCurrentFile,
    resultData,
    isFailed,
    isPartial,
    diffList,
    isHunkApplied,
    isHunkLoading,
    getHunkError,
    applyHunk,
    undoHunk,
    isCopied,
    copyReplace,
    previewLineCount,
    needsExpand,
    getDisplayLines,
    toggleExpand,
    isExpanded
  }
}
