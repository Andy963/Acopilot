export interface MarkdownCodeBlockRenderBehavior {
  enableCodeHighlight: boolean
  showCopyButton: boolean
}

export interface RenderMarkdownCodeBlockInput {
  encodedCode: string
  highlighted: string
  langClass?: string
  showCopyButton: boolean
  copyTitle?: string
}

export function getMarkdownCodeBlockRenderBehavior(streaming: boolean): MarkdownCodeBlockRenderBehavior {
  return {
    enableCodeHighlight: !streaming,
    showCopyButton: !streaming,
  }
}

export function renderMarkdownCodeBlock({
  encodedCode,
  highlighted,
  langClass = '',
  showCopyButton,
  copyTitle = 'Copy code',
}: RenderMarkdownCodeBlockInput): string {
  const codeClass = ['hljs', langClass].filter(Boolean).join(' ')
  const copyButton = showCopyButton
    ? `<button class="code-copy-btn" data-code="${encodedCode}" title="${copyTitle}"><span class="copy-icon codicon codicon-copy"></span><span class="check-icon codicon codicon-check"></span></button>`
    : ''

  return `<pre class="code-block-wrapper">${copyButton}<code class="${codeClass}">${highlighted}</code></pre>`
}
