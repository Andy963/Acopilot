import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import go from 'highlight.js/lib/languages/go'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'
import footnote from 'markdown-it-footnote'
import deflist from 'markdown-it-deflist'
import taskLists from 'markdown-it-task-lists'
import { getMarkdownCodeBlockRenderBehavior, renderMarkdownCodeBlock } from './markdownCodeBlock'
import { processLatex, renderLatexOnly } from './latex'
import { MARKDOWN_BASE_OPTIONS } from './markdownTypography'
import { escapeHtml, installWorkspaceMarkdownRules } from './markdownRendererWorkspace'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('go', go)
hljs.registerLanguage('json', json)
hljs.registerLanguage('bash', bash)

const AUTO_LANGUAGE_SUBSET = ['python', 'go', 'javascript', 'typescript', 'json', 'bash'] as const
const LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  tss: 'typescript',
  py: 'python',
  golang: 'go',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  jsonc: 'json',
}

const MAX_EXPLICIT_HIGHLIGHT_CHARS = 100_000
const MAX_AUTO_HIGHLIGHT_CHARS = 20_000

function normalizeFenceLanguage(info: string): string | null {
  const token = info.trim().split(/\s+/)[0] || ''
  const normalized = (LANGUAGE_ALIASES[token.toLowerCase()] ?? token)
    .toLowerCase()
    .replace(/^language-/, '')
    .replace(/^lang-/, '')

  if (!normalized) return null
  return hljs.getLanguage(normalized) ? normalized : null
}

function createMarkdownIt(enableCodeHighlight: boolean, showCopyButton: boolean): MarkdownIt {
  const md = new MarkdownIt({
    ...MARKDOWN_BASE_OPTIONS,
    highlight: (str: string, lang: string) => {
      let highlighted: string
      const normalizedLang = lang ? normalizeFenceLanguage(lang) : null
      const langClass = normalizedLang ? `language-${normalizedLang}` : ''

      if (!enableCodeHighlight) {
        highlighted = escapeHtml(str)
      } else if (normalizedLang && str.length <= MAX_EXPLICIT_HIGHLIGHT_CHARS) {
        highlighted = hljs.highlight(str, { language: normalizedLang, ignoreIllegals: true }).value
      } else if (!normalizedLang && str.length <= MAX_AUTO_HIGHLIGHT_CHARS) {
        highlighted = hljs.highlightAuto(str, [...AUTO_LANGUAGE_SUBSET]).value
      } else {
        highlighted = escapeHtml(str)
      }

      const encodedCode = btoa(encodeURIComponent(str))

      return renderMarkdownCodeBlock({
        encodedCode,
        highlighted,
        langClass,
        showCopyButton,
      })
    },
  })

  md.use(footnote)
  md.use(deflist)
  md.use(taskLists, {
    enabled: true,
    label: true,
    labelAfter: true,
  })

  installWorkspaceMarkdownRules(md)

  return md
}

const mdWithHighlight = createMarkdownIt(true, true)
const mdWithoutHighlight = createMarkdownIt(false, false)

function preserveInlineSpacing(html: string): string {
  return html.replace(
    /(<(?:p|li|td|th|dd|dt)[^>]*>)([\s\S]*?)(<\/(?:p|li|td|th|dd|dt)>)/g,
    (_match: string, openTag: string, content: string, closeTag: string) => {
      let processedContent = content.replace(/(<br\s*\/?>)( +)/g, (_lineMatch: string, br: string, spaces: string) => {
        return br + '&nbsp;'.repeat(spaces.length)
      })
      processedContent = processedContent.replace(/^( +)/, (spaces: string) => {
        return '&nbsp;'.repeat(spaces.length)
      })
      processedContent = processedContent.replace(/ {2,}/g, (spaces: string) => {
        return '&nbsp;'.repeat(spaces.length)
      })
      return openTag + processedContent + closeTag
    },
  )
}

export function renderMarkdownContent(
  content: string,
  latexOnly: boolean,
  streaming: boolean,
): string {
  if (!content) return ''

  if (latexOnly) {
    return renderLatexOnly(content)
  }

  const codeBlocks: string[] = []
  let processed = content.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match)
    return `___CODE_BLOCK_${codeBlocks.length - 1}___`
  })

  const inlineCodes: string[] = []
  processed = processed.replace(/`[^`\n]+`/g, (match) => {
    inlineCodes.push(match)
    return `___INLINE_CODE_${inlineCodes.length - 1}___`
  })

  processed = processLatex(processed)

  processed = processed.replace(/___INLINE_CODE_(\d+)___/g, (_match, index) => {
    return inlineCodes[Number.parseInt(index, 10)]
  })
  processed = processed.replace(/___CODE_BLOCK_(\d+)___/g, (_match, index) => {
    return codeBlocks[Number.parseInt(index, 10)]
  })

  const behavior = getMarkdownCodeBlockRenderBehavior(streaming)
  const md = behavior.enableCodeHighlight ? mdWithHighlight : mdWithoutHighlight

  return preserveInlineSpacing(md.render(processed))
}
