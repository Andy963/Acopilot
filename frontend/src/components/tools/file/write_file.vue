<script setup lang="ts">
/**
 * write_file 工具的内容面板
 *
 * 支持批量写入，每个文件一个小面板显示
 * 显示：
 * - 文件名（标题）
 * - 文件路径（副标题）
 * - 写入的内容（带行号）
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

// 单个文件写入配置
interface WriteFileEntry {
  path: string
  content: string
}

// 单个文件写入结果
interface WriteResult {
  path: string
  success: boolean
  action?: 'created' | 'modified' | 'unchanged'
  diffId?: string
  status?: string
  originalSize?: number
  newSize?: number
  lineCount?: number
  error?: string
}

// 获取文件列表（从参数中）
const fileList = computed((): WriteFileEntry[] => {
  const files = props.args.files as WriteFileEntry[] | undefined
  return files && Array.isArray(files) ? files : []
})

// 获取写入结果列表（从结果中）
const writeResults = computed((): WriteResult[] => {
  const result = props.result as Record<string, any> | undefined
  
  // 批量结果
  if (result?.data?.results) {
    return result.data.results as WriteResult[]
  }
  
  // 如果没有结果，为每个文件创建空结果
  return fileList.value.map(f => ({
    path: f.path,
    success: !props.error,
    lineCount: f.content?.split('\n').length,
    error: props.error
  }))
})

// 合并文件列表和结果，方便显示
interface MergedFile {
  path: string
  content: string
  result: WriteResult | undefined
}

const mergedFiles = computed((): MergedFile[] => {
  return fileList.value.map(entry => {
    const result = writeResults.value.find(r => r.path === entry.path)
    return {
      path: entry.path,
      content: entry.content,
      result
    }
  })
})

// 总文件数统计
const successCount = computed(() => {
  const result = props.result as Record<string, any> | undefined
  if (result?.data?.successCount !== undefined) {
    return result.data.successCount as number
  }
  return writeResults.value.filter(r => r.success).length
})

const failCount = computed(() => {
  const result = props.result as Record<string, any> | undefined
  if (result?.data?.failCount !== undefined) {
    return result.data.failCount as number
  }
  return writeResults.value.filter(r => !r.success).length
})

// 预览行数
const previewLineCount = 15

// 获取文件名
function getFileName(filePath: string): string {
  const parts = filePath.split(/[/\\]/)
  return parts[parts.length - 1] || filePath
}

// 获取文件扩展名（不含点号）
function getFileExtension(filePath: string): string {
  const fileName = getFileName(filePath)
  const lastDotIndex = fileName.lastIndexOf('.')
  if (lastDotIndex > 0) {
    return fileName.substring(lastDotIndex + 1)
  }
  return ''
}

// 获取不含扩展名的文件名
function getFileNameWithoutExt(filePath: string): string {
  const fileName = getFileName(filePath)
  const lastDotIndex = fileName.lastIndexOf('.')
  if (lastDotIndex > 0) {
    return fileName.substring(0, lastDotIndex)
  }
  return fileName
}

// 获取内容行数组
function getContentLines(content: string | undefined): string[] {
  return content ? content.split('\n') : []
}

// 获取显示的内容（带行号）
function getDisplayContent(file: MergedFile): string {
  if (!file.content) return ''
  const lines = getContentLines(file.content)
  const maxLineNum = lines.length
  const padWidth = String(maxLineNum).length
  
  const displayLines = isFileExpanded(file.path) || lines.length <= previewLineCount
    ? lines
    : lines.slice(0, previewLineCount)
  
  return displayLines.map((line, index) =>
    `${String(index + 1).padStart(padWidth)} | ${line}`
  ).join('\n')
}

// 检查是否需要展开按钮
function needsExpand(file: MergedFile): boolean {
  const lines = getContentLines(file.content)
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
async function copyFileContent(file: MergedFile) {
  if (!file.content) return
  
  try {
    await navigator.clipboard.writeText(file.content)
    
    // 显示对钩状态
    copiedFiles.value.add(file.path)
    
    // 清除之前的定时器
    const existingTimeout = copyTimeouts.get(file.path)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }
    
    // 1秒后恢复
    const timeout = setTimeout(() => {
      copiedFiles.value.delete(file.path)
      copyTimeouts.delete(file.path)
    }, 1000)
    copyTimeouts.set(file.path, timeout)
  } catch (err) {
    console.error('复制失败:', err)
  }
}

// 获取操作图标
function getActionIcon(action?: string): string {
  switch (action) {
    case 'created':
      return 'codicon-new-file'
    case 'modified':
      return 'codicon-edit'
    case 'unchanged':
      return 'codicon-file'
    default:
      return 'codicon-save'
  }
}

// 获取操作标签
function getActionLabel(action?: string): string {
  switch (action) {
    case 'created':
      return t('components.tools.file.writeFilePanel.actions.created')
    case 'modified':
      return t('components.tools.file.writeFilePanel.actions.modified')
    case 'unchanged':
      return t('components.tools.file.writeFilePanel.actions.unchanged')
    default:
      return t('components.tools.file.writeFilePanel.actions.write')
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
  <div class="write-file-panel">
    <!-- 总体统计头部 -->
    <div class="panel-header">
      <div class="header-info">
        <span class="codicon codicon-save files-icon"></span>
        <span class="title">{{ t('components.tools.file.writeFilePanel.title') }}</span>
      </div>
      <div class="header-stats">
        <span v-if="successCount > 0" class="stat success">
          <span class="codicon codicon-check"></span>
          {{ successCount }}
        </span>
        <span v-if="failCount > 0" class="stat error">
          <span class="codicon codicon-error"></span>
          {{ failCount }}
        </span>
        <span class="stat total">{{ t('components.tools.file.writeFilePanel.total', { count: mergedFiles.length }) }}</span>
      </div>
    </div>
    
    <!-- 全局错误 -->
    <div v-if="error && mergedFiles.length === 0" class="panel-error">
      <span class="codicon codicon-error error-icon"></span>
      <span class="error-text">{{ error }}</span>
    </div>
    
    <!-- 文件列表 -->
    <div v-else class="file-list">
      <div
        v-for="file in mergedFiles"
        :key="file.path"
        :class="['file-panel', { 'is-error': file.result && !file.result.success }]"
      >
        <!-- 文件头部 -->
        <div class="file-header">
          <div class="file-info">
            <span :class="[
              'file-icon',
              'codicon',
              file.result?.success === false ? 'codicon-error' : getActionIcon(file.result?.action)
            ]"></span>
            <span class="file-name">{{ getFileNameWithoutExt(file.path) }}</span>
            <span v-if="getFileExtension(file.path)" class="file-ext">.{{ getFileExtension(file.path) }}</span>
            <span v-if="file.result?.action" :class="['action-badge', file.result.action]">
              {{ getActionLabel(file.result.action) }}
            </span>
            <span v-if="file.result?.lineCount || getContentLines(file.content).length" class="line-count">
              {{ t('components.tools.file.writeFilePanel.lines', { count: file.result?.lineCount || getContentLines(file.content).length }) }}
            </span>
          </div>
          <div class="file-actions">
            <button
              v-if="file.content"
              class="action-btn"
              :class="{ 'copied': isCopied(file.path) }"
              :title="isCopied(file.path) ? t('components.tools.file.writeFilePanel.copied') : t('components.tools.file.writeFilePanel.copyContent')"
              @click.stop="copyFileContent(file)"
            >
              <span :class="['codicon', isCopied(file.path) ? 'codicon-check' : 'codicon-copy']"></span>
            </button>
          </div>
        </div>
        
        <!-- 文件路径 -->
        <div class="file-path">{{ file.path }}</div>
        
        <!-- 错误信息 -->
        <div v-if="file.result && !file.result.success && file.result.error" class="file-error">
          {{ file.result.error }}
        </div>
        
        <!-- 文件内容 -->
        <div v-else-if="file.content" class="file-content" :class="{ 'expanded': isFileExpanded(file.path) }">
          <div class="content-wrapper">
            <CustomScrollbar :horizontal="true">
              <pre class="content-code"><code>{{ getDisplayContent(file) }}</code></pre>
            </CustomScrollbar>
          </div>
          
          <!-- 展开/收起按钮 -->
          <div v-if="needsExpand(file)" class="expand-section">
            <button class="expand-btn" @click="toggleFile(file.path)">
              <span :class="['codicon', isFileExpanded(file.path) ? 'codicon-chevron-up' : 'codicon-chevron-down']"></span>
              {{ isFileExpanded(file.path) ? t('components.tools.file.writeFilePanel.collapse') : t('components.tools.file.writeFilePanel.expandRemaining', { count: getContentLines(file.content).length - previewLineCount }) }}
            </button>
          </div>
        </div>
        
        <!-- 空文件 -->
        <div v-else class="file-empty">
          <span class="codicon codicon-file"></span>
          <span>{{ t('components.tools.file.writeFilePanel.noContent') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.write-file-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm, 8px);
}

/* 总体头部 */
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-xs, 4px) 0;
}

.header-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs, 4px);
}

.files-icon {
  color: var(--vscode-charts-orange, #e69500);
  font-size: 14px;
}

.title {
  font-weight: 600;
  font-size: 12px;
  color: var(--vscode-foreground);
}

.header-stats {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm, 8px);
}

.stat {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}

.stat.success {
  color: var(--vscode-testing-iconPassed);
}

.stat.error {
  color: var(--vscode-testing-iconFailed);
}

/* 全局错误 */
.panel-error {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm, 8px);
  padding: var(--spacing-sm, 8px);
  background: var(--vscode-inputValidation-errorBackground);
  border: 1px solid var(--vscode-inputValidation-errorBorder);
  border-radius: var(--radius-sm, 2px);
}

.error-icon {
  color: var(--vscode-inputValidation-errorForeground);
  font-size: 14px;
  flex-shrink: 0;
}

.error-text {
  font-size: 12px;
  color: var(--vscode-inputValidation-errorForeground);
  line-height: 1.4;
}

/* 文件列表 */
.file-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm, 8px);
}

/* 单个文件面板 */
.file-panel {
  border: 1px solid var(--vscode-panel-border);
  border-radius: var(--radius-sm, 2px);
  overflow: hidden;
}

.file-panel.is-error {
  border-color: var(--vscode-inputValidation-errorBorder);
}

/* 文件头部 */
.file-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
  background: var(--vscode-editor-inactiveSelectionBackground);
  border-bottom: 1px solid var(--vscode-panel-border);
}

.file-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs, 4px);
  flex: 1;
  min-width: 0;
}

.file-icon {
  font-size: 12px;
  color: var(--vscode-charts-orange, #e69500);
  flex-shrink: 0;
}

.file-panel.is-error .file-icon {
  color: var(--vscode-inputValidation-errorForeground);
}

.file-name {
  font-size: 11px;
  font-weight: 500;
  color: var(--vscode-foreground);
}

.file-ext {
  font-size: 10px;
  color: var(--vscode-descriptionForeground);
}

.action-badge {
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 2px;
  margin-left: var(--spacing-xs, 4px);
  font-weight: 500;
}

.action-badge.created {
  background: var(--vscode-testing-iconPassed);
  color: var(--vscode-editor-background);
}

.action-badge.modified {
  background: var(--vscode-charts-orange, #e69500);
  color: var(--vscode-editor-background);
}

.action-badge.unchanged {
  background: var(--vscode-descriptionForeground);
  color: var(--vscode-editor-background);
}

.line-count {
  font-size: 10px;
  color: var(--vscode-descriptionForeground);
  margin-left: auto;
  flex-shrink: 0;
}

.file-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs, 4px);
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm, 2px);
  color: var(--vscode-descriptionForeground);
  cursor: pointer;
  transition: all var(--transition-fast, 0.1s);
}

.action-btn:hover {
  background: var(--vscode-toolbar-hoverBackground);
  color: var(--vscode-foreground);
}

.action-btn.copied {
  color: var(--vscode-testing-iconPassed);
}

/* 文件路径 */
.file-path {
  padding: 2px var(--spacing-sm, 8px);
  font-size: 10px;
  color: var(--vscode-descriptionForeground);
  font-family: var(--vscode-editor-font-family);
  background: var(--vscode-editor-background);
  border-bottom: 1px solid var(--vscode-panel-border);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 文件错误 */
.file-error {
  padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
  font-size: 11px;
  color: var(--vscode-inputValidation-errorForeground);
  background: var(--vscode-inputValidation-errorBackground);
}

/* 文件内容 */
.file-content {
  display: flex;
  flex-direction: column;
  background: var(--vscode-editor-background);
}

.content-wrapper {
  height: 200px;
  position: relative;
}

.file-content.expanded .content-wrapper {
  height: 400px;
}

.content-code {
  margin: 0;
  padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
  font-size: 11px;
  font-family: var(--vscode-editor-font-family);
  color: var(--vscode-foreground);
  line-height: 1.4;
  white-space: pre;
}

.content-code code {
  font-family: inherit;
}

/* 展开区域 */
.expand-section {
  display: flex;
  justify-content: center;
  padding: 2px;
  background: var(--vscode-editor-inactiveSelectionBackground);
  border-top: 1px solid var(--vscode-panel-border);
}

.expand-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs, 4px);
  padding: 2px var(--spacing-sm, 8px);
  background: transparent;
  border: none;
  font-size: 10px;
  color: var(--vscode-textLink-foreground);
  cursor: pointer;
  transition: opacity var(--transition-fast, 0.1s);
}

.expand-btn:hover {
  opacity: 0.8;
}

/* 空文件 */
.file-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm, 8px);
  padding: var(--spacing-sm, 8px);
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
}
</style>