<script setup lang="ts">
import { ConfirmDialog, CustomScrollbar, DeleteDialog, Tooltip } from '../common'
import PlanRunnerPanel from '../plan/PlanRunnerPanel.vue'
import type { Attachment, Message } from '../../types'
import MessageItem from './MessageItem.vue'
import SummaryMessage from './SummaryMessage.vue'
import ToolGroupMessage from './ToolGroupMessage.vue'
import { useMessageList } from './useMessageList'
import ValidationCardMessage from './ValidationCardMessage.vue'

const props = defineProps<{
  messages: Message[]
}>()

const emit = defineEmits<{
  edit: [messageId: string, newContent: string, attachments: Attachment[]]
  delete: [messageId: string]
  retry: [messageId: string]
  copy: [content: string]
  restoreCheckpoint: [checkpointId: string]
  restoreAndRetry: [messageId: string, checkpointId: string]
  restoreAndEdit: [messageId: string, newContent: string, attachments: Attachment[], checkpointId: string]
}>()

const {
  t,
  chatStore,
  errorCopied,
  copyErrorDetails,
  hasMore,
  renderItems,
  scrollbarRef,
  showJumpToLatest,
  handleJumpToLatest,
  showDeleteConfirm,
  deleteCheckpoints,
  deleteCount,
  confirmDelete,
  handleRestoreAndDelete,
  cancelDelete,
  showRestoreConfirm,
  confirmRestore,
  handleEdit,
  handleDelete,
  handleRetry,
  handleCopy,
  handleRestoreCheckpoint,
  handleRestoreAndRetry,
  handleRestoreAndEdit,
  handleContinue,
  handleErrorRetry,
  shouldMergeForTool,
  recentCheckpoint,
  restoreCheckpoint,
  getCheckpointLabel,
  getMergedLabel,
  formatCheckpointTime
} = useMessageList(props, emit)
</script>

<template>
  <div class="message-list">
    <CustomScrollbar ref="scrollbarRef">
      <div class="messages-container">
        <!-- 自动加载更多指示器 -->
        <div v-if="hasMore" class="load-more-container">
          <i class="codicon codicon-loading codicon-modifier-spin"></i>
        </div>

        <template
          v-for="item in renderItems"
          :key="item.kind === 'message' ? item.message.id : item.id"
        >
          <template v-if="item.kind === 'message'">
            <!-- 消息前的检查点（或合并显示） -->
            <template v-if="item.beforeCheckpoints.length > 0">
              <div v-for="cp in item.beforeCheckpoints" :key="cp.id" class="checkpoint-bar"
                :class="shouldMergeForTool(item.actualIndex, cp.toolName) ? 'checkpoint-merged' : 'checkpoint-before'">
                <div class="checkpoint-icon">
                  <i class="codicon"
                    :class="shouldMergeForTool(item.actualIndex, cp.toolName) ? 'codicon-check' : 'codicon-archive'"></i>
                </div>
                <div class="checkpoint-info">
                  <span class="checkpoint-label">
                    {{ shouldMergeForTool(item.actualIndex, cp.toolName) ? getMergedLabel(cp) : getCheckpointLabel(cp,
                    'before') }}
                  </span>
                  <span class="checkpoint-meta">{{ t('components.message.checkpoint.fileCount', { count: cp.fileCount })
                    }}</span>
                </div>
                <span v-if="cp.toolName !== 'user_message'" class="checkpoint-time">{{ formatCheckpointTime(cp.timestamp)
                  }}</span>
                <Tooltip :text="t('components.message.checkpoint.restoreTooltip')">
                  <button class="checkpoint-action" @click="restoreCheckpoint(cp)">
                    <i class="codicon codicon-discard"></i>
                  </button>
                </Tooltip>
              </div>
            </template>

            <!-- 总结消息使用专用组件 -->
            <div class="message-anchor" :data-message-id="item.message.id">
              <SummaryMessage v-if="item.message.isSummary" :message="item.message" :message-index="item.actualIndex" />

              <!-- 普通消息使用 MessageItem -->
              <MessageItem v-else :message="item.message" :message-index="item.actualIndex" @edit="handleEdit"
                @delete="handleDelete" @retry="handleRetry" @copy="handleCopy" @restore-checkpoint="handleRestoreCheckpoint"
                @restore-and-retry="handleRestoreAndRetry" @restore-and-edit="handleRestoreAndEdit" />
            </div>

            <!-- 消息后的检查点（仅当该工具的内容有变化时显示） -->
            <template v-if="item.afterCheckpoints.length > 0">
              <template v-for="cp in item.afterCheckpoints" :key="cp.id">
                <!-- 只有当该工具没有被合并时才显示 after 检查点 -->
                <div v-if="!shouldMergeForTool(item.actualIndex, cp.toolName)" class="checkpoint-bar checkpoint-after">
                  <div class="checkpoint-icon">
                    <i class="codicon codicon-archive"></i>
                  </div>
                  <div class="checkpoint-info">
                    <span class="checkpoint-label">{{ getCheckpointLabel(cp, 'after') }}</span>
                    <span class="checkpoint-meta">{{ t('components.message.checkpoint.fileCount', { count: cp.fileCount })
                      }}</span>
                  </div>
                  <span v-if="cp.toolName !== 'user_message'" class="checkpoint-time">{{
                    formatCheckpointTime(cp.timestamp) }}</span>
                  <Tooltip :text="t('components.message.checkpoint.restoreTooltip')">
                    <button class="checkpoint-action" @click="restoreCheckpoint(cp)">
                      <i class="codicon codicon-discard"></i>
                    </button>
                  </Tooltip>
                </div>
              </template>
            </template>
          </template>

          <ToolGroupMessage
            v-else
            :messages="item.messages"
            :tool-name="item.toolName"
          />
        </template>

        <!-- 改动后校验提示（不写入 allMessages，避免索引错位） -->
        <div v-if="chatStore.postEditValidationPending && !chatStore.isWaitingForResponse && !chatStore.isStreaming"
          class="post-edit-validation">
          <ValidationCardMessage />
        </div>

        <PlanRunnerPanel />

        <div v-if="recentCheckpoint" class="recent-checkpoint">
          <div class="recent-checkpoint-icon">
            <i class="codicon codicon-history"></i>
          </div>
          <div class="recent-checkpoint-content">
            <div class="recent-checkpoint-title">{{ t('components.message.checkpoint.recentTitle') }}</div>
            <div class="recent-checkpoint-meta">
              <span>{{ getCheckpointLabel(recentCheckpoint, recentCheckpoint.phase) }}</span>
              <span>{{ t('components.message.checkpoint.fileCount', { count: recentCheckpoint.fileCount }) }}</span>
              <span>{{ formatCheckpointTime(recentCheckpoint.timestamp) }}</span>
            </div>
          </div>
          <button class="recent-checkpoint-action" @click="restoreCheckpoint(recentCheckpoint)">
            <i class="codicon codicon-discard"></i>
            <span>{{ t('components.message.checkpoint.recentRestore') }}</span>
          </button>
        </div>

        <!-- 继续对话提示 - 当最后一条是工具响应时显示 -->
        <div v-if="chatStore.needsContinueButton" class="continue-message">
          <div class="continue-icon">
            <i class="codicon codicon-debug-pause"></i>
          </div>
          <div class="continue-content">
            <div class="continue-title">{{ t('components.message.continue.title') }}</div>
            <div class="continue-text">{{ t('components.message.continue.description') }}</div>
          </div>
          <div class="continue-actions">
            <button class="continue-btn" @click="handleContinue">
              <span class="codicon codicon-play"></span>
              <span class="btn-text">{{ t('components.message.continue.button') }}</span>
            </button>
          </div>
        </div>

        <!-- 错误提示 - 显示在消息末尾 -->
        <div v-if="chatStore.error" class="error-message">
          <div class="error-header">
            <div class="error-icon">⚠</div>
            <div class="error-title">{{ t('components.message.error.title') }}</div>
            <div class="error-actions">
              <button class="error-retry" @click="handleErrorRetry" :title="t('components.message.error.retry')">
                <span class="codicon codicon-refresh"></span>
              </button>
              <button class="error-copy" @click="copyErrorDetails"
                :title="errorCopied ? t('common.copied') : t('components.message.error.copy')">
                <span :class="['codicon', errorCopied ? 'codicon-check' : 'codicon-copy']"></span>
              </button>
              <button class="error-dismiss" @click="chatStore.error = null"
                :title="t('components.message.error.dismiss')">
                ✕
              </button>
            </div>
          </div>
          <div class="error-body">
            <CustomScrollbar :max-height="120" :width="4">
              <pre class="error-text-code">{{ chatStore.error.code }}: {{ chatStore.error.message }}</pre>
            </CustomScrollbar>
          </div>
        </div>
      </div>
    </CustomScrollbar>

    <button
      v-if="showJumpToLatest"
      class="jump-to-latest"
      type="button"
      data-testid="jump-to-latest"
      @click="handleJumpToLatest"
    >
      <span class="codicon codicon-arrow-down"></span>
      <span class="btn-text">{{ t('components.message.jumpToLatest') }}</span>
    </button>

    <!-- 删除确认对话框 -->
    <DeleteDialog v-model="showDeleteConfirm" :checkpoints="deleteCheckpoints" :delete-count="deleteCount"
      @delete="confirmDelete" @restore-and-delete="handleRestoreAndDelete" @cancel="cancelDelete" />

    <!-- 恢复检查点确认对话框 -->
    <ConfirmDialog v-model="showRestoreConfirm" :title="t('components.message.checkpoint.restoreConfirmTitle')"
      :message="t('components.message.checkpoint.restoreConfirmMessage')"
      :confirm-text="t('components.message.checkpoint.restoreConfirmBtn')" is-danger @confirm="confirmRestore" />

  </div>
</template>

<style scoped src="./MessageList.css"></style>
