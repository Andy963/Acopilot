import { computed, onMounted, ref, watch, type ComputedRef } from 'vue'
import { getGitStatusForPaths, saveWorkspaceFile, stageGitFile, unstageGitFile } from '@/utils/vscode'

export interface GitFileStatus {
  xy: string
  staged: boolean
  unstaged: boolean
  untracked: boolean
}

export function useWriteFileGit(paths: ComputedRef<string[]>) {
  const gitStatuses = ref<Map<string, GitFileStatus>>(new Map())
  const gitLoading = ref<Set<string>>(new Set())

  function getGitStatus(path: string): GitFileStatus | null {
    return gitStatuses.value.get(path) || null
  }

  function isGitLoading(path: string): boolean {
    return gitLoading.value.has(path)
  }

  function setGitLoading(path: string, loading: boolean) {
    const next = new Set(gitLoading.value)
    if (loading) next.add(path)
    else next.delete(path)
    gitLoading.value = next
  }

  async function refreshGitStatus(targetPaths?: string[]) {
    const currentPaths = paths.value
    const refreshPaths = targetPaths && targetPaths.length > 0 ? targetPaths : currentPaths
    if (refreshPaths.length === 0) {
      gitStatuses.value = new Map()
      return
    }

    const resp = await getGitStatusForPaths(refreshPaths)
    const statuses = resp?.statuses || {}

    const next = new Map(gitStatuses.value)
    for (const p of refreshPaths) {
      const entry = statuses[p] as any
      if (entry && !entry.error && (entry.staged || entry.unstaged || entry.untracked)) {
        next.set(p, entry as GitFileStatus)
      } else {
        next.delete(p)
      }
    }

    if (!targetPaths) {
      for (const existing of next.keys()) {
        if (!currentPaths.includes(existing)) next.delete(existing)
      }
    }

    gitStatuses.value = next
  }

  const pathsKey = computed(() => paths.value.join('\n'))
  watch(
    pathsKey,
    () => {
      void refreshGitStatus()
    },
    { immediate: true }
  )

  onMounted(() => {
    void refreshGitStatus()
  })

  async function handleStageFile(path: string) {
    if (!path || isGitLoading(path)) return
    setGitLoading(path, true)
    try {
      await saveWorkspaceFile(path)
      await stageGitFile(path)
    } finally {
      setGitLoading(path, false)
      await refreshGitStatus([path])
    }
  }

  async function handleUnstageFile(path: string) {
    if (!path || isGitLoading(path)) return
    setGitLoading(path, true)
    try {
      await unstageGitFile(path)
    } finally {
      setGitLoading(path, false)
      await refreshGitStatus([path])
    }
  }

  return {
    gitStatuses,
    gitLoading,
    getGitStatus,
    isGitLoading,
    refreshGitStatus,
    handleStageFile,
    handleUnstageFile
  }
}

