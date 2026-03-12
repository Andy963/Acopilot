import { describe, expect, it } from 'vitest'

import {
  getMarkdownCodeBlockRenderBehavior,
  renderMarkdownCodeBlock,
} from '../frontend/src/components/common/markdownCodeBlock'

describe('markdown code block rendering', () => {
  it('disables highlight and copy button while streaming', () => {
    expect(getMarkdownCodeBlockRenderBehavior(true)).toEqual({
      enableCodeHighlight: false,
      showCopyButton: false,
    })
  })

  it('keeps highlight and copy button when streaming is complete', () => {
    expect(getMarkdownCodeBlockRenderBehavior(false)).toEqual({
      enableCodeHighlight: true,
      showCopyButton: true,
    })
  })

  it('omits the copy button HTML when requested', () => {
    const html = renderMarkdownCodeBlock({
      encodedCode: 'abc',
      highlighted: '<span>code</span>',
      langClass: 'language-typescript',
      showCopyButton: false,
    })

    expect(html).toContain('<pre class="code-block-wrapper">')
    expect(html).toContain('<code class="hljs language-typescript"><span>code</span></code>')
    expect(html).not.toContain('code-copy-btn')
  })

  it('renders the copy button HTML for stable code blocks', () => {
    const html = renderMarkdownCodeBlock({
      encodedCode: 'abc',
      highlighted: '<span>code</span>',
      showCopyButton: true,
      copyTitle: 'Copy code',
    })

    expect(html).toContain('class="code-copy-btn"')
    expect(html).toContain('data-code="abc"')
    expect(html).toContain('title="Copy code"')
  })
})
