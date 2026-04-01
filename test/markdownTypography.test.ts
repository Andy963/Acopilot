import { describe, expect, it } from 'vitest'

import { createTypographyMarkdownIt } from '../frontend/src/components/common/markdownTypography'

describe('markdown typography config', () => {
  it('preserves straight quotes while keeping other typography replacements', () => {
    const md = createTypographyMarkdownIt()
    const html = md.render('"x ∈ ℝ" -- really ...')

    expect(html).toContain('&quot;x ∈ ℝ&quot;')
    expect(html).not.toContain('“')
    expect(html).not.toContain('”')
    expect(html).toContain('–')
    expect(html).toContain('…')
  })
})
