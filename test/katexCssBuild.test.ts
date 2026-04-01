import { describe, expect, it } from 'vitest'

import { stripKatexFontFaceRules } from '../frontend/src/utils/katexCss'

describe('KaTeX CSS build helper', () => {
  it('removes embedded font-face rules while keeping layout rules', () => {
    const css = [
      '@font-face{font-family:KaTeX_Main;src:url(font.woff2) format("woff2")}',
      '.katex{font:normal 1.21em KaTeX_Main,Times New Roman,serif;line-height:1.2}',
      '@font-face{font-family:KaTeX_Math;src:url(math.woff2) format("woff2")}',
      '.katex .base{display:inline-block}',
    ].join('')

    const stripped = stripKatexFontFaceRules(css)

    expect(stripped).not.toContain('@font-face')
    expect(stripped).toContain('.katex{font:normal 1.21em KaTeX_Main,Times New Roman,serif;line-height:1.2}')
    expect(stripped).toContain('.katex .base{display:inline-block}')
  })
})
