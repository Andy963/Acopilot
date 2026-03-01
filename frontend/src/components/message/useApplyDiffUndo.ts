import { ref } from 'vue'
import type { ToolUsage } from '../../types'
import { sendToExtension } from '../../utils/vscode'
import type { Translator } from './toolMessageUtils'

interface ApplyDiffBlock {
  search: string
  replace: string
  start_line?: number
}

function getApplyDiffArgs(tool: ToolUsage): { path: string; diffs: ApplyDiffBlock[] } | null {
  if (tool.name !== 'apply_diff') return null
  const args = (tool.args ?? {}) as Record<string, unknown>
  const path = typeof args.path === 'string' ? args.path : ''
  const diffs = Array.isArray(args.diffs) ? (args.diffs as ApplyDiffBlock[]) : []
  if (!path || diffs.length === 0) return null
  return { path, diffs }
}

function getApplyDiffFailedIndices(tool: ToolUsage): Set<number> {
  const failed = new Set<number>()
  const data = (tool.result as any)?.data

  if (Array.isArray(data?.failedDiffs)) {
    for (const f of data.failedDiffs) {
      if (typeof f?.index === 'number') failed.add(f.index)
    }
  }

  const legacy = Array.isArray(data?.results) ? data.results : Array.isArray(data?.diffs) ? data.diffs : null
  if (Array.isArray(legacy)) {
    for (const r of legacy) {
      if (typeof r?.index === 'number' && r?.success === false) failed.add(r.index)
    }
  }

  return failed
}

export function useApplyDiffUndo(t: Translator) {
  const undoneApplyDiffToolIds = ref<Set<string>>(new Set())
  const undoingApplyDiffToolId = ref<string>('')

  function canUndoApplyDiff(tool: ToolUsage): boolean {
    if (tool.name !== 'apply_diff') return false
    if (!tool.result || tool.error) return false
    if (undoneApplyDiffToolIds.value.has(tool.id)) return false

    const args = getApplyDiffArgs(tool)
    if (!args) return false

    const data = (tool.result as any)?.data
    const appliedCount =
      typeof data?.appliedCount === 'number'
        ? (data.appliedCount as number)
        : Math.max(0, args.diffs.length - getApplyDiffFailedIndices(tool).size)

    return appliedCount > 0
  }

  async function undoApplyDiffTool(tool: ToolUsage) {
    const args = getApplyDiffArgs(tool)
    if (!args) return
    if (!tool.id) return
    if (undoingApplyDiffToolId.value === tool.id) return

    const { path, diffs } = args
    const failed = getApplyDiffFailedIndices(tool)
    const appliedIndices = diffs
      .map((_, i) => i)
      .filter((i) => !failed.has(i))
      .reverse()

    if (appliedIndices.length === 0) return

    undoingApplyDiffToolId.value = tool.id
    let ok = 0
    let fail = 0

    try {
      for (const index of appliedIndices) {
        const diff = diffs[index]
        if (!diff || typeof diff.search !== 'string' || typeof diff.replace !== 'string') continue

        let resp: any = await sendToExtension('patch.applyWorkspaceFileDiffBlock', {
          path,
          from: diff.replace,
          to: diff.search,
          startLine: diff.start_line,
          save: false
        })

        if (!resp?.success && typeof diff.start_line === 'number') {
          resp = await sendToExtension('patch.applyWorkspaceFileDiffBlock', {
            path,
            from: diff.replace,
            to: diff.search,
            save: false
          })
        }

        if (resp?.success) ok++
        else fail++
      }

      await sendToExtension('patch.saveWorkspaceFile', { path })

      if (fail === 0) {
        const next = new Set(undoneApplyDiffToolIds.value)
        next.add(tool.id)
        undoneApplyDiffToolIds.value = next
        await sendToExtension('showNotification', {
          type: 'info',
          message: `${t('common.undo')} (${ok}/${appliedIndices.length})`
        })
      } else {
        await sendToExtension('showNotification', {
          type: 'warning',
          message: `${t('common.undo')} (${ok}/${appliedIndices.length}) - ${t('common.failed')}: ${fail}`
        })
      }
    } catch (err) {
      console.error('Failed to undo apply_diff:', err)
      try {
        await sendToExtension('showNotification', { type: 'error', message: t('common.failed') })
      } catch {
        // ignore
      }
    } finally {
      if (undoingApplyDiffToolId.value === tool.id) undoingApplyDiffToolId.value = ''
    }
  }

  return { canUndoApplyDiff, undoApplyDiffTool, undoingApplyDiffToolId }
}

