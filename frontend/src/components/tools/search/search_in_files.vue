<script setup lang="ts">
/**
 * search_in_files 工具的内容面板
 * 
 * 显示：
 * - 搜索结果列表
 * - 匹配的文件、行号、上下文
 * - 统计信息
 */

import { computed, ref } from 'vue'
import CustomScrollbar from '../../common/CustomScrollbar.vue'
import { useI18n } from '../../../composables/useI18n'

const { t } = useI18n()

const props = defineProps<{
  args: Record<string, unknown>
  result?: Record<string, unknown>
  error?: string
}>()

// 展开状态
const expanded = ref(false)

// 获取搜索参数
const searchQuery = computed(() => props.args.query as string || '')
const searchPath = computed(() => props.args.path as string || '.')
const filePattern = computed(() => props.args.pattern as string || '**/*')
const isRegex = computed(() => props.args.isRegex as boolean || false)

// 搜索结果
interface SearchMatch {
  file: string
  line: number
  column: number
  match: string
  context: string
}

// 获取搜索结果
const searchResults = computed((): SearchMatch[] => {
  const result = props.result as Record<string, any> | undefined
  if (result?.data?.results) {
    return result.data.results as SearchMatch[]
  }
  return []
})

// 统计信息
const matchCount = computed(() => {
  const result = props.result as Record<string, any> | undefined
  if (result?.data?.count !== undefined) {
    return result.data.count as number
  }
  return searchResults.value.length
})

const truncated = computed(() => {
  const result = props.result as Record<string, any> | undefined
  return result?.data?.truncated as boolean || false
})

// 按文件分组
const groupedResults = computed(() => {
  const groups: Record<string, SearchMatch[]> = {}
  for (const match of searchResults.value) {
    if (!groups[match.file]) {
      groups[match.file] = []
    }
    groups[match.file].push(match)
  }
  return groups
})

// 文件数量
const fileCount = computed(() => Object.keys(groupedResults.value).length)

// 预览匹配数
const previewMatchCount = 10

// 获取显示的结果
const displayResults = computed(() => {
  if (expanded.value || searchResults.value.length <= previewMatchCount) {
    return searchResults.value
  }
  return searchResults.value.slice(0, previewMatchCount)
})

// 检查是否需要展开按钮
const needsExpand = computed(() => searchResults.value.length > previewMatchCount)

// 切换展开状态
function toggleExpand() {
  expanded.value = !expanded.value
}

// 获取文件名
function getFileName(filePath: string): string {
  const parts = filePath.split(/[/\\]/)
  return parts[parts.length - 1] || filePath
}

// 高亮匹配文本
function highlightMatch(context: string, match: string): string {
  // 简单的转义处理
  const escaped = match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return context.replace(new RegExp(escaped, 'gi'), `<mark>${match}</mark>`)
}
</script>

<template>
  <div class="search-in-files-panel">
    <!-- 头部统计 -->
    <div class="panel-header">
      <div class="header-info">
        <span class="codicon codicon-search search-icon"></span>
        <span class="title">{{ t('components.tools.search.searchInFilesPanel.title') }}</span>
        <span v-if="isRegex" class="regex-badge">{{ t('components.tools.search.searchInFilesPanel.regex') }}</span>
      </div>
      <div class="header-stats">
        <span class="stat">{{ t('components.tools.search.searchInFilesPanel.matchCount', { count: matchCount }) }}</span>
        <span class="stat">{{ t('components.tools.search.searchInFilesPanel.fileCount', { count: fileCount }) }}</span>
        <span v-if="truncated" class="stat truncated">{{ t('components.tools.search.searchInFilesPanel.truncated') }}</span>
      </div>
    </div>
    
    <!-- 搜索信息 -->
    <div class="search-info">
      <div class="query-row">
        <span class="label">{{ t('components.tools.search.searchInFilesPanel.keywords') }}</span>
        <code class="query-text">{{ searchQuery }}</code>
      </div>
      <div v-if="searchPath !== '.'" class="path-row">
        <span class="label">{{ t('components.tools.search.searchInFilesPanel.path') }}</span>
        <span class="path-text">{{ searchPath }}</span>
      </div>
      <div v-if="filePattern !== '**/*'" class="pattern-row">
        <span class="label">{{ t('components.tools.search.searchInFilesPanel.pattern') }}</span>
        <span class="pattern-text">{{ filePattern }}</span>
      </div>
    </div>
    
    <!-- 全局错误 -->
    <div v-if="error" class="panel-error">
      <span class="codicon codicon-error error-icon"></span>
      <span class="error-text">{{ error }}</span>
    </div>
    
    <!-- 无结果 -->
    <div v-else-if="searchResults.length === 0 && !error" class="no-results">
      <span class="codicon codicon-info"></span>
      <span>{{ t('components.tools.search.searchInFilesPanel.noResults') }}</span>
    </div>
    
    <!-- 结果列表 -->
    <div v-else class="results-list">
      <CustomScrollbar :max-height="300">
        <div class="match-items">
          <div
            v-for="(match, index) in displayResults"
            :key="`${match.file}-${match.line}-${index}`"
            class="match-item"
          >
            <div class="match-header">
              <span class="codicon codicon-file file-icon"></span>
              <span class="file-name">{{ getFileName(match.file) }}</span>
              <span class="file-path">{{ match.file }}</span>
              <span class="line-info">:{{ match.line }}:{{ match.column }}</span>
            </div>
            <div class="match-context">
              <pre><code v-html="highlightMatch(match.context, match.match)"></code></pre>
            </div>
          </div>
        </div>
      </CustomScrollbar>
      
      <!-- 展开/收起按钮 -->
      <div v-if="needsExpand" class="expand-section">
        <button class="expand-btn" @click="toggleExpand">
          <span :class="['codicon', expanded ? 'codicon-chevron-up' : 'codicon-chevron-down']"></span>
          {{ expanded ? t('components.tools.search.searchInFilesPanel.collapse') : t('components.tools.search.searchInFilesPanel.expandRemaining', { count: searchResults.length - previewMatchCount }) }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-in-files-panel {
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

.search-icon {
  color: var(--vscode-charts-orange);
  font-size: 14px;
}

.title {
  font-weight: 600;
  font-size: 12px;
  color: var(--vscode-foreground);
}

.regex-badge {
  font-size: 9px;
  padding: 1px 4px;
  background: var(--vscode-badge-background);
  color: var(--vscode-badge-foreground);
  border-radius: 2px;
}

.header-stats {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm, 8px);
}

.stat {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}

.stat.truncated {
  color: var(--vscode-charts-yellow);
}

/* 搜索信息 */
.search-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
  background: var(--vscode-editor-inactiveSelectionBackground);
  border-radius: var(--radius-sm, 2px);
}

.query-row,
.path-row,
.pattern-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs, 4px);
  font-size: 11px;
}

.label {
  color: var(--vscode-descriptionForeground);
  flex-shrink: 0;
}

.query-text {
  font-family: var(--vscode-editor-font-family);
  color: var(--vscode-charts-orange);
  background: var(--vscode-textCodeBlock-background);
  padding: 0 4px;
  border-radius: 2px;
}

.path-text,
.pattern-text {
  font-family: var(--vscode-editor-font-family);
  color: var(--vscode-foreground);
}

/* 错误显示 */
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

/* 无结果 */
.no-results {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm, 8px);
  padding: var(--spacing-md, 16px);
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
}

/* 结果列表 */
.results-list {
  border: 1px solid var(--vscode-panel-border);
  border-radius: var(--radius-sm, 2px);
  overflow: hidden;
}

.match-items {
  display: flex;
  flex-direction: column;
}

.match-item {
  border-bottom: 1px solid var(--vscode-panel-border);
}

.match-item:last-child {
  border-bottom: none;
}

.match-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs, 4px);
  padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
  background: var(--vscode-editor-inactiveSelectionBackground);
  font-size: 11px;
}

.file-icon {
  font-size: 12px;
  color: var(--vscode-charts-blue);
  flex-shrink: 0;
}

.file-name {
  font-weight: 500;
  color: var(--vscode-foreground);
  flex-shrink: 0;
}

.file-path {
  color: var(--vscode-descriptionForeground);
  font-family: var(--vscode-editor-font-family);
  font-size: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.line-info {
  color: var(--vscode-charts-orange);
  font-family: var(--vscode-editor-font-family);
  margin-left: auto;
  flex-shrink: 0;
}

.match-context {
  padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
  background: var(--vscode-editor-background);
}

.match-context pre {
  margin: 0;
  font-size: 11px;
  font-family: var(--vscode-editor-font-family);
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-all;
}

.match-context code {
  font-family: inherit;
}

.match-context :deep(mark) {
  background: var(--vscode-editor-findMatchHighlightBackground);
  color: inherit;
  padding: 0 2px;
  border-radius: 2px;
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