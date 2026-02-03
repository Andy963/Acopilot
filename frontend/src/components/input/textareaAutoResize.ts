export const DEFAULT_MIN_ROWS = 3
export const DEFAULT_MAX_ROWS = 8

export interface AutoResizeParams {
  contentHeight: number
  lineHeight: number
  minRows: number
  maxRows: number
}

export interface AutoResizeResult {
  rows: number
  heightPx: number
}

function clampInt(value: number, min: number, max: number): number {
  const v = Math.trunc(value)
  return Math.min(Math.max(v, min), max)
}

export function computeTextareaHeight(params: AutoResizeParams): AutoResizeResult {
  // Keep fractional line-height to avoid under-sizing (e.g. 19.5px -> 19px).
  const lineHeight = Math.max(1, params.lineHeight)
  const minRows = Math.max(1, Math.trunc(params.minRows))
  const maxRows = Math.max(minRows, Math.trunc(params.maxRows))

  const minHeight = minRows * lineHeight
  const targetHeight = Math.max(params.contentHeight, minHeight)

  const rawRows = Math.ceil(targetHeight / lineHeight)
  const rows = clampInt(rawRows, minRows, maxRows)

  return {
    rows,
    heightPx: Math.ceil(rows * lineHeight),
  }
}
