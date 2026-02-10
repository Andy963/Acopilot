<script setup lang="ts">
import CustomScrollbar from '../../common/CustomScrollbar.vue'
import { useI18n } from '@/composables'
import { computeDiffLines, formatLineNum, getDiffLineNumWidth, getDiffStats } from '../terminal/executeCommandDiff'
import { useWriteFilePanel } from './useWriteFilePanel'
import { getContentLines, getFileDir, getFileExtension, getFileNameWithoutExt } from './writeFileUtils'

const props = defineProps<{
  args: Record<string, unknown>
  result?: Record<string, unknown>
  error?: string
}>()

const { t } = useI18n()

const {
  mergedFiles,
  viewModes,
  successCount,
  failCount,
  isFileApplied,
  canApplyFile,
  canUndoFile,
  isFileBusy,
  getFileOpError,
  getGitStatus,
  isGitLoading,
  handleApplyFile,
  handleUndoFile,
  handleSaveFile,
  handleStageFile,
  handleUnstageFile,
  getViewMode,
  hasDiffContent,
  getDiffContent,
  isLoadingDiff,
  getDisplayContent,
  needsExpand,
  toggleFile,
  isFileExpanded,
  isCopied,
  copyFileContent,
  getActionIcon,
  getActionLabel,
  needsDiffExpand,
  getDisplayDiffLines,
  toggleDiffExpand,
  isDiffExpanded,
  previewLineCount,
  previewDiffLineCount
} = useWriteFilePanel(props, { t })
</script>

<template>
  <div class="write-file-panel">
    <!-- 总体统计 -->
    <div class="panel-header">
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
            <span v-if="getContentLines(file.content).length" class="line-count">
              {{ t('components.tools.file.writeFilePanel.lines', { count: getContentLines(file.content).length }) }}
            </span>
          </div>
          <div class="file-actions">
            <button
              v-if="file.content && (canApplyFile(file) || canUndoFile(file))"
              class="action-btn"
              :disabled="isFileBusy(file.path) || (isFileApplied(file.path) ? !canUndoFile(file) : !canApplyFile(file))"
              :title="isFileApplied(file.path) ? t('common.undo') : t('common.apply')"
              @click.stop="isFileApplied(file.path) ? handleUndoFile(file) : handleApplyFile(file)"
            >
              <span
                :class="[
                  'codicon',
                  isFileBusy(file.path)
                    ? 'codicon-loading codicon-modifier-spin'
                    : (isFileApplied(file.path) ? 'codicon-discard' : 'codicon-diff-added')
                ]"
              ></span>
            </button>
            <button
              class="action-btn"
              :disabled="isFileBusy(file.path)"
              :title="t('common.save')"
              @click.stop="handleSaveFile(file)"
            >
              <span class="codicon codicon-save"></span>
            </button>
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
        <div class="file-path">
          <span class="path" :title="file.path">{{ getFileDir(file.path) }}</span>
          <span v-if="getGitStatus(file.path)" class="git-status" :title="getGitStatus(file.path)!.xy">
            <span class="codicon codicon-source-control"></span>
            <code>{{ getGitStatus(file.path)!.xy }}</code>
          </span>
          <div v-if="getGitStatus(file.path)" class="git-actions">
            <button
              v-if="getGitStatus(file.path)!.untracked || getGitStatus(file.path)!.unstaged"
              class="action-btn"
              :disabled="isGitLoading(file.path)"
              :title="t('common.stage')"
              @click.stop="handleStageFile(file.path)"
            >
              <span class="codicon codicon-git-branch-staged-changes"></span>
            </button>
            <button
              v-if="getGitStatus(file.path)!.staged"
              class="action-btn"
              :disabled="isGitLoading(file.path)"
              :title="t('common.unstage')"
              @click.stop="handleUnstageFile(file.path)"
            >
              <span class="codicon codicon-git-branch-changes"></span>
            </button>
          </div>
        </div>
        
        <!-- 错误信息 -->
        <div v-if="file.result && !file.result.success && file.result.error" class="file-error">
          {{ file.result.error }}
        </div>

        <div v-if="getFileOpError(file.path)" class="file-op-error">
          <span class="codicon codicon-warning"></span>
          <span class="file-op-error-text">{{ getFileOpError(file.path) }}</span>
        </div>
        
        <!-- 视图切换按钮 -->
        <div v-if="hasDiffContent(file.path)" class="view-toggle">
          <button
            :class="['toggle-btn', { active: getViewMode(file.path) === 'content' }]"
            @click="viewModes.set(file.path, 'content')"
          >
            <span class="codicon codicon-file-code"></span>
            {{ t('components.tools.file.writeFilePanel.viewContent') }}
          </button>
          <button
            :class="['toggle-btn', { active: getViewMode(file.path) === 'diff' }]"
            @click="viewModes.set(file.path, 'diff')"
          >
            <span class="codicon codicon-diff"></span>
            {{ t('components.tools.file.writeFilePanel.viewDiff') }}
          </button>
        </div>
        
        <!-- 加载中 -->
        <div v-if="isLoadingDiff(file.path)" class="loading-diff">
          <span class="codicon codicon-loading codicon-modifier-spin"></span>
          {{ t('components.tools.file.writeFilePanel.loadingDiff') }}
        </div>
        
        <!-- Diff 视图 -->
        <div v-else-if="hasDiffContent(file.path) && getViewMode(file.path) === 'diff'" class="diff-view">
          <div class="diff-stats-bar">
            <span class="stat deleted">
              <span class="codicon codicon-remove"></span>
              {{ getDiffStats(computeDiffLines(getDiffContent(file.path)!.originalContent, getDiffContent(file.path)!.newContent)).deleted }}
            </span>
            <span class="stat added">
              <span class="codicon codicon-add"></span>
              {{ getDiffStats(computeDiffLines(getDiffContent(file.path)!.originalContent, getDiffContent(file.path)!.newContent)).added }}
            </span>
          </div>
          <CustomScrollbar :horizontal="true" :max-height="300">
            <div class="diff-lines">
              <div
                v-for="(line, lineIndex) in getDisplayDiffLines(computeDiffLines(getDiffContent(file.path)!.originalContent, getDiffContent(file.path)!.newContent), file.path)"
                :key="lineIndex"
                :class="['diff-line', `line-${line.type}`]"
              >
                <span class="line-nums">
                  <span class="old-num">{{ formatLineNum(line.oldLineNum, getDiffLineNumWidth(getDiffContent(file.path)!)) }}</span>
                  <span class="new-num">{{ formatLineNum(line.newLineNum, getDiffLineNumWidth(getDiffContent(file.path)!)) }}</span>
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
          <div v-if="needsDiffExpand(computeDiffLines(getDiffContent(file.path)!.originalContent, getDiffContent(file.path)!.newContent))" class="expand-section">
            <button class="expand-btn" @click="toggleDiffExpand(file.path)">
              <span :class="['codicon', isDiffExpanded(file.path) ? 'codicon-chevron-up' : 'codicon-chevron-down']"></span>
              {{ isDiffExpanded(file.path) ? t('components.tools.file.writeFilePanel.collapse') : t('components.tools.file.writeFilePanel.expandRemaining', { count: computeDiffLines(getDiffContent(file.path)!.originalContent, getDiffContent(file.path)!.newContent).length - previewDiffLineCount }) }}
            </button>
          </div>
        </div>
        
        <!-- 原内容视图 -->
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

<style scoped src="./write_file.css"></style>
