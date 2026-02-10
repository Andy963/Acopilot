<script setup lang="ts">
import CustomScrollbar from '../../common/CustomScrollbar.vue'
import { useI18n } from '@/composables'
import {
  computeDiffLines,
  computeFailedPreviewLines,
  formatLineNum,
  getDiffStats,
  getLineNumWidth
} from './applyDiffDiff'
import { useApplyDiffPanel } from './useApplyDiffPanel'

const props = defineProps<{
  args: Record<string, unknown>
  result?: Record<string, unknown>
  error?: string
}>()

const { t } = useI18n()

const {
  filePath,
  gitStatus,
  gitLoading,
  handleSaveCurrentFile,
  handleStageCurrentFile,
  handleUnstageCurrentFile,
  resultData,
  isFailed,
  isPartial,
  diffList,
  isHunkLoading,
  isHunkApplied,
  undoHunk,
  applyHunk,
  isCopied,
  copyReplace,
  getHunkError,
  getDisplayLines,
  needsExpand,
  toggleExpand,
  isExpanded,
  previewLineCount
} = useApplyDiffPanel(props, { t })
</script>

<template>
  <div class="apply-diff-panel">
    <!-- 文件路径 -->
    <div class="file-path-bar">
      <span class="codicon codicon-file-code"></span>
      <span class="path">{{ filePath }}</span>
      <span v-if="gitStatus" class="git-status" :title="gitStatus.xy">
        <span class="codicon codicon-source-control"></span>
        <code>{{ gitStatus.xy }}</code>
      </span>
      <div class="git-actions">
        <button
          class="action-btn"
          :disabled="gitLoading"
          :title="t('common.save')"
          @click.stop="handleSaveCurrentFile"
        >
          <span class="codicon codicon-save"></span>
        </button>
        <button
          v-if="gitStatus && (gitStatus.untracked || gitStatus.unstaged)"
          class="action-btn"
          :disabled="gitLoading"
          :title="t('common.stage')"
          @click.stop="handleStageCurrentFile"
        >
          <span class="codicon codicon-git-branch-staged-changes"></span>
        </button>
        <button
          v-if="gitStatus && gitStatus.staged"
          class="action-btn"
          :disabled="gitLoading"
          :title="t('common.unstage')"
          @click.stop="handleUnstageCurrentFile"
        >
          <span class="codicon codicon-git-branch-changes"></span>
        </button>
      </div>
    </div>
    
    <!-- 结果状态 -->
    <div v-if="resultData" class="result-status" :class="{ 'is-error': isFailed && !isPartial, 'is-partial': isPartial }">
      <span v-if="!isFailed && !isPartial" class="codicon codicon-check status-icon success"></span>
      <span v-else-if="isPartial" class="codicon codicon-check status-icon partial"></span>
      <span v-else class="codicon codicon-error status-icon error"></span>
      <span class="status-text">
        <template v-if="error">{{ error }}</template>
        <template v-else-if="resultData.message">{{ resultData.message }}</template>
        <template v-else-if="isPartial">{{ t('components.tools.file.applyDiffPanel.diffApplied') }} ({{ resultData.appliedCount }}/{{ resultData.totalCount }})</template>
        <template v-else-if="isFailed">{{ t('common.failed') }}</template>
        <template v-else>{{ t('components.tools.file.applyDiffPanel.diffApplied') }}</template>
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
        :class="{ 'is-failed': diff.success === false }"
      >
        <!-- Diff 头部 -->
        <div class="diff-header" :class="{ 'is-failed': diff.success === false }">
          <div class="diff-info">
            <span class="diff-number">{{ t('components.tools.file.applyDiffPanel.diffNumber') }}{{ index + 1 }}</span>
            
            <!-- 状态图标 -->
            <span v-if="diff.success === true" class="status-icon success" :title="t('common.success')">
              <span class="codicon codicon-check"></span>
            </span>
            <span v-else-if="diff.success === false" class="status-icon error" :title="diff.error || t('common.failed')">
              <span class="codicon codicon-error"></span>
              <span class="error-msg">{{ diff.error || t('common.failed') }}</span>
            </span>

            <span v-if="diff.start_line" class="start-line">
              <span class="codicon codicon-location"></span>
              {{ t('components.tools.file.applyDiffPanel.line') }} {{ diff.start_line }}
            </span>
            <!-- 统计信息 -->
            <span v-if="diff.success !== false" class="diff-stats">
              <span class="stat deleted">
                <span class="codicon codicon-remove"></span>
                {{ getDiffStats(computeDiffLines(diff.search, diff.replace, diff.start_line || 1)).deleted }}
              </span>
              <span class="stat added">
                <span class="codicon codicon-add"></span>
                {{ getDiffStats(computeDiffLines(diff.search, diff.replace, diff.start_line || 1)).added }}
              </span>
            </span>
          </div>
          <div class="diff-actions">
            <button
              class="action-btn"
              :disabled="isHunkLoading(index)"
              :title="isHunkApplied(index) ? t('common.undo') : t('common.apply')"
              @click.stop="isHunkApplied(index) ? undoHunk(diff, index) : applyHunk(diff, index)"
            >
              <span
                :class="[
                  'codicon',
                  isHunkLoading(index)
                    ? 'codicon-loading codicon-modifier-spin'
                    : (isHunkApplied(index) ? 'codicon-discard' : 'codicon-diff-added')
                ]"
              ></span>
            </button>
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

        <div v-if="getHunkError(index)" class="diff-op-error">
          <span class="codicon codicon-warning"></span>
          <span class="diff-op-error-text">{{ getHunkError(index) }}</span>
        </div>
        
        <!-- Diff 内容 -->
        <div class="diff-content" v-if="diff.success !== false">
          <CustomScrollbar :horizontal="true" :max-height="300">
            <div class="diff-lines">
              <div
                v-for="(line, lineIndex) in getDisplayLines(computeDiffLines(diff.search, diff.replace, diff.start_line || 1), index)"
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
          <div v-if="needsExpand(computeDiffLines(diff.search, diff.replace, diff.start_line || 1))" class="expand-section">
            <button class="expand-btn" @click="toggleExpand(index)">
              <span :class="['codicon', isExpanded(index) ? 'codicon-chevron-up' : 'codicon-chevron-down']"></span>
              {{ isExpanded(index) ? t('components.tools.file.applyDiffPanel.collapse') : t('components.tools.file.applyDiffPanel.expandRemaining', { count: computeDiffLines(diff.search, diff.replace, diff.start_line || 1).length - previewLineCount }) }}
            </button>
          </div>
        </div>

        <!-- 失败时的内容预览 -->
        <div v-if="diff.success === false" class="diff-content diff-content-failed">
          <CustomScrollbar :horizontal="true" :max-height="150">
            <div class="diff-lines">
              <div
                v-for="(line, lineIndex) in getDisplayLines(computeFailedPreviewLines(diff.search, diff.start_line || 1), index)"
                :key="lineIndex"
                :class="['diff-line', `line-${line.type}`]"
              >
                <span class="line-nums">
                  <span class="old-num">{{ formatLineNum(line.oldLineNum, getLineNumWidth(diff)) }}</span>
                  <span class="new-num">{{ formatLineNum(line.newLineNum, getLineNumWidth(diff)) }}</span>
                </span>
                <span class="line-marker">
                  <span class="marker deleted">-</span>
                </span>
                <span class="line-content">{{ line.content || ' ' }}</span>
              </div>
            </div>
          </CustomScrollbar>

          <div v-if="needsExpand(computeFailedPreviewLines(diff.search, diff.start_line || 1))" class="expand-section">
            <button class="expand-btn" @click="toggleExpand(index)">
              <span :class="['codicon', isExpanded(index) ? 'codicon-chevron-up' : 'codicon-chevron-down']"></span>
              {{ isExpanded(index) ? t('components.tools.file.applyDiffPanel.collapse') : t('components.tools.file.applyDiffPanel.expandRemaining', { count: computeFailedPreviewLines(diff.search, diff.start_line || 1).length - previewLineCount }) }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="./apply_diff.css"></style>
