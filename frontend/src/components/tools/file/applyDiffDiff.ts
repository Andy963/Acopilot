export interface DiffLine {
  type: 'unchanged' | 'deleted' | 'added'
  content: string
  oldLineNum?: number
  newLineNum?: number
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

export function computeDiffLines(search: string, replace: string, startLine: number = 1): DiffLine[] {
  const searchLines = search.split('\n')
  const replaceLines = replace.split('\n')
  const result: DiffLine[] = []

  const lcs = computeLcs(searchLines, replaceLines)

  let oldIdx = 0
  let newIdx = 0
  let oldLineNum = startLine
  let newLineNum = startLine

  for (const match of lcs) {
    while (oldIdx < match.oldIndex) {
      result.push({
        type: 'deleted',
        content: searchLines[oldIdx],
        oldLineNum: oldLineNum++
      })
      oldIdx++
    }

    while (newIdx < match.newIndex) {
      result.push({
        type: 'added',
        content: replaceLines[newIdx],
        newLineNum: newLineNum++
      })
      newIdx++
    }

    result.push({
      type: 'unchanged',
      content: searchLines[oldIdx],
      oldLineNum: oldLineNum++,
      newLineNum: newLineNum++
    })
    oldIdx++
    newIdx++
  }

  while (oldIdx < searchLines.length) {
    result.push({
      type: 'deleted',
      content: searchLines[oldIdx],
      oldLineNum: oldLineNum++
    })
    oldIdx++
  }

  while (newIdx < replaceLines.length) {
    result.push({
      type: 'added',
      content: replaceLines[newIdx],
      newLineNum: newLineNum++
    })
    newIdx++
  }

  return result
}

export function computeFailedPreviewLines(search: string, startLine: number = 1): DiffLine[] {
  const searchLines = search.split('\n')
  let oldLineNum = startLine
  return searchLines.map((content) => ({
    type: 'deleted',
    content,
    oldLineNum: oldLineNum++
  }))
}

export interface DiffBlockLike {
  search: string
  replace: string
  start_line?: number
}

export function getLineNumWidth(diff: DiffBlockLike): number {
  const startLine = diff.start_line || 1
  const searchLines = diff.search.split('\n').length
  const replaceLines = diff.replace.split('\n').length

  const maxOldLineNum = startLine + searchLines - 1
  const maxNewLineNum = startLine + replaceLines - 1
  const maxLineNum = Math.max(maxOldLineNum, maxNewLineNum)
  return String(maxLineNum).length
}

export function formatLineNum(num: number | undefined, width: number): string {
  if (num === undefined) return ' '.repeat(width)
  return String(num).padStart(width)
}

export function getDiffStats(diffLines: DiffLine[]) {
  const deleted = diffLines.filter((l) => l.type === 'deleted').length
  const added = diffLines.filter((l) => l.type === 'added').length
  return { deleted, added }
}

