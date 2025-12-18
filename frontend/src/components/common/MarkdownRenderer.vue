<script setup lang="ts">
/**
 * MarkdownRenderer - Markdown 和 LaTeX 渲染组件
 *
 * 支持：
 * - Markdown 语法渲染
 * - LaTeX 数学公式（行内 $...$ 和块级 $$...$$）
 * - 代码高亮
 */

import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { marked } from 'marked'
import hljs from 'highlight.js'
import katex from 'katex'
import { sendToExtension } from '@/utils/vscode'

const props = withDefaults(defineProps<{
  content: string
  latexOnly?: boolean  // 仅渲染 LaTeX，不渲染 Markdown（用于用户消息）
}>(), {
  latexOnly: false
})

// 容器引用
const containerRef = ref<HTMLElement | null>(null)

// 复制按钮状态计时器存储
const copyTimers = new Map<HTMLButtonElement, number>()

// 图片加载状态
const imageCache = new Map<string, string>()


/**
 * 处理 LaTeX 公式
 * 
 * 支持：
 * - 行内公式：$...$
 * - 块级公式：$$...$$
 */
function processLatex(text: string): string {
  // 先处理块级公式 $$...$$
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
    try {
      return `<div class="katex-block">${katex.renderToString(formula.trim(), {
        displayMode: true,
        throwOnError: false,
        output: 'html'  // 只输出 HTML，不输出 MathML
      })}</div>`
    } catch (e) {
      console.warn('KaTeX block render error:', e)
      return `<div class="katex-error">${match}</div>`
    }
  })
  
  // 再处理行内公式 $...$（排除已处理的块级公式）
  text = text.replace(/(?<!\$)\$(?!\$)((?:[^$\\]|\\.)+?)\$(?!\$)/g, (match, formula) => {
    try {
      return katex.renderToString(formula.trim(), {
        displayMode: false,
        throwOnError: false,
        output: 'html'  // 只输出 HTML，不输出 MathML
      })
    } catch (e) {
      console.warn('KaTeX inline render error:', e)
      return `<span class="katex-error">${match}</span>`
    }
  })
  
  return text
}

/**
 * 配置 marked
 */
function setupMarked() {
  // 自定义 renderer
  const renderer = new marked.Renderer()
  
  // 代码块高亮
  renderer.code = function(code: string | { text: string, lang?: string }, language?: string) {
    // 处理新版 marked 的参数格式
    let codeText: string
    let lang: string | undefined
    
    if (typeof code === 'object' && code !== null) {
      codeText = code.text
      lang = code.lang
    } else {
      codeText = code as string
      lang = language
    }
    
    let highlighted: string
    let langClass = ''
    
    if (lang && hljs.getLanguage(lang)) {
      try {
        highlighted = hljs.highlight(codeText, { language: lang }).value
        langClass = `language-${lang}`
      } catch (e) {
        // 高亮失败，使用自动检测
        highlighted = hljs.highlightAuto(codeText).value
      }
    } else {
      // 无语言或高亮失败，使用自动检测
      highlighted = hljs.highlightAuto(codeText).value
    }
    
    // 对原始代码进行 base64 编码以便复制时解码
    const encodedCode = btoa(encodeURIComponent(codeText))
    
    return `<div class="code-block-wrapper">
      <button class="code-copy-btn" data-code="${encodedCode}" title="复制代码">
        <span class="copy-icon codicon codicon-copy"></span>
        <span class="check-icon codicon codicon-check"></span>
      </button>
      <pre class="hljs"><code class="${langClass}">${highlighted}</code></pre>
    </div>`
  }
  
  // 行内代码
  renderer.codespan = function(text: string | { text: string }) {
    const codeText = typeof text === 'object' ? text.text : text
    return `<code class="inline-code">${codeText}</code>`
  }
  
  // 图片渲染 - 支持相对路径
  renderer.image = function(token: { href: string; title: string | null; text: string }) {
    const imgHref = token.href
    const imgTitle = token.title
    const imgAlt = token.text || ''
    
    // 检查是否是绝对 URL（http/https/data）
    const isAbsoluteUrl = /^(https?:\/\/|data:)/i.test(imgHref)
    
    if (isAbsoluteUrl) {
      // 绝对 URL 直接渲染
      const titleAttr = imgTitle ? ` title="${escapeHtml(imgTitle)}"` : ''
      return `<img src="${imgHref}" alt="${escapeHtml(imgAlt)}"${titleAttr} loading="lazy">`
    } else {
      // 相对路径，使用占位符，稍后异步加载
      // 使用 base64 编码路径避免特殊字符问题
      const encodedPath = btoa(encodeURIComponent(imgHref))
      const titleAttr = imgTitle ? ` title="${escapeHtml(imgTitle)}"` : ''
      return `<img class="workspace-image" data-path="${encodedPath}" alt="${escapeHtml(imgAlt)}"${titleAttr} src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" loading="lazy">`
    }
  }
  
  marked.setOptions({
    renderer,
    gfm: true,
    breaks: true
  })
}

/**
 * 仅渲染 LaTeX（保留原始文本格式）
 *
 * 策略：先提取 LaTeX 公式，转义普通文本，再渲染 LaTeX
 */
function renderLatexOnly(content: string): string {
  if (!content) return ''
  
  // 存储 LaTeX 公式及其位置
  const formulas: { placeholder: string; rendered: string }[] = []
  let processed = content
  
  // 1. 提取并渲染块级公式 $$...$$
  processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
    const placeholder = `___LATEX_BLOCK_${formulas.length}___`
    try {
      formulas.push({
        placeholder,
        rendered: `<div class="katex-block">${katex.renderToString(formula.trim(), {
          displayMode: true,
          throwOnError: false,
          output: 'html'  // 只输出 HTML，不输出 MathML
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
  
  // 2. 提取并渲染行内公式 $...$
  processed = processed.replace(/(?<!\$)\$(?!\$)((?:[^$\\]|\\.)+?)\$(?!\$)/g, (match, formula) => {
    const placeholder = `___LATEX_INLINE_${formulas.length}___`
    try {
      formulas.push({
        placeholder,
        rendered: katex.renderToString(formula.trim(), {
          displayMode: false,
          throwOnError: false,
          output: 'html'  // 只输出 HTML，不输出 MathML
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
  
  // 3. 转义普通文本中的 HTML 特殊字符
  processed = escapeHtml(processed)
  
  // 4. 还原 LaTeX 公式
  for (const { placeholder, rendered } of formulas) {
    processed = processed.replace(placeholder, rendered)
  }
  
  // 5. 保留换行
  processed = processed.replace(/\n/g, '<br>')
  
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
function renderContent(content: string, latexOnly: boolean): string {
  if (!content) return ''
  
  // 仅 LaTeX 模式
  if (latexOnly) {
    return renderLatexOnly(content)
  }
  
  // 完整 Markdown + LaTeX 模式
  // 1. 先提取代码块，避免代码块内的内容被处理
  const codeBlocks: string[] = []
  let processed = content.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match)
    return `___CODE_BLOCK_${codeBlocks.length - 1}___`
  })
  
  // 2. 处理 LaTeX
  processed = processLatex(processed)
  
  // 3. 还原代码块
  processed = processed.replace(/___CODE_BLOCK_(\d+)___/g, (_, index) => {
    return codeBlocks[parseInt(index)]
  })
  
  // 4. 渲染 Markdown
  const html = marked.parse(processed) as string
  
  return html
}

// 立即初始化 marked
setupMarked()

// 渲染结果
const renderedContent = computed(() => {
  return renderContent(props.content, props.latexOnly)
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
  
  // 解码代码
  const code = decodeURIComponent(atob(encodedCode))
  
  // 复制到剪贴板
  navigator.clipboard.writeText(code).then(() => {
    // 清除之前的计时器（如果存在）
    const existingTimer = copyTimers.get(button)
    if (existingTimer) {
      window.clearTimeout(existingTimer)
    }
    
    // 添加已复制状态
    button.classList.add('copied')
    
    // 1秒后移除状态
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
 * 将相对路径的图片转换为 data URL
 */
async function loadWorkspaceImages() {
  if (!containerRef.value) return
  
  const images = containerRef.value.querySelectorAll('img.workspace-image[data-path]')
  
  for (const img of images) {
    const encodedPath = img.getAttribute('data-path')
    if (!encodedPath) continue
    
    try {
      const imgPath = decodeURIComponent(atob(encodedPath))
      
      // 检查缓存
      if (imageCache.has(imgPath)) {
        img.setAttribute('src', imageCache.get(imgPath)!)
        img.classList.remove('workspace-image')
        img.classList.add('loaded-image')
        // 存储路径用于点击预览
        img.setAttribute('data-image-path', imgPath)
        continue
      }
      
      // 通过后端读取图片文件
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
        // 存储路径用于点击预览
        img.setAttribute('data-image-path', imgPath)
      } else {
        // 加载失败，显示错误状态
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
 * 处理图片点击，在 VSCode 中预览
 */
async function handleImageClick(event: Event) {
  const target = event.target as HTMLElement
  
  // 检查是否点击了已加载的图片
  if (target.tagName === 'IMG' && target.classList.contains('loaded-image')) {
    const imgPath = target.getAttribute('data-image-path')
    if (imgPath) {
      // 通过后端打开图片预览
      await sendToExtension('openWorkspaceFile', { path: imgPath })
    }
  }
}

// 组件挂载时添加事件监听
onMounted(() => {
  if (containerRef.value) {
    containerRef.value.addEventListener('click', handleCopyClick)
    containerRef.value.addEventListener('click', handleImageClick)
  }
  // 加载工作区图片
  nextTick(() => loadWorkspaceImages())
})

// 监听内容变化，重新加载图片
watch(() => props.content, () => {
  nextTick(() => loadWorkspaceImages())
})

// 组件卸载时清理
onUnmounted(() => {
  if (containerRef.value) {
    containerRef.value.removeEventListener('click', handleCopyClick)
    containerRef.value.removeEventListener('click', handleImageClick)
  }
  // 清除所有计时器
  copyTimers.forEach((timer) => {
    window.clearTimeout(timer)
  })
  copyTimers.clear()
})
</script>

<template>
  <div ref="containerRef" class="markdown-content" v-html="renderedContent"></div>
</template>

<style scoped>
/* KaTeX 必要样式 */
.markdown-content :deep(.katex) {
  font-family: 'Times New Roman', Times, serif;
  font-size: 1.1em;
  text-rendering: auto;
  white-space: nowrap;
}

.markdown-content :deep(.katex-html) {
  display: inline-block;
}

.markdown-content :deep(.katex .base) {
  display: inline-block;
}

.markdown-content :deep(.katex .strut) {
  display: inline-block;
}

.markdown-content :deep(.katex .mord) {
  display: inline;
}

.markdown-content :deep(.katex .mrel),
.markdown-content :deep(.katex .mbin),
.markdown-content :deep(.katex .mop) {
  display: inline;
}

.markdown-content :deep(.katex .mspace) {
  display: inline-block;
}

.markdown-content :deep(.katex .msupsub) {
  display: inline-block;
  text-align: left;
}

.markdown-content :deep(.katex .vlist-t) {
  display: inline-table;
  table-layout: fixed;
}

.markdown-content :deep(.katex .vlist-r) {
  display: table-row;
}

.markdown-content :deep(.katex .vlist) {
  display: table-cell;
  vertical-align: bottom;
  position: relative;
}

.markdown-content :deep(.katex .mfrac) {
  display: inline-block;
  vertical-align: middle;
  text-align: center;
}

.markdown-content :deep(.katex .frac-line) {
  display: block;
  border-bottom: 1px solid;
  margin: 0.04em 0;
}

.markdown-content :deep(.katex .sqrt) {
  display: inline-block;
}

.markdown-content :deep(.katex-display) {
  display: block;
  margin: 0;
  text-align: center;
}

.markdown-content {
  font-size: 13px;
  line-height: 1.6;
  color: var(--vscode-foreground);
  word-break: break-word;
}

/* 段落 */
.markdown-content :deep(p) {
  margin: 0 0 0.8em 0;
}

.markdown-content :deep(p:last-child) {
  margin-bottom: 0;
}

/* 标题 */
.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4),
.markdown-content :deep(h5),
.markdown-content :deep(h6) {
  margin: 1em 0 0.5em 0;
  font-weight: 600;
  line-height: 1.3;
}

.markdown-content :deep(h1) { font-size: 1.5em; }
.markdown-content :deep(h2) { font-size: 1.3em; }
.markdown-content :deep(h3) { font-size: 1.15em; }
.markdown-content :deep(h4) { font-size: 1em; }

/* 列表 */
.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  margin: 0.5em 0;
  padding-left: 1.5em;
}

.markdown-content :deep(li) {
  margin: 0.25em 0;
}

/* 引用 */
.markdown-content :deep(blockquote) {
  margin: 0.5em 0;
  padding: 0.5em 1em;
  border-left: 3px solid var(--vscode-textBlockQuote-border);
  background: var(--vscode-textBlockQuote-background);
  color: var(--vscode-foreground);
  opacity: 0.9;
}

/* 代码块容器 */
.markdown-content :deep(.code-block-wrapper) {
  position: relative;
  margin: 0.8em 0;
}

/* 复制按钮 */
.markdown-content :deep(.code-copy-btn) {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 10;
  padding: 0;
}

.markdown-content :deep(.code-block-wrapper:hover .code-copy-btn) {
  opacity: 0.6;
}

.markdown-content :deep(.code-copy-btn:hover) {
  opacity: 1 !important;
}

.markdown-content :deep(.code-copy-btn .copy-icon) {
  font-size: 14px;
  color: var(--vscode-foreground);
  display: block;
}

.markdown-content :deep(.code-copy-btn .check-icon) {
  font-size: 14px;
  color: var(--vscode-foreground);
  display: none;
}

/* 复制成功状态 */
.markdown-content :deep(.code-copy-btn.copied) {
  opacity: 1 !important;
}

.markdown-content :deep(.code-copy-btn.copied .copy-icon) {
  display: none;
}

.markdown-content :deep(.code-copy-btn.copied .check-icon) {
  display: block;
}

/* 代码块 */
.markdown-content :deep(pre.hljs) {
  margin: 0;
  padding: 12px;
  background: var(--vscode-textCodeBlock-background);
  border-radius: 4px;
  overflow-x: auto;
  max-height: 400px;
  overflow-y: auto;
  
  /* 自定义滚动条 - Webkit */
  scrollbar-width: thin;
  scrollbar-color: var(--vscode-scrollbarSlider-background, rgba(100, 100, 100, 0.4)) transparent;
}

.markdown-content :deep(pre.hljs::-webkit-scrollbar) {
  width: 6px;
  height: 6px;
}

.markdown-content :deep(pre.hljs::-webkit-scrollbar-track) {
  background: transparent;
}

.markdown-content :deep(pre.hljs::-webkit-scrollbar-thumb) {
  background: var(--vscode-scrollbarSlider-background, rgba(100, 100, 100, 0.4));
  border-radius: 0;
}

.markdown-content :deep(pre.hljs::-webkit-scrollbar-thumb:hover) {
  background: var(--vscode-scrollbarSlider-hoverBackground, rgba(100, 100, 100, 0.55));
}

.markdown-content :deep(pre.hljs::-webkit-scrollbar-thumb:active) {
  background: var(--vscode-scrollbarSlider-activeBackground, rgba(100, 100, 100, 0.7));
}

.markdown-content :deep(pre.hljs::-webkit-scrollbar-corner) {
  background: transparent;
}

.markdown-content :deep(pre.hljs code) {
  font-family: var(--vscode-editor-font-family, 'Consolas', 'Monaco', monospace);
  font-size: 12px;
  line-height: 1.5;
}

/* 行内代码 */
.markdown-content :deep(.inline-code) {
  padding: 2px 6px;
  background: var(--vscode-textCodeBlock-background);
  border-radius: 3px;
  font-family: var(--vscode-editor-font-family, 'Consolas', 'Monaco', monospace);
  font-size: 0.9em;
}

/* 链接 */
.markdown-content :deep(a) {
  color: var(--vscode-textLink-foreground);
  text-decoration: none;
}

.markdown-content :deep(a:hover) {
  text-decoration: underline;
}

/* 分隔线 */
.markdown-content :deep(hr) {
  margin: 1em 0;
  border: none;
  border-top: 1px solid var(--vscode-panel-border);
}

/* 表格 */
.markdown-content :deep(table) {
  margin: 0.8em 0;
  border-collapse: collapse;
  width: 100%;
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
  padding: 8px 12px;
  border: 1px solid var(--vscode-panel-border);
  text-align: left;
}

.markdown-content :deep(th) {
  background: var(--vscode-textBlockQuote-background);
  font-weight: 600;
}

/* 粗体和斜体 */
.markdown-content :deep(strong) {
  font-weight: 600;
}

.markdown-content :deep(em) {
  font-style: italic;
}

/* LaTeX 块级公式 */
.markdown-content :deep(.katex-block) {
  margin: 1em 0;
  padding: 12px;
  background: var(--vscode-textBlockQuote-background);
  border-radius: 4px;
  overflow-x: auto;
  text-align: center;
}

/* LaTeX 错误 */
.markdown-content :deep(.katex-error) {
  color: var(--vscode-errorForeground);
  font-family: var(--vscode-editor-font-family, monospace);
  background: var(--vscode-inputValidation-errorBackground);
  padding: 2px 4px;
  border-radius: 2px;
}

/* 图片 - 设置最大尺寸限制 */
.markdown-content :deep(img) {
  max-width: 400px;
  max-height: 300px;
  width: auto;
  height: auto;
  border-radius: 4px;
  object-fit: contain;
}

/* 工作区图片加载中 */
.markdown-content :deep(img.workspace-image) {
  min-width: 100px;
  min-height: 60px;
  max-width: 400px;
  max-height: 300px;
  background: var(--vscode-textBlockQuote-background);
  border: 1px dashed var(--vscode-panel-border);
}

/* 工作区图片加载成功 */
.markdown-content :deep(img.loaded-image) {
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
  border: 1px solid var(--vscode-panel-border);
}

.markdown-content :deep(img.loaded-image:hover) {
  transform: scale(1.02);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

/* 工作区图片加载失败 */
.markdown-content :deep(img.image-error) {
  min-width: 100px;
  min-height: 40px;
  max-width: 400px;
  max-height: 300px;
  background: var(--vscode-inputValidation-errorBackground);
  border: 1px dashed var(--vscode-errorForeground);
  opacity: 0.7;
}

.markdown-content :deep(img.image-error::before) {
  content: '⚠️ 图片加载失败';
  display: block;
  font-size: 11px;
  color: var(--vscode-errorForeground);
  text-align: center;
  padding: 10px;
}
</style>