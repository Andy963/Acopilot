import katex from 'katex'

type LatexRenderMode = 'inline' | 'block'

type RenderedFormula = {
  placeholder: string
  rendered: string
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function renderFormula(formula: string, mode: LatexRenderMode): string {
  const displayMode = mode === 'block'
  const rendered = katex.renderToString(formula.trim(), {
    displayMode,
    throwOnError: false,
    output: 'html',
  })

  return displayMode ? `<div class="katex-block">${rendered}</div>` : rendered
}

function renderFallback(match: string, mode: LatexRenderMode): string {
  if (mode === 'block') {
    return `<div class="katex-error">${escapeHtml(match)}</div>`
  }
  return `<span class="katex-error">${escapeHtml(match)}</span>`
}

function replaceLatexPattern(
  text: string,
  pattern: RegExp,
  mode: LatexRenderMode,
  store?: RenderedFormula[],
): string {
  return text.replace(pattern, (match, formula) => {
    try {
      const rendered = renderFormula(formula, mode)
      if (!store) return rendered

      const placeholder = `___LATEX_${mode.toUpperCase()}_${store.length}___`
      store.push({ placeholder, rendered })
      return placeholder
    } catch (error) {
      const logLabel = mode === 'block' ? 'block' : 'inline'
      console.warn(`KaTeX ${logLabel} render error:`, error)

      if (!store) {
        return renderFallback(match, mode)
      }

      const placeholder = `___LATEX_${mode.toUpperCase()}_${store.length}___`
      store.push({ placeholder, rendered: renderFallback(match, mode) })
      return placeholder
    }
  })
}

function replaceBlockLatex(text: string, store?: RenderedFormula[]): string {
  let processed = text

  processed = replaceLatexPattern(processed, /\$\$([\s\S]*?)\$\$/g, 'block', store)
  processed = replaceLatexPattern(processed, /\\\[([\s\S]*?)\\\]/g, 'block', store)

  return processed
}

function replaceInlineLatex(text: string, store?: RenderedFormula[]): string {
  let processed = text

  processed = replaceLatexPattern(
    processed,
    /(?<!\$)\$(?!\$)((?:[^$\\]|\\.)+?)\$(?!\$)/g,
    'inline',
    store,
  )
  processed = replaceLatexPattern(processed, /\\\(([\s\S]*?)\\\)/g, 'inline', store)

  return processed
}

export function processLatex(text: string): string {
  return replaceInlineLatex(replaceBlockLatex(text))
}

export function renderLatexOnly(content: string): string {
  if (!content) return ''

  const formulas: RenderedFormula[] = []
  let processed = content

  processed = replaceBlockLatex(processed, formulas)
  processed = replaceInlineLatex(processed, formulas)
  processed = escapeHtml(processed)

  for (const { placeholder, rendered } of formulas) {
    processed = processed.replace(placeholder, rendered)
  }

  processed = processed.replace(/\n/g, '<br>')
  processed = processed.replace(/ {2,}/g, (match) => '&nbsp;'.repeat(match.length))
  processed = processed.replace(/(^|<br>)( +)/g, (_match, prefix, spaces) => {
    return prefix + '&nbsp;'.repeat(spaces.length)
  })

  return processed
}
