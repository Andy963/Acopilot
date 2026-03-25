import { computed, ref, watch } from 'vue'
import { useI18n } from '../../../composables/useI18n'
import { loadDiffContent as loadDiffContentFromBackend } from '@/utils/vscode'

export interface SearchInFilesPanelProps {
  args: Record<string, unknown>
  result?: Record<string, unknown>
  error?: string
}

interface SearchMatch {
  file: string
  workspace?: string
  line: number
  column: number
  match: string
  context: string
}

interface ReplaceResult {
  file: string
  workspace?: string
  replacements: number
  diffContentId?: string
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

interface LcsMatch {
  oldIndex: number
  newIndex: number
}

const PREVIEW_MATCH_COUNT = 10
export const PREVIEW_DIFF_LINE_COUNT = 20

function getFileName(filePath: string | undefined): string {
  if (!filePath) return ''
  const parts = filePath.split(/[/\\]/)
  return parts[parts.length - 1] || filePath
}

function highlightMatch(context: string | undefined, match: string | undefined): string {
  if (!context) return ''
  if (!match) return context

  const escaped = match.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')
  return context.replace(new RegExp(escaped, 'gi'), `<mark>${match}</mark>`)
}

function computeLcs(oldLines: string[], newLines: string[]): LcsMatch[] {
  const m = oldLines.length
  const n = newLines.length

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  const result: LcsMatch[] = []
  let i = m
  let j = n
  while (i > 0 && j > 0) {
    if (oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({ oldIndex: i - 1, newIndex: j - 1 })
      i--
      j--
      continue
    }

    if (dp[i - 1][j] > dp[i][j - 1]) {
      i--
    } else {
      j--
    }
  }

  return result
}

function computeDiffLines(originalContent: string, newContent: string): DiffLine[] {
  const oldLines = originalContent.split('\n')
  const newLines = newContent.split('\n')
  const lcs = computeLcs(oldLines, newLines)

  const result: DiffLine[] = []

  let oldIdx = 0
  let newIdx = 0
  let oldLineNum = 1
  let newLineNum = 1

  for (const match of lcs) {
    while (oldIdx < match.oldIndex) {
      result.push({
        type: 'deleted',
        content: oldLines[oldIdx],
        oldLineNum: oldLineNum++,
      })
      oldIdx++
    }

    while (newIdx < match.newIndex) {
      result.push({
        type: 'added',
        content: newLines[newIdx],
        newLineNum: newLineNum++,
      })
      newIdx++
    }

    result.push({
      type: 'unchanged',
      content: oldLines[oldIdx],
      oldLineNum: oldLineNum++,
      newLineNum: newLineNum++,
    })
    oldIdx++
    newIdx++
  }

  while (oldIdx < oldLines.length) {
    result.push({
      type: 'deleted',
      content: oldLines[oldIdx],
      oldLineNum: oldLineNum++,
    })
    oldIdx++
  }

  while (newIdx < newLines.length) {
    result.push({
      type: 'added',
      content: newLines[newIdx],
      newLineNum: newLineNum++,
    })
    newIdx++
  }

  return result
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

function getDiffStats(diffLines: DiffLine[]) {
  const deleted = diffLines.filter(l => l.type === 'deleted').length
  const added = diffLines.filter(l => l.type === 'added').length
  return { deleted, added }
}

export function useSearchInFilesPanel(props: SearchInFilesPanelProps) {
  const { t } = useI18n()

  const expanded = ref(false)

  const searchQuery = computed(() => (props.args.query as string) || '')
  const searchPath = computed(() => (props.args.path as string) || '.')
  const filePattern = computed(() => (props.args.pattern as string) || '**/*')
  const isRegex = computed(() => (props.args.isRegex as boolean) || false)
  const replacement = computed(() => props.args.replace as string | undefined)
  const dryRun = computed(() => (props.args.dryRun as boolean) || false)

  const isReplaceMode = computed(() => typeof (props.args as any).replace === 'string')

  const searchResults = computed((): SearchMatch[] => {
    const result = props.result as Record<string, any> | undefined
    if (isReplaceMode.value) return (result?.data?.matches as SearchMatch[]) || []
    return (result?.data?.results as SearchMatch[]) || []
  })

  const replaceResults = computed((): ReplaceResult[] => {
    const result = props.result as Record<string, any> | undefined
    if (!isReplaceMode.value) return []
    return (result?.data?.results as ReplaceResult[]) || []
  })

  const matchCount = computed(() => {
    const result = props.result as Record<string, any> | undefined
    if (isReplaceMode.value) return (result?.data?.totalReplacements as number) || 0
    if (result?.data?.count !== undefined) return result.data.count as number
    return searchResults.value.length
  })

  const filesModified = computed(() => {
    const result = props.result as Record<string, any> | undefined
    return (result?.data?.filesModified as number) || 0
  })

  const truncated = computed(() => {
    const result = props.result as Record<string, any> | undefined
    return (result?.data?.truncated as boolean) || false
  })

  const groupedResults = computed(() => {
    const groups: Record<string, SearchMatch[]> = {}
    for (const match of searchResults.value) {
      if (!groups[match.file]) groups[match.file] = []
      groups[match.file].push(match)
    }
    return groups
  })

  const fileCount = computed(() => Object.keys(groupedResults.value).length)

  const displayResults = computed(() => {
    if (expanded.value || searchResults.value.length <= PREVIEW_MATCH_COUNT) return searchResults.value
    return searchResults.value.slice(0, PREVIEW_MATCH_COUNT)
  })

  const needsExpand = computed(() => searchResults.value.length > PREVIEW_MATCH_COUNT)

  function toggleExpand() {
    expanded.value = !expanded.value
  }

  const diffContents = ref<Map<string, DiffContent>>(new Map())
  const loadingDiffs = ref<Set<string>>(new Set())
  const diffLoadErrors = ref<Map<string, string>>(new Map())
  const viewModes = ref<Map<string, 'matches' | 'diff'>>(new Map())

  async function loadDiffContent(filePath: string, diffContentId: string) {
    if (loadingDiffs.value.has(filePath)) return

    loadingDiffs.value.add(filePath)
    diffLoadErrors.value.delete(filePath)

    try {
      const response = await loadDiffContentFromBackend(diffContentId)
      if (!response) throw new Error('Failed to load diff content')

      diffContents.value.set(filePath, response)
      viewModes.value.set(filePath, 'diff')
    } catch (err) {
      diffLoadErrors.value.set(filePath, err instanceof Error ? err.message : String(err))
      console.error('Failed to load diff content:', err)
    } finally {
      loadingDiffs.value.delete(filePath)
    }
  }

  watch(
    replaceResults,
    async (results) => {
      for (const result of results) {
        if (!result.diffContentId) continue
        if (diffContents.value.has(result.file)) continue
        if (loadingDiffs.value.has(result.file)) continue
        await loadDiffContent(result.file, result.diffContentId)
      }
    },
    { immediate: true },
  )

  function getViewMode(path: string): 'matches' | 'diff' {
    return viewModes.value.get(path) || 'matches'
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

  const expandedDiffs = ref<Set<string>>(new Set())

  function needsDiffExpand(diffLines: DiffLine[]): boolean {
    return diffLines.length > PREVIEW_DIFF_LINE_COUNT
  }

  function getDisplayDiffLines(diffLines: DiffLine[], path: string): DiffLine[] {
    if (expandedDiffs.value.has(path) || diffLines.length <= PREVIEW_DIFF_LINE_COUNT) return diffLines
    return diffLines.slice(0, PREVIEW_DIFF_LINE_COUNT)
  }

  function toggleDiffExpand(path: string) {
    if (expandedDiffs.value.has(path)) {
      expandedDiffs.value.delete(path)
    } else {
      expandedDiffs.value.add(path)
    }
  }

  function isDiffExpanded(path: string): boolean {
    return expandedDiffs.value.has(path)
  }

  return {
    t,
    expanded,
    searchQuery,
    searchPath,
    filePattern,
    isRegex,
    replacement,
    dryRun,
    isReplaceMode,
    searchResults,
    replaceResults,
    matchCount,
    filesModified,
    truncated,
    groupedResults,
    fileCount,
    previewMatchCount: PREVIEW_MATCH_COUNT,
    displayResults,
    needsExpand,
    toggleExpand,
    getFileName,
    highlightMatch,
    diffLoadErrors,
    viewModes,
    getViewMode,
    hasDiffContent,
    getDiffContent,
    isLoadingDiff,
    loadDiffContent,
    computeDiffLines,
    getDiffLineNumWidth,
    formatLineNum,
    getDiffStats,
    previewDiffLineCount: PREVIEW_DIFF_LINE_COUNT,
    expandedDiffs,
    needsDiffExpand,
    getDisplayDiffLines,
    toggleDiffExpand,
    isDiffExpanded,
  }
}
