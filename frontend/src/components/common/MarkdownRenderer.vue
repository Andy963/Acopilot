<script setup lang="ts">
/**
 * MarkdownRenderer - Markdown 和 LaTeX 渲染组件
 *
 * 使用 markdown-it 作为渲染引擎，支持：
 * - 完整 GFM 语法
 * - 脚注
 * - 定义列表
 * - 任务列表
 * - 代码高亮
 * - LaTeX 数学公式
 */

import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import MarkdownIt from 'markdown-it'
import type { Options } from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'
import type Renderer from 'markdown-it/lib/renderer.mjs'
import type StateCore from 'markdown-it/lib/rules_core/state_core.mjs'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import go from 'highlight.js/lib/languages/go'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'
import katex from 'katex'
import { sendToExtension } from '@/utils/vscode'

// 插件导入
import footnote from 'markdown-it-footnote'
import deflist from 'markdown-it-deflist'
import taskLists from 'markdown-it-task-lists'

const props = withDefaults(defineProps<{
  content: string
  latexOnly?: boolean  // 仅渲染 LaTeX，不渲染 Markdown（用于用户消息）
  streaming?: boolean  // Streaming mode: defer code highlighting until completion.
}>(), {
  latexOnly: false,
  streaming: false
})

// 容器引用
const containerRef = ref<HTMLElement | null>(null)

// 复制按钮状态计时器存储
const copyTimers = new Map<HTMLButtonElement, number>()

// 图片加载状态
const imageCache = new Map<string, string>()

// Register a small set of languages to keep bundle size under control.
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
  jsonc: 'json'
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

/**
 * 创建并配置 markdown-it 实例
 */
function createMarkdownIt(enableCodeHighlight: boolean) {
  const md = new MarkdownIt({
    html: true,           // 允许 HTML 标签
    xhtmlOut: false,
    breaks: true,         // 换行转 <br>
    linkify: true,        // 自动检测链接
    typographer: true,    // 启用智能引号等排版功能
    highlight: function (str: string, lang: string) {
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

      // 对原始代码进行 base64 编码以便复制时解码
      const encodedCode = btoa(encodeURIComponent(str))
      
      // 返回以 <pre 开头的字符串，避免 markdown-it 额外包裹
      const codeClass = ['hljs', langClass].filter(Boolean).join(' ')
      return `<pre class="code-block-wrapper"><button class="code-copy-btn" data-code="${encodedCode}" title="复制代码"><span class="copy-icon codicon codicon-copy"></span><span class="check-icon codicon codicon-check"></span></button><code class="${codeClass}">${highlighted}</code></pre>`
    }
  })
  
  // 加载插件
  md.use(footnote)       // 脚注支持
  md.use(deflist)        // 定义列表支持
  md.use(taskLists, {    // 任务列表支持
    enabled: true,
    label: true,
    labelAfter: true
  })
  
  // 自定义链接渲染 - 外部链接在新标签页打开
  const defaultLinkRender = md.renderer.rules.link_open || function(
    tokens: Token[],
    idx: number,
    options: Options,
    _env: StateCore,
    self: Renderer
  ) {
    return self.renderToken(tokens, idx, options)
  }
  
  md.renderer.rules.link_open = function(
    tokens: Token[],
    idx: number,
    options: Options,
    env: StateCore,
    self: Renderer
  ) {
    const token = tokens[idx]
    const href = token.attrGet('href') || ''
    
    // 检查是否是外部链接
    if (/^(https?:\/\/|mailto:|tel:)/i.test(href)) {
      token.attrSet('target', '_blank')
      token.attrSet('rel', 'noopener noreferrer')
    }
    
    return defaultLinkRender(tokens, idx, options, env, self)
  }
  
  // 自定义图片渲染 - 支持相对路径
  md.renderer.rules.image = function(tokens: Token[], idx: number) {
    const token = tokens[idx]
    const src = token.attrGet('src') || ''
    const alt = token.content || ''
    const title = token.attrGet('title') || ''
    
    // 检查是否是绝对 URL
    const isAbsoluteUrl = /^(https?:\/\/|data:)/i.test(src)
    
    if (isAbsoluteUrl) {
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
      return `<img src="${src}" alt="${escapeHtml(alt)}"${titleAttr} loading="lazy">`
    } else {
      // 相对路径，使用占位符，稍后异步加载
      const encodedPath = btoa(encodeURIComponent(src))
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
      return `<img class="workspace-image" data-path="${encodedPath}" alt="${escapeHtml(alt)}"${titleAttr} src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" loading="lazy">`
    }
  }
  
  return md
}

const mdWithHighlight = createMarkdownIt(true)
const mdWithoutHighlight = createMarkdownIt(false)

/**
 * 处理 LaTeX 公式
 */
function processLatex(text: string): string {
  // 先处理块级公式 $$...$$
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_match, formula) => {
    try {
      return `<div class="katex-block">${katex.renderToString(formula.trim(), {
        displayMode: true,
        throwOnError: false,
        output: 'html'
      })}</div>`
    } catch (e) {
      console.warn('KaTeX block render error:', e)
      return `<div class="katex-error">$$${escapeHtml(formula)}$$</div>`
    }
  })
  
  // 再处理行内公式 $...$（排除已处理的块级公式）
  text = text.replace(/(?<!\$)\$(?!\$)((?:[^$\\]|\\.)+?)\$(?!\$)/g, (_match, formula) => {
    try {
      return katex.renderToString(formula.trim(), {
        displayMode: false,
        throwOnError: false,
        output: 'html'
      })
    } catch (e) {
      console.warn('KaTeX inline render error:', e)
      return `<span class="katex-error">$${escapeHtml(formula)}$</span>`
    }
  })
  
  return text
}

/**
 * 仅渲染 LaTeX（保留原始文本格式）
 * 用于用户消息：保持原始文本，只渲染 LaTeX 公式，保留换行和空格
 */
function renderLatexOnly(content: string): string {
  if (!content) return ''
  
  // 存储 LaTeX 公式及其位置
  const formulas: { placeholder: string; rendered: string }[] = []
  let processed = content
  
  // 提取并渲染块级公式 $$...$$
  processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
    const placeholder = `___LATEX_BLOCK_${formulas.length}___`
    try {
      formulas.push({
        placeholder,
        rendered: `<div class="katex-block">${katex.renderToString(formula.trim(), {
          displayMode: true,
          throwOnError: false,
          output: 'html'
        })}</div>`
      })
    } catch (e) {
      console.warn('KaTeX block render error:', e)
      formulas.push({
        placeholder,
        rendered: `<div class="katex-error">${escapeHtml(match)}</div>`
      })
    }
    return placeholder
  })
  
  // 提取并渲染行内公式 $...$
  processed = processed.replace(/(?<!\$)\$(?!\$)((?:[^$\\]|\\.)+?)\$(?!\$)/g, (match, formula) => {
    const placeholder = `___LATEX_INLINE_${formulas.length}___`
    try {
      formulas.push({
        placeholder,
        rendered: katex.renderToString(formula.trim(), {
          displayMode: false,
          throwOnError: false,
          output: 'html'
        })
      })
    } catch (e) {
      console.warn('KaTeX inline render error:', e)
      formulas.push({
        placeholder,
        rendered: `<span class="katex-error">${escapeHtml(match)}</span>`
      })
    }
    return placeholder
  })
  
  // 转义 HTML 特殊字符（保持原始文本）
  processed = escapeHtml(processed)
  
  // 还原 LaTeX 公式
  for (const { placeholder, rendered } of formulas) {
    processed = processed.replace(placeholder, rendered)
  }
  
  // 保留换行
  processed = processed.replace(/\n/g, '<br>')
  
  // 保留多个连续空格
  processed = processed.replace(/ {2,}/g, (match) => '&nbsp;'.repeat(match.length))
  
  // 保留行首空格
  processed = processed.replace(/(^|<br>)( +)/g, (_match, prefix, spaces) => {
    return prefix + '&nbsp;'.repeat(spaces.length)
  })
  
  return processed
}

/**
 * 转义 HTML 特殊字符
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * 渲染 Markdown 和 LaTeX
 */
function renderContent(content: string, latexOnly: boolean, enableCodeHighlight: boolean): string {
  if (!content) return ''
  
  // 仅 LaTeX 模式（用户消息）
  if (latexOnly) {
    return renderLatexOnly(content)
  }
  
  // 完整 Markdown + LaTeX 模式
  // 1. 先提取代码块，避免代码块内的内容被 LaTeX 处理
  const codeBlocks: string[] = []
  let processed = content.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match)
    return `___CODE_BLOCK_${codeBlocks.length - 1}___`
  })
  
  // 2. 提取行内代码
  const inlineCodes: string[] = []
  processed = processed.replace(/`[^`\n]+`/g, (match) => {
    inlineCodes.push(match)
    return `___INLINE_CODE_${inlineCodes.length - 1}___`
  })
  
  // 3. 处理 LaTeX
  processed = processLatex(processed)
  
  // 4. 还原行内代码
  processed = processed.replace(/___INLINE_CODE_(\d+)___/g, (_, index) => {
    return inlineCodes[parseInt(index)]
  })
  
  // 5. 还原代码块
  processed = processed.replace(/___CODE_BLOCK_(\d+)___/g, (_, index) => {
    return codeBlocks[parseInt(index)]
  })
  
  // 6. 使用 markdown-it 渲染
  const md = enableCodeHighlight ? mdWithHighlight : mdWithoutHighlight
  let html = md.render(processed)
  
  // 7. 保留多个连续空格（在段落内容中）
  html = html.replace(/(<(?:p|li|td|th|dd|dt)[^>]*>)([\s\S]*?)(<\/(?:p|li|td|th|dd|dt)>)/g,
    (_match: string, openTag: string, content: string, closeTag: string) => {
      let processedContent = content.replace(/(<br\s*\/?>)( +)/g, (_m: string, br: string, spaces: string) => {
        return br + '&nbsp;'.repeat(spaces.length)
      })
      processedContent = processedContent.replace(/^( +)/, (spaces: string) => {
        return '&nbsp;'.repeat(spaces.length)
      })
      processedContent = processedContent.replace(/ {2,}/g, (spaces: string) => {
        return '&nbsp;'.repeat(spaces.length)
      })
      return openTag + processedContent + closeTag
    }
  )
  
  return html
}

// 渲染结果
const renderedContent = computed(() => {
  const enableCodeHighlight = props.streaming !== true
  return renderContent(props.content, props.latexOnly, enableCodeHighlight)
})

/**
 * 处理复制按钮点击
 */
function handleCopyClick(event: Event) {
  const target = event.target as HTMLElement
  const button = target.closest('.code-copy-btn') as HTMLButtonElement
  
  if (!button) return
  
  const encodedCode = button.getAttribute('data-code')
  if (!encodedCode) return
  
  const code = decodeURIComponent(atob(encodedCode))
  
  navigator.clipboard.writeText(code).then(() => {
    const existingTimer = copyTimers.get(button)
    if (existingTimer) {
      window.clearTimeout(existingTimer)
    }
    
    button.classList.add('copied')
    
    const timer = window.setTimeout(() => {
      button.classList.remove('copied')
      copyTimers.delete(button)
    }, 1000)
    
    copyTimers.set(button, timer)
  }).catch(err => {
    console.error('复制失败:', err)
  })
}

/**
 * 加载工作区图片
 */
async function loadWorkspaceImages() {
  if (!containerRef.value) return
  
  const images = containerRef.value.querySelectorAll('img.workspace-image[data-path]')
  
  for (const img of images) {
    const encodedPath = img.getAttribute('data-path')
    if (!encodedPath) continue
    
    try {
      const imgPath = decodeURIComponent(atob(encodedPath))
      
      if (imageCache.has(imgPath)) {
        img.setAttribute('src', imageCache.get(imgPath)!)
        img.classList.remove('workspace-image')
        img.classList.add('loaded-image')
        img.setAttribute('data-image-path', imgPath)
        continue
      }
      
      const response = await sendToExtension<{
        success: boolean;
        data?: string;
        mimeType?: string;
        error?: string;
      }>('readWorkspaceImage', { path: imgPath })
      
      if (response?.success && response.data) {
        const dataUrl = `data:${response.mimeType || 'image/png'};base64,${response.data}`
        imageCache.set(imgPath, dataUrl)
        img.setAttribute('src', dataUrl)
        img.classList.remove('workspace-image')
        img.classList.add('loaded-image')
        img.setAttribute('data-image-path', imgPath)
      } else {
        img.classList.add('image-error')
        img.setAttribute('title', response?.error || '无法加载图片')
      }
    } catch (error) {
      console.error('加载图片失败:', error)
      img.classList.add('image-error')
    }
  }
}

/**
 * 处理图片点击
 */
async function handleImageClick(event: Event) {
  const target = event.target as HTMLElement
  
  if (target.tagName === 'IMG' && target.classList.contains('loaded-image')) {
    const imgPath = target.getAttribute('data-image-path')
    if (imgPath) {
      await sendToExtension('openWorkspaceFile', { path: imgPath })
    }
  }
}

onMounted(() => {
  if (containerRef.value) {
    containerRef.value.addEventListener('click', handleCopyClick)
    containerRef.value.addEventListener('click', handleImageClick)
  }
  nextTick(() => loadWorkspaceImages())
})

watch(() => props.content, () => {
  nextTick(() => loadWorkspaceImages())
})

onUnmounted(() => {
  if (containerRef.value) {
    containerRef.value.removeEventListener('click', handleCopyClick)
    containerRef.value.removeEventListener('click', handleImageClick)
  }
  copyTimers.forEach((timer) => {
    window.clearTimeout(timer)
  })
  copyTimers.clear()
})
</script>

<template>
  <div ref="containerRef" class="markdown-content" v-html="renderedContent"></div>
</template>

<style scoped src="./MarkdownRenderer.css"></style>
