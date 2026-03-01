<script setup lang="ts">
import CustomScrollbar from '../../common/CustomScrollbar.vue'
import { useSearchInFilesPanel } from './useSearchInFilesPanel'

const props = defineProps<{
  args: Record<string, unknown>
  result?: Record<string, unknown>
  error?: string
}>()

const {
  t,
  expanded,
  searchQuery,
  searchPath,
  filePattern,
  isRegex,
  replacement,
  dryRun,
  isReplaceMode,
  searchResults,
  replaceResults,
  matchCount,
  filesModified,
  truncated,
  groupedResults,
  fileCount,
  previewMatchCount,
  displayResults,
  needsExpand,
  toggleExpand,
  getFileName,
  highlightMatch,
  viewModes,
  getViewMode,
  hasDiffContent,
  getDiffContent,
  isLoadingDiff,
  computeDiffLines,
  getDiffLineNumWidth,
  formatLineNum,
  getDiffStats,
  previewDiffLineCount,
  getDisplayDiffLines,
  toggleDiffExpand,
  isDiffExpanded,
} = useSearchInFilesPanel(props)
</script>

<template>
  <div class="search-in-files-panel">
    <!-- 头部统计 -->
    <div class="panel-header">
      <div class="header-info">
        <span :class="['codicon', isReplaceMode ? 'codicon-replace-all' : 'codicon-search', 'search-icon']"></span>
        <span class="title">{{ isReplaceMode ? t('components.tools.search.searchInFilesPanel.replaceTitle') : t('components.tools.search.searchInFilesPanel.title') }}</span>
        <span v-if="isRegex" class="regex-badge">{{ t('components.tools.search.searchInFilesPanel.regex') }}</span>
        <span v-if="isReplaceMode && dryRun" class="dryrun-badge">{{ t('components.tools.search.searchInFilesPanel.dryRun') }}</span>
      </div>
      <div class="header-stats">
        <span v-if="isReplaceMode" class="stat success">
          <span class="codicon codicon-check"></span>
          {{ t('components.tools.search.searchInFilesPanel.replacements', { count: matchCount }) }}
        </span>
        <span v-if="isReplaceMode" class="stat">{{ t('components.tools.search.searchInFilesPanel.filesModified', { count: filesModified }) }}</span>
        <span v-else class="stat">{{ t('components.tools.search.searchInFilesPanel.matchCount', { count: matchCount }) }}</span>
        <span v-if="!isReplaceMode" class="stat">{{ t('components.tools.search.searchInFilesPanel.fileCount', { count: fileCount }) }}</span>
        <span v-if="truncated" class="stat truncated">{{ t('components.tools.search.searchInFilesPanel.truncated') }}</span>
      </div>
    </div>
    
    <!-- 搜索信息 -->
    <div class="search-info">
      <div class="query-row">
        <span class="label">{{ t('components.tools.search.searchInFilesPanel.keywords') }}</span>
        <code class="query-text">{{ searchQuery }}</code>
      </div>
      <div v-if="isReplaceMode && replacement !== undefined" class="replace-row">
        <span class="label">{{ t('components.tools.search.searchInFilesPanel.replaceWith') }}</span>
        <code class="replace-text">{{ replacement || t('components.tools.search.searchInFilesPanel.emptyString') }}</code>
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
    
    <!-- 替换模式：按文件显示结果 -->
    <div v-else-if="isReplaceMode" class="replace-results">
      <div
        v-for="replaceResult in replaceResults"
        :key="replaceResult.file"
        class="replace-file-panel"
      >
        <!-- 文件头部 -->
        <div class="file-header">
          <div class="file-info">
            <span class="codicon codicon-file file-icon"></span>
            <span class="file-name">{{ getFileName(replaceResult.file) }}</span>
            <span class="file-path">{{ replaceResult.file }}</span>
            <span class="replace-count">{{ t('components.tools.search.searchInFilesPanel.replacementsInFile', { count: replaceResult.replacements }) }}</span>
          </div>
        </div>
        
        <!-- 视图切换按钮 -->
        <div v-if="hasDiffContent(replaceResult.file)" class="view-toggle">
          <button
            :class="['toggle-btn', { active: getViewMode(replaceResult.file) === 'matches' }]"
            @click="viewModes.set(replaceResult.file, 'matches')"
          >
            <span class="codicon codicon-list-flat"></span>
            {{ t('components.tools.search.searchInFilesPanel.viewMatches') }}
          </button>
          <button
            :class="['toggle-btn', { active: getViewMode(replaceResult.file) === 'diff' }]"
            @click="viewModes.set(replaceResult.file, 'diff')"
          >
            <span class="codicon codicon-diff"></span>
            {{ t('components.tools.search.searchInFilesPanel.viewDiff') }}
          </button>
        </div>
        
        <!-- 加载中 -->
        <div v-if="isLoadingDiff(replaceResult.file)" class="loading-diff">
          <span class="codicon codicon-loading codicon-modifier-spin"></span>
          {{ t('components.tools.search.searchInFilesPanel.loadingDiff') }}
        </div>
        
        <!-- Diff 视图 -->
        <div v-else-if="hasDiffContent(replaceResult.file) && getViewMode(replaceResult.file) === 'diff'" class="diff-view">
          <div class="diff-stats-bar">
            <span class="stat deleted">
              <span class="codicon codicon-remove"></span>
              {{ getDiffStats(computeDiffLines(getDiffContent(replaceResult.file)!.originalContent, getDiffContent(replaceResult.file)!.newContent)).deleted }}
            </span>
            <span class="stat added">
              <span class="codicon codicon-add"></span>
              {{ getDiffStats(computeDiffLines(getDiffContent(replaceResult.file)!.originalContent, getDiffContent(replaceResult.file)!.newContent)).added }}
            </span>
          </div>
          <CustomScrollbar :horizontal="true" :max-height="300">
            <div class="diff-lines">
              <div
                v-for="(line, lineIndex) in getDisplayDiffLines(computeDiffLines(getDiffContent(replaceResult.file)!.originalContent, getDiffContent(replaceResult.file)!.newContent), replaceResult.file)"
                :key="lineIndex"
                :class="['diff-line', `line-${line.type}`]"
              >
                <span class="line-nums">
                  <span class="old-num">{{ formatLineNum(line.oldLineNum, getDiffLineNumWidth(getDiffContent(replaceResult.file)!)) }}</span>
                  <span class="new-num">{{ formatLineNum(line.newLineNum, getDiffLineNumWidth(getDiffContent(replaceResult.file)!)) }}</span>
                </span>
                <span class="line-marker">
                  <span v-if="line.type === 'deleted'" class="marker deleted">-</span>
                  <span v-else-if="line.type === 'added'" class="marker added">+</span>
                  <span v-else class="marker unchanged">&nbsp;</span>
                </span>
                <span class="line-content">{{ line.content || ' ' }}</span>
              </div>
            </div>
          </CustomScrollbar>
          
          <!-- 展开/收起按钮 -->
          <div v-if="needsDiffExpand(computeDiffLines(getDiffContent(replaceResult.file)!.originalContent, getDiffContent(replaceResult.file)!.newContent))" class="expand-section">
            <button class="expand-btn" @click="toggleDiffExpand(replaceResult.file)">
              <span :class="['codicon', isDiffExpanded(replaceResult.file) ? 'codicon-chevron-up' : 'codicon-chevron-down']"></span>
              {{ isDiffExpanded(replaceResult.file) ? t('components.tools.search.searchInFilesPanel.collapse') : t('components.tools.search.searchInFilesPanel.expandRemaining', { count: computeDiffLines(getDiffContent(replaceResult.file)!.originalContent, getDiffContent(replaceResult.file)!.newContent).length - previewDiffLineCount }) }}
            </button>
          </div>
        </div>
        
        <!-- 匹配列表视图 -->
        <div v-else class="matches-view">
          <CustomScrollbar :max-height="200">
            <div class="match-items">
              <div
                v-for="(match, index) in searchResults.filter(m => m.file === replaceResult.file)"
                :key="`${match.line}-${index}`"
                class="match-item-compact"
              >
                <span class="line-info">:{{ match.line }}:{{ match.column }}</span>
                <code class="match-text">{{ match.match }}</code>
              </div>
            </div>
          </CustomScrollbar>
        </div>
      </div>
    </div>
    
    <!-- 仅搜索模式：结果列表 -->
    <div v-else class="results-list">
      <CustomScrollbar :max-height="300">
        <div class="match-items">
          <div
            v-for="(match, index) in displayResults"
            :key="`${match?.file || ''}-${match?.line || 0}-${index}`"
            class="match-item"
          >
            <div class="match-header">
              <span class="codicon codicon-file file-icon"></span>
              <span class="file-name">{{ getFileName(match?.file) }}</span>
              <span class="file-path">{{ match?.file || '' }}</span>
              <span class="line-info">:{{ match?.line || 0 }}:{{ match?.column || 0 }}</span>
            </div>
            <div class="match-context">
              <pre><code v-html="highlightMatch(match?.context, match?.match)"></code></pre>
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

<style scoped src="./search_in_files.css"></style>
