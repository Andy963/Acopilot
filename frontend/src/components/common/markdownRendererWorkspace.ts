import MarkdownIt from 'markdown-it'
import type { Options } from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'
import type Renderer from 'markdown-it/lib/renderer.mjs'
import type StateCore from 'markdown-it/lib/rules_core/state_core.mjs'

export type WorkspaceFileReference = {
  path: string
  line: number
  column: number
  display: string
}

const WORKSPACE_FILE_REFERENCE_REGEX = /\b((?:\.\/)?(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+(?::\d+(?::\d+)?|#L\d+(?:C\d+)?))\b/g
type TokenConstructor = new (type: string, tag: string, nesting: number) => Token

const ALLOWED_SINGLE_SEGMENT_EXTENSIONS = new Set([
  'ts',
  'tsx',
  'js',
  'jsx',
  'vue',
  'css',
  'scss',
  'less',
  'json',
  'md',
  'txt',
  'yml',
  'yaml',
  'toml',
  'rs',
  'go',
  'py',
  'sh',
])

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/`/g, '&#096;')
}

export function parseWorkspaceFileReference(text: string): WorkspaceFileReference | null {
  const raw = String(text || '').trim()
  if (!raw) return null
  if (raw.includes('\\')) return null
  if (raw.startsWith('/') || raw.startsWith('~')) return null
  if (raw.startsWith('file://')) return null
  if (/(^|\/)\.\.(\/|$)/.test(raw)) return null

  const match = /^(?:\.\/)?((?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+)(?::(\d+)(?::(\d+))?|#L(\d+)(?:C(\d+))?)$/.exec(raw)
  if (!match) return null

  const path = match[1] || ''
  const line = Number(match[2] ?? match[4] ?? '')
  const column = Number(match[3] ?? match[5] ?? '1')

  if (!path) return null
  if (!Number.isFinite(line) || line <= 0) return null
  if (!Number.isFinite(column) || column <= 0) return null

  if (!path.includes('/')) {
    const ext = path.split('.').pop()?.toLowerCase() || ''
    if (!ALLOWED_SINGLE_SEGMENT_EXTENSIONS.has(ext)) return null
  }

  return {
    path,
    line,
    column,
    display: raw,
  }
}

function applyWorkspaceFileLinkify(md: MarkdownIt): void {
  md.core.ruler.after('linkify', 'acopilot_workspace_file_links', (state: StateCore) => {
    const TokenCtor = (state as StateCore & { Token?: TokenConstructor }).Token
    if (!TokenCtor) return

    for (const blockToken of state.tokens) {
      if (blockToken.type !== 'inline' || !Array.isArray(blockToken.children)) continue

      const out: Token[] = []
      let inLink = 0

      for (const child of blockToken.children) {
        if (child.type === 'link_open') {
          inLink += 1
          out.push(child)
          continue
        }
        if (child.type === 'link_close') {
          inLink = Math.max(0, inLink - 1)
          out.push(child)
          continue
        }

        if (inLink > 0 || child.type !== 'text' || typeof child.content !== 'string') {
          out.push(child)
          continue
        }

        const text = child.content
        let lastIndex = 0
        let changed = false

        WORKSPACE_FILE_REFERENCE_REGEX.lastIndex = 0
        let match: RegExpExecArray | null
        while ((match = WORKSPACE_FILE_REFERENCE_REGEX.exec(text)) !== null) {
          const candidate = match[1] || ''
          const parsed = parseWorkspaceFileReference(candidate)
          if (!parsed) continue

          const start = match.index
          const end = start + candidate.length

          if (start > lastIndex) {
            const textToken = new TokenCtor('text', '', 0)
            textToken.content = text.slice(lastIndex, start)
            out.push(textToken)
          }

          const open = new TokenCtor('link_open', 'a', 1)
          open.attrSet('href', '#')
          open.attrSet('class', 'workspace-file-link')
          open.attrSet('data-path', parsed.path)
          open.attrSet('data-line', String(parsed.line))
          open.attrSet('data-column', String(parsed.column))
          open.attrSet('title', `${parsed.path}:${parsed.line}:${parsed.column}`)
          out.push(open)

          const label = new TokenCtor('text', '', 0)
          label.content = parsed.display
          out.push(label)

          out.push(new TokenCtor('link_close', 'a', -1))
          lastIndex = end
          changed = true
        }

        if (!changed) {
          out.push(child)
          continue
        }

        if (lastIndex < text.length) {
          const trailingText = new TokenCtor('text', '', 0)
          trailingText.content = text.slice(lastIndex)
          out.push(trailingText)
        }
      }

      blockToken.children = out
    }
  })
}

function installExternalLinkRule(md: MarkdownIt): void {
  const defaultLinkRender = md.renderer.rules.link_open || function(
    tokens: Token[],
    idx: number,
    options: Options,
    _env: StateCore,
    self: Renderer,
  ) {
    return self.renderToken(tokens, idx, options)
  }

  md.renderer.rules.link_open = function(
    tokens: Token[],
    idx: number,
    options: Options,
    env: StateCore,
    self: Renderer,
  ) {
    const token = tokens[idx]
    const href = token.attrGet('href') || ''

    if (/^(https?:\/\/|mailto:|tel:)/i.test(href)) {
      token.attrSet('target', '_blank')
      token.attrSet('rel', 'noopener noreferrer')
    }

    return defaultLinkRender(tokens, idx, options, env, self)
  }
}

function installInlineWorkspaceFileRule(md: MarkdownIt): void {
  const defaultCodeInlineRender = md.renderer.rules.code_inline || function(
    tokens: Token[],
    idx: number,
    options: Options,
    _env: StateCore,
    self: Renderer,
  ) {
    return self.renderToken(tokens, idx, options)
  }

  md.renderer.rules.code_inline = function(
    tokens: Token[],
    idx: number,
    options: Options,
    env: StateCore,
    self: Renderer,
  ) {
    const content = tokens[idx]?.content || ''
    const parsed = parseWorkspaceFileReference(content)
    if (!parsed) {
      return defaultCodeInlineRender(tokens, idx, options, env, self)
    }

    const safePath = escapeAttr(parsed.path)
    const safeLine = String(parsed.line)
    const safeColumn = String(parsed.column)
    const safeLabel = escapeHtml(parsed.display)

    return `<a href="#" class="workspace-file-link workspace-file-link--code" data-path="${safePath}" data-line="${safeLine}" data-column="${safeColumn}" title="${safePath}:${safeLine}:${safeColumn}"><code>${safeLabel}</code></a>`
  }
}

function isAbsoluteImageUrl(src: string): boolean {
  return /^(https?:\/\/|data:)/i.test(src)
}

function encodeWorkspacePath(path: string): string {
  return btoa(encodeURIComponent(path))
}

function installWorkspaceImageRule(md: MarkdownIt): void {
  md.renderer.rules.image = function(tokens: Token[], idx: number) {
    const token = tokens[idx]
    const src = token.attrGet('src') || ''
    const alt = token.content || ''
    const title = token.attrGet('title') || ''
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''

    if (isAbsoluteImageUrl(src)) {
      return `<img src="${src}" alt="${escapeHtml(alt)}"${titleAttr} loading="lazy">`
    }

    const encodedPath = encodeWorkspacePath(src)
    return `<img class="workspace-image" data-path="${encodedPath}" alt="${escapeHtml(alt)}"${titleAttr} src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" loading="lazy">`
  }
}

export function installWorkspaceMarkdownRules(md: MarkdownIt): void {
  applyWorkspaceFileLinkify(md)
  installExternalLinkRule(md)
  installInlineWorkspaceFileRule(md)
  installWorkspaceImageRule(md)
}
