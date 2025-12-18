<script setup lang="ts">
/**
 * apply_diff 工具的内容面板
 *
 * 显示差异对比：
 * - 被删除的代码（红色背景）
 * - 新增的代码（绿色背景）
 * - 每个 diff 块独立显示
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

// 展开状态
const expanded = ref<Set<number>>(new Set())

// 复制状态
const copiedDiffs = ref<Set<number>>(new Set())
const copyTimeouts = new Map<number, ReturnType<typeof setTimeout>>()

// 单个 diff 块
interface DiffBlock {
  search: string
  replace: string
  start_line?: number
}

// 获取文件路径
const filePath = computed(() => {
  return (props.args.path as string) || ''
})

// 获取 diff 列表
const diffList = computed((): DiffBlock[] => {
  const diffs = props.args.diffs as DiffBlock[] | undefined
  return diffs && Array.isArray(diffs) ? diffs : []
})

// 获取结果信息
const resultData = computed(() => {
  const result = props.result as Record<string, any> | undefined
  return result?.data || null
})

// 获取文件名
function getFileName(filePath: string): string {
  const parts = filePath.split(/[/\\]/)
  return parts[parts.length - 1] || filePath
}

// 获取文件扩展名
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

// 计算差异行
interface DiffLine {
  type: 'unchanged' | 'deleted' | 'added'
  content: string
  oldLineNum?: number
  newLineNum?: number
}

function computeDiffLines(search: string, replace: string): DiffLine[] {
  const searchLines = search.split('\n')
  const replaceLines = replace.split('\n')
  const result: DiffLine[] = []
  
  // 使用简单的最长公共子序列算法找出差异
  const lcs = computeLCS(searchLines, replaceLines)
  
  let oldIdx = 0
  let newIdx = 0
  let oldLineNum = 1
  let newLineNum = 1
  
  for (const match of lcs) {
    // 添加删除的行（在 search 中但不在 LCS 中）
    while (oldIdx < match.oldIndex) {
      result.push({
        type: 'deleted',
        content: searchLines[oldIdx],
        oldLineNum: oldLineNum++
      })
      oldIdx++
    }
    
    // 添加新增的行（在 replace 中但不在 LCS 中）
    while (newIdx < match.newIndex) {
      result.push({
        type: 'added',
        content: replaceLines[newIdx],
        newLineNum: newLineNum++
      })
      newIdx++
    }
    
    // 添加未更改的行
    result.push({
      type: 'unchanged',
      content: searchLines[oldIdx],
      oldLineNum: oldLineNum++,
      newLineNum: newLineNum++
    })
    oldIdx++
    newIdx++
  }
  
  // 处理剩余的删除行
  while (oldIdx < searchLines.length) {
    result.push({
      type: 'deleted',
      content: searchLines[oldIdx],
      oldLineNum: oldLineNum++
    })
    oldIdx++
  }
  
  // 处理剩余的新增行
  while (newIdx < replaceLines.length) {
    result.push({
      type: 'added',
      content: replaceLines[newIdx],
      newLineNum: newLineNum++
    })
    newIdx++
  }
  
  return result
}

// 计算最长公共子序列
interface LCSMatch {
  oldIndex: number
  newIndex: number
}

function computeLCS(oldLines: string[], newLines: string[]): LCSMatch[] {
  const m = oldLines.length
  const n = newLines.length
  
  // 创建 DP 表
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }
  
  // 回溯找出匹配的行
  const result: LCSMatch[] = []
  let i = m, j = n
  
  while (i > 0 && j > 0) {
    if (oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({ oldIndex: i - 1, newIndex: j - 1 })
      i--
      j--
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--
    } else {
      j--
    }
  }
  
  return result
}

// 获取行号宽度
function getLineNumWidth(diff: DiffBlock): number {
  const searchLines = diff.search.split('\n').length
  const replaceLines = diff.replace.split('\n').length
  const maxLineNum = Math.max(searchLines, replaceLines)
  return String(maxLineNum).length
}

// 格式化行号
function formatLineNum(num: number | undefined, width: number): string {
  if (num === undefined) return ' '.repeat(width)
  return String(num).padStart(width)
}

// 预览行数
const previewLineCount = 20

// 检查是否需要展开按钮
function needsExpand(diffLines: DiffLine[]): boolean {
  return diffLines.length > previewLineCount
}

// 获取显示的 diff 行
function getDisplayLines(diffLines: DiffLine[], index: number): DiffLine[] {
  if (expanded.value.has(index) || diffLines.length <= previewLineCount) {
    return diffLines
  }
  return diffLines.slice(0, previewLineCount)
}

// 切换展开状态
function toggleExpand(index: number) {
  if (expanded.value.has(index)) {
    expanded.value.delete(index)
  } else {
    expanded.value.add(index)
  }
}

// 检查是否已展开
function isExpanded(index: number): boolean {
  return expanded.value.has(index)
}

// 检查是否已复制
function isCopied(index: number): boolean {
  return copiedDiffs.value.has(index)
}

// 复制替换后的内容
async function copyReplace(diff: DiffBlock, index: number) {
  try {
    await navigator.clipboard.writeText(diff.replace)
    
    copiedDiffs.value.add(index)
    
    const existingTimeout = copyTimeouts.get(index)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }
    
    const timeout = setTimeout(() => {
      copiedDiffs.value.delete(index)
      copyTimeouts.delete(index)
    }, 1000)
    copyTimeouts.set(index, timeout)
  } catch (err) {
    console.error('复制失败:', err)
  }
}

// 获取统计信息
function getDiffStats(diffLines: DiffLine[]) {
  const deleted = diffLines.filter(l => l.type === 'deleted').length
  const added = diffLines.filter(l => l.type === 'added').length
  return { deleted, added }
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
  <div class="apply-diff-panel">
    <!-- 头部信息 -->
    <div class="panel-header">
      <div class="header-info">
        <span class="codicon codicon-diff diff-icon"></span>
        <span class="title">{{ t('components.tools.file.applyDiffPanel.title') }}</span>
      </div>
      <div class="header-stats">
        <span class="stat">
          <span class="codicon codicon-file"></span>
          {{ getFileNameWithoutExt(filePath) }}<span v-if="getFileExtension(filePath)" class="file-ext">.{{ getFileExtension(filePath) }}</span>
        </span>
        <span class="stat">{{ diffList.length }} {{ t('components.tools.file.applyDiffPanel.changes') }}</span>
      </div>
    </div>
    
    <!-- 文件路径 -->
    <div class="file-path-bar">
      <span class="codicon codicon-file-code"></span>
      <span class="path">{{ filePath }}</span>
    </div>
    
    <!-- 结果状态 -->
    <div v-if="resultData" class="result-status" :class="{ 'is-error': error }">
      <span v-if="!error" class="codicon codicon-check status-icon success"></span>
      <span v-else class="codicon codicon-error status-icon error"></span>
      <span class="status-text">
        {{ error || resultData.message || t('components.tools.file.applyDiffPanel.diffApplied') }}
      </span>
      <span v-if="resultData.status === 'pending'" class="status-badge pending">{{ t('components.tools.file.applyDiffPanel.pending') }}</span>
      <span v-else-if="resultData.status === 'accepted'" class="status-badge accepted">{{ t('components.tools.file.applyDiffPanel.accepted') }}</span>
    </div>
    
    <!-- 全局错误 -->
    <div v-if="error && !resultData" class="panel-error">
      <span class="codicon codicon-error error-icon"></span>
      <span class="error-text">{{ error }}</span>
    </div>
    
    <!-- Diff 列表 -->
    <div class="diff-list">
      <div
        v-for="(diff, index) in diffList"
        :key="index"
        class="diff-block"
      >
        <!-- Diff 头部 -->
        <div class="diff-header">
          <div class="diff-info">
            <span class="diff-number">{{ t('components.tools.file.applyDiffPanel.diffNumber') }}{{ index + 1 }}</span>
            <span v-if="diff.start_line" class="start-line">
              <span class="codicon codicon-location"></span>
              {{ t('components.tools.file.applyDiffPanel.line') }} {{ diff.start_line }}
            </span>
            <!-- 统计信息 -->
            <span class="diff-stats">
              <span class="stat deleted">
                <span class="codicon codicon-remove"></span>
                {{ getDiffStats(computeDiffLines(diff.search, diff.replace)).deleted }}
              </span>
              <span class="stat added">
                <span class="codicon codicon-add"></span>
                {{ getDiffStats(computeDiffLines(diff.search, diff.replace)).added }}
              </span>
            </span>
          </div>
          <div class="diff-actions">
            <button
              class="action-btn"
              :class="{ 'copied': isCopied(index) }"
              :title="isCopied(index) ? t('components.tools.file.applyDiffPanel.copied') : t('components.tools.file.applyDiffPanel.copyNew')"
              @click.stop="copyReplace(diff, index)"
            >
              <span :class="['codicon', isCopied(index) ? 'codicon-check' : 'codicon-copy']"></span>
            </button>
          </div>
        </div>
        
        <!-- Diff 内容 -->
        <div class="diff-content">
          <CustomScrollbar :horizontal="true">
            <div class="diff-lines">
              <div
                v-for="(line, lineIndex) in getDisplayLines(computeDiffLines(diff.search, diff.replace), index)"
                :key="lineIndex"
                :class="['diff-line', `line-${line.type}`]"
              >
                <!-- 行号列 -->
                <span class="line-nums">
                  <span class="old-num">{{ formatLineNum(line.oldLineNum, getLineNumWidth(diff)) }}</span>
                  <span class="new-num">{{ formatLineNum(line.newLineNum, getLineNumWidth(diff)) }}</span>
                </span>
                <!-- 差异标记 -->
                <span class="line-marker">
                  <span v-if="line.type === 'deleted'" class="marker deleted">-</span>
                  <span v-else-if="line.type === 'added'" class="marker added">+</span>
                  <span v-else class="marker unchanged">&nbsp;</span>
                </span>
                <!-- 内容 -->
                <span class="line-content">{{ line.content || ' ' }}</span>
              </div>
            </div>
          </CustomScrollbar>
          
          <!-- 展开/收起按钮 -->
          <div v-if="needsExpand(computeDiffLines(diff.search, diff.replace))" class="expand-section">
            <button class="expand-btn" @click="toggleExpand(index)">
              <span :class="['codicon', isExpanded(index) ? 'codicon-chevron-up' : 'codicon-chevron-down']"></span>
              {{ isExpanded(index) ? t('components.tools.file.applyDiffPanel.collapse') : t('components.tools.file.applyDiffPanel.expandRemaining', { count: computeDiffLines(diff.search, diff.replace).length - previewLineCount }) }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.apply-diff-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm, 8px);
}

/* 头部 */
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

.diff-icon {
  color: var(--vscode-charts-purple, #a855f7);
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

.file-ext {
  opacity: 0.7;
}

/* 文件路径栏 */
.file-path-bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs, 4px);
  padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
  background: var(--vscode-editor-inactiveSelectionBackground);
  border-radius: var(--radius-sm, 2px);
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  font-family: var(--vscode-editor-font-family);
}

.file-path-bar .codicon {
  color: var(--vscode-charts-blue);
}

.file-path-bar .path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 结果状态 */
.result-status {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm, 8px);
  padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
  background: var(--vscode-testing-iconPassed);
  background: rgba(0, 200, 83, 0.1);
  border: 1px solid var(--vscode-testing-iconPassed);
  border-radius: var(--radius-sm, 2px);
}

.result-status.is-error {
  background: rgba(255, 82, 82, 0.1);
  border-color: var(--vscode-testing-iconFailed);
}

.status-icon {
  font-size: 12px;
}

.status-icon.success {
  color: var(--vscode-testing-iconPassed);
}

.status-icon.error {
  color: var(--vscode-testing-iconFailed);
}

.status-text {
  flex: 1;
  font-size: 11px;
  color: var(--vscode-foreground);
}

.status-badge {
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 2px;
  font-weight: 500;
}

.status-badge.pending {
  background: var(--vscode-charts-orange, #e69500);
  color: var(--vscode-editor-background);
}

.status-badge.accepted {
  background: var(--vscode-testing-iconPassed);
  color: var(--vscode-editor-background);
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

/* Diff 列表 */
.diff-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm, 8px);
}

/* 单个 Diff 块 */
.diff-block {
  border: 1px solid var(--vscode-panel-border);
  border-radius: var(--radius-sm, 2px);
  overflow: hidden;
}

/* Diff 头部 */
.diff-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
  background: var(--vscode-editor-inactiveSelectionBackground);
  border-bottom: 1px solid var(--vscode-panel-border);
}

.diff-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm, 8px);
}

.diff-number {
  font-size: 11px;
  font-weight: 600;
  color: var(--vscode-foreground);
}

.start-line {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 10px;
  color: var(--vscode-descriptionForeground);
}

.diff-stats {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm, 8px);
}

.diff-stats .stat {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 10px;
}

.diff-stats .stat.deleted {
  color: var(--vscode-gitDecoration-deletedResourceForeground, #f85149);
}

.diff-stats .stat.added {
  color: var(--vscode-gitDecoration-addedResourceForeground, #3fb950);
}

.diff-actions {
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

/* Diff 内容 */
.diff-content {
  display: flex;
  flex-direction: column;
  background: var(--vscode-editor-background);
  max-height: 300px;
}

.diff-lines {
  display: flex;
  flex-direction: column;
  font-family: var(--vscode-editor-font-family);
  font-size: 11px;
  line-height: 1.5;
}

/* Diff 行样式 */
.diff-line {
  display: flex;
  white-space: pre;
  min-height: 1.5em;
}

.diff-line.line-unchanged {
  background: transparent;
}

.diff-line.line-deleted {
  background: rgba(255, 82, 82, 0.15);
}

.diff-line.line-added {
  background: rgba(0, 200, 83, 0.15);
}

/* 行号 */
.line-nums {
  display: flex;
  flex-shrink: 0;
  padding: 0 var(--spacing-xs, 4px);
  background: var(--vscode-editorLineNumber-foreground);
  background: rgba(128, 128, 128, 0.1);
  border-right: 1px solid var(--vscode-panel-border);
}

.old-num,
.new-num {
  min-width: 24px;
  text-align: right;
  color: var(--vscode-editorLineNumber-foreground);
  padding: 0 2px;
}

.line-deleted .old-num {
  color: var(--vscode-gitDecoration-deletedResourceForeground, #f85149);
}

.line-added .new-num {
  color: var(--vscode-gitDecoration-addedResourceForeground, #3fb950);
}

/* 差异标记 */
.line-marker {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  flex-shrink: 0;
}

.marker {
  font-weight: bold;
}

.marker.deleted {
  color: var(--vscode-gitDecoration-deletedResourceForeground, #f85149);
}

.marker.added {
  color: var(--vscode-gitDecoration-addedResourceForeground, #3fb950);
}

.marker.unchanged {
  color: transparent;
}

/* 行内容 */
.line-content {
  flex: 1;
  padding: 0 var(--spacing-sm, 8px);
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
</style>