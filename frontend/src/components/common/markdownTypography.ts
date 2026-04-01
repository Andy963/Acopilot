import MarkdownIt from 'markdown-it'
import type { Options } from 'markdown-it'

export const MARKDOWN_BASE_OPTIONS: Pick<
  Options,
  'html' | 'xhtmlOut' | 'breaks' | 'linkify' | 'typographer' | 'quotes'
> = {
  html: true,
  xhtmlOut: false,
  breaks: true,
  linkify: true,
  typographer: true,
  // Keep straight quotes for pseudo-math snippets like "x ∈ R".
  quotes: `""''`,
}

export function createTypographyMarkdownIt(): MarkdownIt {
  return new MarkdownIt(MARKDOWN_BASE_OPTIONS)
}
