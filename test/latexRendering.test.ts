import { describe, expect, it } from 'vitest'

import {
  processLatex,
  renderLatexOnly,
} from '../frontend/src/components/common/latex'

describe('latex rendering helpers', () => {
  it('renders inline math for both dollar and parenthesis delimiters', () => {
    const html = processLatex('Inline $x^2$ and \\(y^2\\)')

    expect((html.match(/class="katex"/g) ?? []).length).toBe(2)
    expect(html).not.toContain('\\(y^2\\)')
    expect(html).not.toContain('$x^2$')
  })

  it('renders block math for both double-dollar and bracket delimiters', () => {
    const html = processLatex('$$x+1$$\n\\[y+1\\]')

    expect((html.match(/class="katex-block"/g) ?? []).length).toBe(2)
    expect(html).not.toContain('\\[y+1\\]')
    expect(html).not.toContain('$$x+1$$')
  })

  it('preserves plain text formatting while rendering parenthesis delimiters in latex-only mode', () => {
    const html = renderLatexOnly('prefix  \\(x + y\\)\n  suffix')

    expect(html).toContain('prefix')
    expect(html).toContain('suffix')
    expect(html).toContain('katex')
    expect(html).toContain('<br>')
    expect(html).toContain('&nbsp;&nbsp;suffix')
    expect(html).not.toContain('\\(x + y\\)')
  })
})
