<script setup lang="ts">
import { computed } from 'vue'
import type { ToolUsage } from '../../types'
import { useI18n } from '../../i18n'
import { IconButton } from '../common'
import { useToolMessage } from './useToolMessage'
import {
  getExecuteCommandArgs,
  getReadFileSingleContent,
  getReadFileSingleDisplayName,
  getReadFileSingleLineCount,
  getReadFileSinglePath,
  getToolIcon,
  getToolLabel,
  toolClassName
} from './toolMessageUtils'

const props = defineProps<{
  tools: ToolUsage[]
  embedded?: boolean
}>()

const { t } = useI18n()

const {
  displayTools,
  confirmToolExecution,
  rejectToolExecution,
  getToolDecision,
  hasUserDecision,
  toggleExpand,
  isExpanded,
  isExpandable,
  hasActionButtons,
  isReadFileCopied,
  copyReadFileSingleContent,
  canUndoApplyDiff,
  undoApplyDiffTool,
  undoingApplyDiffToolId,
  isDiffReviewTool,
  acceptingDiffToolId,
  acceptPendingDiff,
  hasDiffPreview,
  getDiffFilePaths,
  openDiffPreview,
  getStatusIcon,
  getStatusClass,
  renderToolContent
} = useToolMessage(computed(() => props.tools), { t })
</script>

<template>
  <div class="tool-message" :class="{ embedded: !!props.embedded }">
    <div
      v-for="tool in displayTools"
      :key="tool.id"
      :class="['tool-item', toolClassName(tool.name)]"
    >
      <!-- 工具头部 - 可点击展开/收起（如果可展开） -->
      <div
        :class="['tool-header', { 'not-expandable': !isExpandable(tool) }]"
        @click="isExpandable(tool) && toggleExpand(tool.id)"
      >
        <div class="tool-info">
          <!-- 展开/收起图标（仅当可展开时显示） -->
          <span
            v-if="isExpandable(tool)"
            :class="[
              'expand-icon',
              'codicon',
              isExpanded(tool.id) ? 'codicon-chevron-down' : 'codicon-chevron-right'
            ]"
          ></span>

          <!-- 状态图标（放到工具名称之前，更接近 Copilot Chat 的视觉顺序） -->
          <div
            v-if="tool.status || tool.awaitingConfirmation"
            class="status-icon-wrapper"
          >
            <span
              :class="[
                'status-icon',
                'codicon',
                getStatusIcon(tool.status, tool.awaitingConfirmation),
                getStatusClass(tool.status, tool.awaitingConfirmation)
              ]"
            ></span>
          </div>
          
          <!-- 工具图标 -->
          <span :class="['tool-icon', 'codicon', getToolIcon(tool)]"></span>
          
          <!-- 工具名称 -->
	          <span class="tool-name">{{ getToolLabel(tool) }}</span>

            <!-- read_file: 单文件时把文件名内联到同一行，减少垂直空间 -->
            <span
              v-if="tool.name === 'read_file' && getReadFileSingleDisplayName(tool)"
              class="tool-readfile-target"
              :title="getReadFileSinglePath(tool) || undefined"
            >
              {{ getReadFileSingleDisplayName(tool) }}
            </span>

	          <!-- execute_command: 显示执行目录（同一行，不单独占一行） -->
	          <span
	            v-if="tool.name === 'execute_command' && getExecuteCommandArgs(tool).cwd"
	            class="tool-cwd"
	            :title="getExecuteCommandArgs(tool).cwd"
	          >
	            · 目录: {{ getExecuteCommandArgs(tool).cwd }}
	          </span>
	          
	          <!-- 执行时间 -->
	          <div class="tool-meta">
            <div v-if="tool.name === 'read_file' && tool.readFileHeaderStats?.total" class="tool-stats">
              <span
                v-if="(tool.readFileHeaderStats?.fail ?? 0) > 0 && (tool.readFileHeaderStats?.success ?? 0) > 0"
                class="tool-stat stat-success"
              >
                <span class="codicon codicon-check"></span>
                {{ tool.readFileHeaderStats?.success }}
              </span>
              <span
                v-if="(tool.readFileHeaderStats?.fail ?? 0) > 0"
                class="tool-stat stat-error"
              >
                <span class="codicon codicon-error"></span>
                {{ tool.readFileHeaderStats?.fail }}
              </span>
              <span class="tool-stat stat-total">
                {{ t('components.tools.file.readFilePanel.total', { count: tool.readFileHeaderStats?.total }) }}
              </span>
            </div>

            <!-- read_file: 单文件时把“复制内容”动作也放到头部，配合 compact 渲染减少一行 -->
            <button
              v-if="tool.name === 'read_file' && tool.readFileHeaderStats?.total === 1 && getReadFileSingleContent(tool)"
              class="tool-inline-action"
              :class="{ copied: isReadFileCopied(tool.id) }"
              :title="isReadFileCopied(tool.id) ? t('components.tools.file.readFilePanel.copied') : t('components.tools.file.readFilePanel.copyContent')"
              @click.stop="copyReadFileSingleContent(tool)"
            >
              <span :class="['codicon', isReadFileCopied(tool.id) ? 'codicon-check' : 'codicon-copy']"></span>
            </button>

            <span
              v-if="tool.name === 'read_file' && tool.readFileHeaderStats?.total === 1 && getReadFileSingleLineCount(tool)"
              class="tool-duration"
            >
              {{ t('components.tools.file.readFilePanel.lines', { count: getReadFileSingleLineCount(tool) }) }}
            </span>

            <span v-if="tool.duration" class="tool-duration">
              {{ tool.duration }}ms
            </span>

            <div
              v-if="tool.name === 'execute_command' && tool.awaitingConfirmation"
              class="tool-header-actions"
              @click.stop
            >
              <!-- 确认按钮：当工具等待确认且未做决定时显示 -->
              <button
                v-if="!hasUserDecision(tool.id)"
                class="confirm-btn"
                :title="t('components.message.tool.confirmExecution')"
                @click.stop="confirmToolExecution(tool.id, tool.name)"
              >
                <span class="confirm-btn-icon codicon codicon-check"></span>
                <span class="confirm-btn-text">{{ t('components.message.tool.confirm') }}</span>
              </button>

              <!-- 拒绝按钮：当工具等待确认且未做决定时显示 -->
              <button
                v-if="!hasUserDecision(tool.id)"
                class="reject-btn"
                :title="t('components.message.tool.reject')"
                @click.stop="rejectToolExecution(tool.id, tool.name)"
              >
                <span class="reject-btn-icon codicon codicon-close"></span>
                <span class="reject-btn-text">{{ t('components.message.tool.reject') }}</span>
              </button>

              <!-- 已确认标记 -->
              <span
                v-if="getToolDecision(tool.id) === true"
                class="decision-badge decision-confirmed"
                :title="t('components.message.tool.confirmed')"
                @click.stop="confirmToolExecution(tool.id, tool.name)"
              >
                <span class="codicon codicon-check"></span>
                <span class="decision-text">{{ t('components.message.tool.confirmed') }}</span>
              </span>

              <!-- 已拒绝标记 -->
              <span
                v-if="getToolDecision(tool.id) === false"
                class="decision-badge decision-rejected"
                :title="t('components.message.tool.rejected')"
                @click.stop="rejectToolExecution(tool.id, tool.name)"
              >
                <span class="codicon codicon-close"></span>
                <span class="decision-text">{{ t('components.message.tool.rejected') }}</span>
              </span>
            </div>
          </div>
        </div>
        
        <!-- 工具描述和操作按钮 -->
        <div
          v-if="tool.name === 'execute_command' || tool.descriptionText || tool.riskBadge || hasActionButtons(tool)"
          class="tool-description-row"
        >
	          <div v-if="tool.name === 'execute_command'" class="exec-command">
	            <div class="exec-command-body">
	              <div class="exec-command-line">
	                <code
	                  class="exec-command-text"
	                  :class="tool.riskBadge ? `risk-${tool.riskBadge.level}` : ''"
	                >
	                  {{ getExecuteCommandArgs(tool).command }}
	                </code>
	
	              </div>
	            </div>
	          </div>

          <div v-else class="tool-description" :class="{ 'has-risk-badge': !!tool.riskBadge }">
            <span
              v-if="tool.riskBadge"
              :class="['risk-badge', `risk-${tool.riskBadge.level}`]"
            >
              {{ tool.riskBadge.label }}
            </span>
            <span class="tool-description-text">{{ tool.descriptionText }}</span>
          </div>
          
          <div class="tool-action-buttons">
            <!-- 确认按钮：当工具等待确认且未做决定时显示 -->
            <button
              v-if="tool.name !== 'execute_command' && tool.awaitingConfirmation && !hasUserDecision(tool.id)"
              class="confirm-btn"
              :title="t('components.message.tool.confirmExecution')"
              @click.stop="confirmToolExecution(tool.id, tool.name)"
            >
              <span class="confirm-btn-icon codicon codicon-check"></span>
              <span class="confirm-btn-text">{{ t('components.message.tool.confirm') }}</span>
            </button>
            
            <!-- 拒绝按钮：当工具等待确认且未做决定时显示 -->
            <button
              v-if="tool.name !== 'execute_command' && tool.awaitingConfirmation && !hasUserDecision(tool.id)"
              class="reject-btn"
              :title="t('components.message.tool.reject')"
              @click.stop="rejectToolExecution(tool.id, tool.name)"
            >
              <span class="reject-btn-icon codicon codicon-close"></span>
              <span class="reject-btn-text">{{ t('components.message.tool.reject') }}</span>
            </button>
            
            <!-- 已确认标记 -->
            <span
              v-if="tool.name !== 'execute_command' && tool.awaitingConfirmation && getToolDecision(tool.id) === true"
              class="decision-badge decision-confirmed"
              :title="t('components.message.tool.confirmed')"
              @click.stop="confirmToolExecution(tool.id, tool.name)"
            >
              <span class="codicon codicon-check"></span>
              <span class="decision-text">{{ t('components.message.tool.confirmed') }}</span>
            </span>
            
            <!-- 已拒绝标记 -->
            <span
              v-if="tool.name !== 'execute_command' && tool.awaitingConfirmation && getToolDecision(tool.id) === false"
              class="decision-badge decision-rejected"
              :title="t('components.message.tool.rejected')"
              @click.stop="rejectToolExecution(tool.id, tool.name)"
            >
              <span class="codicon codicon-close"></span>
              <span class="decision-text">{{ t('components.message.tool.rejected') }}</span>
            </span>
            
            <!-- diff 预览按钮 -->
            <button
              v-if="hasDiffPreview(tool) && getDiffFilePaths(tool).length > 0"
              class="diff-preview-btn"
              :title="t('components.message.tool.viewDiffInVSCode')"
              @click.stop="openDiffPreview(tool)"
            >
              <span class="diff-btn-icon codicon codicon-diff"></span>
              <span class="diff-btn-text">{{ t('components.message.tool.viewDiff') }}</span>
              <span class="diff-btn-arrow codicon codicon-arrow-right"></span>
            </button>

            <!-- 快速撤销（apply_diff） -->
            <button
              v-if="canUndoApplyDiff(tool)"
              class="undo-diff-btn"
              :disabled="undoingApplyDiffToolId === tool.id"
              :title="t('common.undo')"
              @click.stop="undoApplyDiffTool(tool)"
            >
              <span
                :class="[
                  'undo-btn-icon',
                  'codicon',
                  undoingApplyDiffToolId === tool.id ? 'codicon-loading codicon-modifier-spin' : 'codicon-discard'
                ]"
              ></span>
              <span class="undo-btn-text">{{ t('common.undo') }}</span>
            </button>

            <!-- 快速确认（保存并继续） -->
            <IconButton
              v-if="isDiffReviewTool(tool) && tool.status === 'running'"
              icon="codicon-save"
              size="small"
              :loading="acceptingDiffToolId === tool.id"
              :tooltip="t('components.message.tool.saveAndContinue')"
              @click.stop="acceptPendingDiff(tool)"
            />
          </div>
        </div>
      </div>

      <!-- 工具详细内容 - 展开时显示（仅当可展开时） -->
      <div v-if="isExpandable(tool) && isExpanded(tool.id)" class="tool-content">
        <component :is="() => renderToolContent(tool)" />
      </div>
    </div>
  </div>
</template>

<style scoped src="./ToolMessage.part1.css"></style>
<style scoped src="./ToolMessage.part2.css"></style>
