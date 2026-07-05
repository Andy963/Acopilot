import { describe, expect, it } from 'vitest'

import { renderMarkdownContent } from '../frontend/src/components/common/markdownRendererContent'
import { parseWorkspaceFileReference } from '../frontend/src/components/common/markdownRendererWorkspace'

describe('markdown renderer content helpers', () => {
  it('parses workspace file references while rejecting likely hostnames', () => {
    expect(parseWorkspaceFileReference('frontend/src/App.vue:12:3')).toEqual({
      path: 'frontend/src/App.vue',
      line: 12,
      column: 3,
      display: 'frontend/src/App.vue:12:3',
    })
    expect(parseWorkspaceFileReference('example.com:443')).toBeNull()
  })

  it('renders workspace file references as clickable links', () => {
    const html = renderMarkdownContent('See `frontend/src/App.vue:12:3` for details.', false, false)

    expect(html).toContain('class="workspace-file-link workspace-file-link--code"')
    expect(html).toContain('data-path="frontend/src/App.vue"')
    expect(html).toContain('data-line="12"')
    expect(html).toContain('data-column="3"')
  })

  it('renders relative images as workspace image placeholders', () => {
    const html = renderMarkdownContent('![Diagram](assets/diagram.png)', false, false)

    expect(html).toContain('class="workspace-image"')
    expect(html).toContain('data-path=')
    expect(html).toContain('loading="lazy"')
  })
})
