<script setup lang="ts">
import CustomScrollbar from '../../common/CustomScrollbar.vue'
import { useI18n } from '../../../composables/useI18n'
import { formatLineNum, getDiffLineNumWidth } from './executeCommandDiff'
import { formatDuration } from './executeCommandDiagnostics'
import { useExecuteCommandPanel } from './useExecuteCommandPanel'

const { t } = useI18n()

const props = defineProps<{
  args: Record<string, unknown>
  result?: Record<string, unknown>
  error?: string
  status?: 'pending' | 'running' | 'success' | 'error' | 'warning'
  toolId?: string
  embedded?: boolean
}>()

const emit = defineEmits<{
  (e: 'update-result', result: Record<string, unknown>): void
}>()

const {
  isEmbedded,
  killing,
  outputScrollRef,
  command,
  resultData,
  output,
  duration,
  truncated,
  totalLines,
  outputLines,
  isRunning,
  statusLabel,
  statusClass,
  statusIcon,
  commandTooltip,
  expanded,
  toggleExpanded,
  handleKillTerminal,
  canOpenFirstError,
  opening,
  openFirstErrorTitle,
  openFirstError,
  showEmbeddedActions,
  hasChangeSection,
  toggleChangesExpanded,
  changesExpanded,
  changeCount,
  changeHeaderMeta,
  changesSummary,
  changedFiles,
  showHeaderChangesPreview,
  headerPreviewFiles,
  headerMoreCount,
  handleHeaderChangeClick,
  getPathBasename,
  getActionIcon,
  getActionLabel,
  getDiffStatsForFile,
  toggleFileDiff,
  isDiffExpanded,
  openFileDiffInVSCode,
  openChangedFile,
  isLoadingDiff,
  getDiffError,
  getDiffContent,
  getDiffLines,
  getDisplayDiffLines,
  needsDiffExpand,
  toggleDiffExpand,
  isDiffFullyExpanded,
  previewDiffLineCount,
  hasNextSuggestions,
  nextCommandSuggestions,
  copiedSuggestion,
  copySuggestionCommand
} = useExecuteCommandPanel(props, emit, { t })
</script>

<template>
  <div class="execute-command-panel" :class="[statusClass, { running: isRunning, expanded, embedded: isEmbedded }]">
    <!-- 头部信息栏 -->
    <div
      v-if="!isEmbedded"
      class="panel-header"
      role="button"
      tabindex="0"
      :title="commandTooltip"
      @click="toggleExpanded"
      @keydown.enter.prevent="toggleExpanded"
      @keydown.space.prevent="toggleExpanded"
    >
      <span
        class="status-icon codicon"
        :class="[statusIcon, statusClass, { 'codicon-modifier-spin': isRunning }]"
        :title="statusLabel"
      ></span>
      <span class="prompt">$</span>
      <code class="command-text" :title="commandTooltip">{{ command }}</code>

      <span
        v-if="truncated && !isRunning"
        class="truncated-indicator codicon codicon-warning"
        :title="t('components.tools.terminal.executeCommandPanel.truncatedInfo', { outputLines, totalLines })"
      ></span>

      <span v-if="duration !== undefined" class="duration">
        {{ formatDuration(duration) }}
      </span>

      <div
        v-if="showHeaderChangesPreview"
        class="changes-preview-header"
        @click.stop
      >
        <i
          class="codicon codicon-diff"
          :title="t('components.tools.terminal.executeCommandPanel.fileChanges.title')"
        ></i>

        <button
          v-for="f in headerPreviewFiles"
          :key="f.path"
          class="change-chip"
          :class="{ disabled: !f.diffContentId }"
          :title="f.diffContentId ? `${t('components.tools.terminal.executeCommandPanel.fileChanges.viewInVSCode')}: ${f.path}` : (f.skippedReason ? String(f.skippedReason) : t('components.tools.terminal.executeCommandPanel.fileChanges.diffUnavailable'))"
          @click.stop="handleHeaderChangeClick(f)"
        >
          {{ getPathBasename(f.path) }}
        </button>

        <button
          v-if="headerMoreCount > 0"
          class="change-chip more"
          :title="t('common.expand')"
          @click.stop="toggleExpanded"
        >
          +{{ headerMoreCount }}
        </button>
      </div>

      <div class="header-actions" @click.stop>
        <button
          v-if="isRunning"
          class="icon-btn danger"
          :disabled="killing"
          :title="t('components.tools.terminal.executeCommandPanel.terminateTooltip')"
          @click.stop="handleKillTerminal"
        >
          <span class="codicon codicon-debug-stop"></span>
        </button>

        <button
          v-if="canOpenFirstError"
          class="icon-btn"
          :disabled="opening"
          :title="openFirstErrorTitle"
          @click.stop="openFirstError"
        >
          <span class="codicon codicon-go-to-file"></span>
        </button>

        <!-- 交互操作已精简：点击整行即可展开/收起 -->
      </div>
    </div>

    <!-- 终端输出块 -->
    <div v-if="expanded || isEmbedded" class="panel-body">
      <div v-if="showEmbeddedActions" class="embedded-actions" @click.stop>
        <span
          v-if="truncated && !isRunning"
          class="embedded-truncated codicon codicon-warning"
          :title="t('components.tools.terminal.executeCommandPanel.truncatedInfo', { outputLines, totalLines })"
        ></span>

        <button
          v-if="isRunning"
          class="icon-btn danger"
          :disabled="killing"
          :title="t('components.tools.terminal.executeCommandPanel.terminateTooltip')"
          @click.stop="handleKillTerminal"
        >
          <span class="codicon codicon-debug-stop"></span>
        </button>

        <button
          v-if="canOpenFirstError"
          class="icon-btn"
          :disabled="opening"
          :title="openFirstErrorTitle"
          @click.stop="openFirstError"
        >
          <span class="codicon codicon-go-to-file"></span>
        </button>

      </div>

      <div v-if="hasChangeSection" class="changes-card">
        <div class="changes-header" @click="toggleChangesExpanded">
          <i class="codicon" :class="changesExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'"></i>
          <i class="codicon codicon-diff"></i>
          <span class="changes-title">{{ t('components.tools.terminal.executeCommandPanel.fileChanges.title') }}</span>
          <span v-if="changeCount > 0" class="changes-count">({{ changeCount }})</span>
          <span v-if="changeHeaderMeta" class="changes-meta">{{ changeHeaderMeta }}</span>
        </div>

        <div v-if="changesExpanded" class="changes-body">
          <div v-if="changesSummary?.unsupportedReason" class="changes-empty warning">
            <i class="codicon codicon-info"></i>
            <span>{{ t('components.tools.terminal.executeCommandPanel.fileChanges.notSupported') }}</span>
          </div>

          <div v-else-if="changedFiles.length === 0" class="changes-empty">
            <i class="codicon codicon-check"></i>
            <span>{{ t('components.tools.terminal.executeCommandPanel.fileChanges.noChanges') }}</span>
          </div>

          <div v-else class="changes-list">
            <div v-for="f in changedFiles" :key="f.path" class="change-item">
              <div class="change-row">
                <i class="codicon change-icon" :class="getActionIcon(f.action)"></i>
                <code class="change-path" :title="f.fromPath ? `${f.fromPath} → ${f.path}` : f.path">
                  {{ f.fromPath ? `${f.fromPath} → ${f.path}` : f.path }}
                </code>
                <span class="change-action" :class="`action-${f.action}`">{{ getActionLabel(f.action) }}</span>

                <span v-if="getDiffStatsForFile(f.path)" class="change-stats">
                  +{{ getDiffStatsForFile(f.path)!.added }} / -{{ getDiffStatsForFile(f.path)!.deleted }}
                </span>
                <span v-else-if="f.diffContentId" class="change-stats placeholder">+— / -—</span>

                <span v-if="f.skippedReason" class="change-skipped" :title="String(f.skippedReason)">
                  {{ t('components.tools.terminal.executeCommandPanel.fileChanges.diffUnavailable') }}
                </span>

                <div class="change-actions" @click.stop>
                  <button
                    class="small-btn"
                    :disabled="!f.diffContentId"
                    :title="f.diffContentId ? t('components.tools.terminal.executeCommandPanel.fileChanges.expandDiff') : (f.skippedReason || t('components.tools.terminal.executeCommandPanel.fileChanges.diffUnavailable'))"
                    @click.stop="toggleFileDiff(f)"
                  >
                    <i class="codicon" :class="isDiffExpanded(f.path) ? 'codicon-chevron-up' : 'codicon-chevron-down'"></i>
                    <span class="btn-text">{{ t('components.tools.terminal.executeCommandPanel.fileChanges.expandDiff') }}</span>
                  </button>
                  <button
                    class="small-btn compact"
                    :disabled="!f.diffContentId"
                    :title="t('components.tools.terminal.executeCommandPanel.fileChanges.viewInVSCode')"
                    @click.stop="openFileDiffInVSCode(f)"
                  >
                    <i class="codicon codicon-open-preview"></i>
                    <span class="btn-text">{{ t('components.tools.terminal.executeCommandPanel.fileChanges.viewInVSCode') }}</span>
                  </button>
                  <button class="small-btn" @click.stop="openChangedFile(f)">
                    <i class="codicon codicon-go-to-file"></i>
                    <span class="btn-text">{{ t('components.tools.terminal.executeCommandPanel.fileChanges.openFile') }}</span>
                  </button>
                </div>
              </div>

              <div v-if="isDiffExpanded(f.path)" class="change-diff">
                <div v-if="isLoadingDiff(f.path)" class="diff-loading">
                  <i class="codicon codicon-loading codicon-modifier-spin"></i>
                  <span>{{ t('components.tools.terminal.executeCommandPanel.fileChanges.loadingDiff') }}</span>
                </div>

                <div v-else-if="getDiffError(f.path)" class="diff-loading error">
                  <i class="codicon codicon-error"></i>
                  <span>{{ getDiffError(f.path) }}</span>
                </div>

                <div v-else-if="getDiffContent(f.path)" class="diff-view">
                  <CustomScrollbar :horizontal="true" :max-height="260">
                    <div class="diff-lines">
                      <div
                        v-for="(line, idx) in getDisplayDiffLines(getDiffLines(f.path) || [], f.path)"
                        :key="idx"
                        :class="['diff-line', `line-${line.type}`]"
                      >
                        <span class="line-nums">
                          <span class="old-num">{{ formatLineNum(line.oldLineNum, getDiffLineNumWidth(getDiffContent(f.path)!)) }}</span>
                          <span class="new-num">{{ formatLineNum(line.newLineNum, getDiffLineNumWidth(getDiffContent(f.path)!)) }}</span>
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

                  <div
                    v-if="needsDiffExpand(getDiffLines(f.path) || [])"
                    class="expand-section"
                  >
                    <button class="expand-btn" @click.stop="toggleDiffExpand(f.path)">
                      <i class="codicon" :class="isDiffFullyExpanded(f.path) ? 'codicon-chevron-up' : 'codicon-chevron-down'"></i>
                      {{
                        isDiffFullyExpanded(f.path)
                          ? t('common.collapse')
                          : t('components.tools.terminal.executeCommandPanel.fileChanges.expandRemaining', {
                              count: (getDiffLines(f.path) || []).length - previewDiffLineCount
                            })
                      }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="hasNextSuggestions" class="next-commands">
        <div class="next-commands-title">
          <i class="codicon codicon-lightbulb"></i>
          <span>{{ t('components.tools.terminal.executeCommandPanel.nextCommandsTitle') }}</span>
        </div>
        <div class="next-commands-list">
          <div v-for="c in nextCommandSuggestions" :key="c" class="next-command-row">
            <code class="next-command-code">{{ c }}</code>
            <button
              class="icon-btn"
              :class="{ success: copiedSuggestion === c }"
              :title="copiedSuggestion === c ? t('common.copied') : t('common.copy')"
              @click.stop="copySuggestionCommand(c)"
            >
              <span :class="['codicon', copiedSuggestion === c ? 'codicon-check' : 'codicon-copy']"></span>
            </button>
          </div>
        </div>
      </div>

      <!-- 注意：即使命令失败（exitCode != 0），也应展示 stdout/stderr，便于用户排查 -->
      <div v-if="error || resultData.error" class="output-content error">
        <pre class="output-code"><code>{{ error || resultData.error }}</code></pre>
      </div>

      <div v-if="output || isRunning" class="output-content">
        <CustomScrollbar
          ref="outputScrollRef"
          :horizontal="true"
          :max-height="300"
          :sticky-bottom="isRunning"
        >
          <pre class="output-code"><code>{{ output || t('components.tools.terminal.executeCommandPanel.waitingOutput') }}</code></pre>
        </CustomScrollbar>
      </div>

      <div v-else class="output-empty">
        <span class="codicon codicon-info"></span>
        <span>{{ t('components.tools.terminal.executeCommandPanel.noOutput') }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped src="./execute_command.part1.css"></style>
<style scoped src="./execute_command.part2.css"></style>
