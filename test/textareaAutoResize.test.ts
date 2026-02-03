import { describe, expect, it } from 'vitest'

import {
  DEFAULT_MAX_ROWS,
  DEFAULT_MIN_ROWS,
  computeTextareaHeight,
} from '../frontend/src/components/input/textareaAutoResize'

describe('computeTextareaHeight', () => {
  it('uses DEFAULT_* constants that match current UX expectations', () => {
    expect(DEFAULT_MIN_ROWS).toBe(3)
    expect(DEFAULT_MAX_ROWS).toBe(8)
  })

  it('clamps to minRows when content is short', () => {
    const result = computeTextareaHeight({
      contentHeight: 10,
      lineHeight: 19.5,
      minRows: 3,
      maxRows: 8,
    })

    // We ceil heightPx to avoid under-sizing when lineHeight is fractional.
    expect(result).toEqual({ rows: 3, heightPx: 59 })
  })

  it('expands beyond 3 rows and clamps to maxRows when content is long', () => {
    const result = computeTextareaHeight({
      // This matches the observed scrollHeight for a long multi-line input.
      contentHeight: 250,
      lineHeight: 19.5,
      minRows: 3,
      maxRows: 8,
    })

    // Not capped at 3 rows; capped at maxRows=8.
    expect(result).toEqual({ rows: 8, heightPx: 156 })
  })
})
