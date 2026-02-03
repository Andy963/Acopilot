<script setup lang="ts">
/**
 * read_file 工具的内容面板
 *
 * 支持批量读取，每个文件一个小面板显示
 * 显示：
 * - 文件路径
 * - 文件内容（后端已带行号，格式如 "   1 | content"）
 */

import { computed, ref, onBeforeUnmount } from 'vue'
import CustomScrollbar from '../../common/CustomScrollbar.vue'
import { useI18n } from '@/composables'

const props = defineProps<{
  args: Record<string, unknown>
  result?: Record<string, unknown>
  error?: string
}>()

const { t } = useI18n()

// 每个文件的展开状态
const expandedFiles = ref<Set<string>>(new Set())

// 复制状态（按文件路径）
const copiedFiles = ref<Set<string>>(new Set())
const copyTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

// 单个文件读取请求
interface FileRequest {
  path: string
  startLine?: number
  endLine?: number
}

// 获取文件请求列表
const fileRequests = computed((): FileRequest[] => {
  if (props.args.files && Array.isArray(props.args.files)) {
    return props.args.files as FileRequest[]
  }
  return []
})

// 获取路径列表
const pathList = computed(() => {
  return fileRequests.value.map(f => f.path)
})

// 单个文件读取结果
interface ReadResult {
  path: string
  success: boolean
  type?: 'text' | 'multimodal' | 'binary'
  content?: string
  lineCount?: number
  totalLines?: number    // 文件总行数（使用行范围时返回）
  startLine?: number     // 起始行号（使用行范围时返回）
  endLine?: number       // 结束行号（使用行范围时返回）
  mimeType?: string
  size?: number
  error?: string
}

// 获取读取结果列表
const readResults = computed((): ReadResult[] => {
  const result = props.result as Record<string, any> | undefined
  
  // 批量结果
  if (result?.data?.results) {
    return result.data.results as ReadResult[]
  }
  
  // 如果没有结果，为每个路径创建空结果
  return pathList.value.map(p => ({
    path: p,
    success: !props.error,
    error: props.error
  }))
})

// 单文件时：头部已在 ToolMessage 内联显示（读取文件 + 文件名），这里压缩掉每文件标题行。
const compactSingleFile = computed(() => readResults.value.length === 1)

// 统计信息（成功/失败/总数）已上移到 ToolMessage 头部，避免重复标题栏。

// 获取行范围摘要文本
function getLineRangeSummary(result: ReadResult): string | null {
  if (result.startLine === undefined && result.endLine === undefined) {
    return null
  }
  
  const start = result.startLine ?? 1
  const end = result.endLine ?? result.totalLines ?? '?'
  const total = result.totalLines ?? '?'
  
  return `L${start}-${end} / ${total}`
}

// 检查是否是部分读取
function isPartialRead(result: ReadResult): boolean {
  if (result.totalLines === undefined) return false
  if (result.startLine === undefined && result.endLine === undefined) return false
  
  const start = result.startLine ?? 1
  const end = result.endLine ?? result.totalLines
  
  return start > 1 || end < result.totalLines
}

// 预览行数
const previewLineCount = 15

// 获取文件名
function getFileNameWithExt(filePath: string): string {
  const parts = filePath.split(/[/\\]/)
  return parts[parts.length - 1] || filePath
}

// 获取不含扩展名的文件名（用于 UI 分离显示扩展名）
function getFileBaseName(filePath: string): string {
  const fileName = getFileNameWithExt(filePath)
  const lastDot = fileName.lastIndexOf('.')
  if (lastDot > 0 && lastDot < fileName.length - 1) return fileName.slice(0, lastDot)
  return fileName
}

// 获取文件扩展名
function getFileExtension(filePath: string): string {
  const fileName = getFileNameWithExt(filePath)
  const lastDot = fileName.lastIndexOf('.')
  if (lastDot > 0 && lastDot < fileName.length - 1) return fileName.slice(lastDot + 1)
  return ''
}

// 获取内容行数组
function getContentLines(content: string | undefined): string[] {
  return content ? content.split('\n') : []
}

// 获取显示的内容
function getDisplayContent(result: ReadResult): string {
  if (!result.content) return ''
  const lines = getContentLines(result.content)
  if (isFileExpanded(result.path) || lines.length <= previewLineCount) {
    return result.content
  }
  return lines.slice(0, previewLineCount).join('\n')
}

// 检查是否需要展开按钮
function needsExpand(result: ReadResult): boolean {
  const lines = getContentLines(result.content)
  return lines.length > previewLineCount
}

// 切换文件展开状态
function toggleFile(path: string) {
  if (expandedFiles.value.has(path)) {
    expandedFiles.value.delete(path)
  } else {
    expandedFiles.value.add(path)
  }
}

// 检查文件是否展开
function isFileExpanded(path: string): boolean {
  return expandedFiles.value.has(path)
}

// 检查是否已复制
function isCopied(path: string): boolean {
  return copiedFiles.value.has(path)
}

// 复制单个文件内容
async function copyFileContent(result: ReadResult) {
  if (!result.content) return
  
  try {
    // 移除行号前缀（格式如 "   1 | "）
    const lines = getContentLines(result.content)
    const rawContent = lines
      .map(line => {
        const match = line.match(/^\s*\d+\s*\|\s?(.*)$/)
        return match ? match[1] : line
      })
      .join('\n')
    await navigator.clipboard.writeText(rawContent)
    
    // 显示对钩状态
    copiedFiles.value.add(result.path)
    
    // 清除之前的定时器
    const existingTimeout = copyTimeouts.get(result.path)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }
    
    // 1秒后恢复
    const timeout = setTimeout(() => {
      copiedFiles.value.delete(result.path)
      copyTimeouts.delete(result.path)
    }, 1000)
    copyTimeouts.set(result.path, timeout)
  } catch (err) {
    console.error('复制失败:', err)
  }
}

// 清理定时器
onBeforeUnmount(() => {
  for (const timeout of copyTimeouts.values()) {
    clearTimeout(timeout)
  }
  copyTimeouts.clear()
})
</script>

<template>
  <div class="read-file-panel">
    <!-- 全局错误 -->
    <div v-if="error && readResults.length === 0" class="panel-error">
      <span class="codicon codicon-error error-icon"></span>
      <span class="error-text">{{ error }}</span>
    </div>
    
    <!-- 文件列表 -->
    <div v-else class="file-list">
      <div
        v-for="result in readResults"
        :key="result.path"
        :class="['file-panel', { 'is-error': !result.success }]"
      >
        <!-- 文件头部 -->
        <div v-if="!compactSingleFile" class="file-header">
          <div class="file-info">
            <span :class="[
              'file-icon',
              'codicon',
              result.success ? 'codicon-file-text' : 'codicon-error'
            ]"></span>
            <span class="file-name">{{ getFileBaseName(result.path) }}</span>
            <span v-if="getFileExtension(result.path)" class="file-ext">.{{ getFileExtension(result.path) }}</span>
            <span v-if="result.lineCount" class="line-count">{{ t('components.tools.file.readFilePanel.lines', { count: result.lineCount }) }}</span>
          </div>
          <div class="file-actions">
            <button
              v-if="result.content"
              class="action-btn"
              :class="{ 'copied': isCopied(result.path) }"
              :title="isCopied(result.path) ? t('components.tools.file.readFilePanel.copied') : t('components.tools.file.readFilePanel.copyContent')"
              @click.stop="copyFileContent(result)"
            >
              <span :class="['codicon', isCopied(result.path) ? 'codicon-check' : 'codicon-copy']"></span>
            </button>
          </div>
        </div>
        
        <!-- 文件路径 -->
        <div v-if="!compactSingleFile" class="file-path">{{ result.path }}</div>
        
        <!-- 行范围信息（仅当使用行范围时显示） -->
        <div v-if="getLineRangeSummary(result)" class="line-range-info">
          <span class="codicon codicon-list-selection"></span>
          <span class="range-text">{{ getLineRangeSummary(result) }}</span>
          <span v-if="isPartialRead(result)" class="partial-badge">partial</span>
        </div>
        
        <!-- 错误信息 -->
        <div v-if="!result.success && result.error" class="file-error">
          {{ result.error }}
        </div>
        
        <!-- 二进制文件提示 -->
        <div v-else-if="result.type === 'binary'" class="file-binary">
          <span class="codicon codicon-file-binary"></span>
          <span>{{ t('components.tools.file.readFilePanel.binaryFile') }} ({{ result.size ? Math.round(result.size / 1024) + ' KB' : t('components.tools.file.readFilePanel.unknownSize') }})</span>
        </div>
        
        <!-- 多模态文件提示 -->
        <div v-else-if="result.type === 'multimodal'" class="file-multimodal">
          <span class="codicon codicon-file-media"></span>
          <span>{{ result.mimeType }} ({{ result.size ? Math.round(result.size / 1024) + ' KB' : '' }})</span>
        </div>
        
        <!-- 文本内容 -->
        <div v-else-if="result.content" class="file-content" :class="{ 'expanded': isFileExpanded(result.path) }">
          <div class="content-wrapper">
            <CustomScrollbar :horizontal="true">
              <pre class="content-code"><code>{{ getDisplayContent(result) }}</code></pre>
            </CustomScrollbar>
          </div>
          
          <!-- 展开/收起按钮 -->
          <div v-if="needsExpand(result)" class="expand-section">
            <button class="expand-btn" @click="toggleFile(result.path)">
              <span :class="['codicon', isFileExpanded(result.path) ? 'codicon-chevron-up' : 'codicon-chevron-down']"></span>
              {{ isFileExpanded(result.path) ? t('components.tools.file.readFilePanel.collapse') : t('components.tools.file.readFilePanel.expandRemaining', { count: getContentLines(result.content).length - previewLineCount }) }}
            </button>
          </div>
        </div>
        
        <!-- 空文件 -->
        <div v-else-if="result.success" class="file-empty">
          <span class="codicon codicon-file"></span>
          <span>{{ t('components.tools.file.readFilePanel.emptyFile') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="./read_file.css"></style>
