export type FileChangeAction = 'created' | 'modified' | 'deleted' | 'renamed'

export interface ChangedFileEntry {
  path: string
  action: FileChangeAction
  fromPath?: string
  diffContentId?: string | null
  skippedReason?: string | null
}

export interface ChangesSummary {
  totalFiles: number
  diffAvailableFiles: number
  skippedFiles: number
  truncatedFiles?: number
  unsupportedReason?: string
}

export interface DiffContent {
  originalContent: string
  newContent: string
  filePath: string
}

export interface DiffLine {
  type: 'unchanged' | 'deleted' | 'added'
  content: string
  oldLineNum?: number
  newLineNum?: number
}

export interface DiffStats {
  added: number
  deleted: number
}

interface LcsMatch {
  oldIndex: number
  newIndex: number
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
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--
    } else {
      j--
    }
  }

  return result
}

export function computeDiffLines(originalContent: string, newContent: string): DiffLine[] {
  const oldLines = originalContent.split('\n')
  const newLines = newContent.split('\n')
  const result: DiffLine[] = []

  const lcs = computeLcs(oldLines, newLines)

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

export function getDiffStats(lines: DiffLine[]): DiffStats {
  const deleted = lines.filter((l) => l.type === 'deleted').length
  const added = lines.filter((l) => l.type === 'added').length
  return { added, deleted }
}

export function getDiffLineNumWidth(diffContent: DiffContent): number {
  const oldLines = diffContent.originalContent.split('\n').length
  const newLines = diffContent.newContent.split('\n').length
  return String(Math.max(oldLines, newLines)).length
}

export function formatLineNum(num: number | undefined, width: number): string {
  if (num === undefined) return ' '.repeat(width)
  return String(num).padStart(width)
}

