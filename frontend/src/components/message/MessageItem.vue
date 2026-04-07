<script setup lang="ts">
import { EditDialog, IconButton, MarkdownRenderer, RetryDialog } from '../common'
import type { Attachment, Message } from '../../types'
import MessageActions from './MessageActions.vue'
import MessageAttachments from './MessageAttachments.vue'
import TaskCardMessage from './TaskCardMessage.vue'
import ToolMessage from './ToolMessage.vue'
import { useMessageItem } from './useMessageItem'

const props = defineProps<{
  message: Message
  messageIndex: number
}>()

const emit = defineEmits<{
  edit: [messageId: string, newContent: string, attachments: Attachment[]]
  restoreAndEdit: [messageId: string, newContent: string, attachments: Attachment[], checkpointId: string]
  delete: [messageId: string]
  retry: [messageId: string]
  restoreAndRetry: [messageId: string, checkpointId: string]
  copy: [content: string]
}>()

const {
  t,
  isHovered,
  showRetryDialog,
  showEditDialog,
  isUser,
  isTool,
  isSummary,
  showFooterActions,
  taskCard,
  isStreaming,
  isSummaryExpanded,
  displayBlocks,
  isThoughtExpanded,
  isThinking,
  thinkingTimeDisplay,
  availableCheckpoints,
  checkpointsBeforeMessage,
  roleDisplayName,
  hasUsage,
  usageMetadata,
  formatTokenCount,
  cacheHitInfo,
  cacheHitTitle,
  showFinishReason,
  finishReasonClass,
  finishReasonTitle,
  finishReasonIcon,
  finishReasonSpin,
  hasContextSnapshot,
  messageClass,
  formattedTime,
  startEdit,
  handleEdit,
  handleRestoreAndEdit,
  handleCopy,
  handleDelete,
  handleRetryClick,
  handleRetry,
  handleRestoreAndRetry,
  handleOpenContextUsed
} = useMessageItem(props, emit)
</script>

<template>
  <div
    :class="messageClass"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- 重试对话框 -->
    <RetryDialog
      v-model="showRetryDialog"
      :checkpoints="availableCheckpoints"
      @retry="handleRetry"
      @restore-and-retry="handleRestoreAndRetry"
    />
    
    <!-- 编辑对话框 -->
    <EditDialog
      v-model="showEditDialog"
      :checkpoints="checkpointsBeforeMessage"
      :original-content="message.content"
      :original-attachments="message.attachments || []"
      @edit="handleEdit"
      @restore-and-edit="handleRestoreAndEdit"
    />

    <div class="message-body">
      <!-- Task 卡片消息 -->
      <div v-if="taskCard" class="task-card-block">
        <TaskCardMessage :task="taskCard" />
      </div>
      <!-- 总结消息特殊显示 -->
      <div v-else-if="isSummary" class="summary-block">
        <div
          class="summary-header"
          @click="isSummaryExpanded = !isSummaryExpanded"
        >
          <i class="codicon" :class="isSummaryExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'"></i>
          <i class="codicon codicon-fold summary-icon"></i>
          <span class="summary-label">{{ t('components.message.summary.title') }}</span>
          <span v-if="message.summarizedMessageCount" class="summary-count">
            {{ t('components.message.summary.compressed', { count: message.summarizedMessageCount }) }}
          </span>
        </div>
        <div v-if="isSummaryExpanded" class="summary-content">
          <MarkdownRenderer
            :content="message.content"
            :latex-only="false"
            class="summary-text"
          />
        </div>
      </div>
      
      <!-- 普通消息显示 -->
      <template v-else>
        <!-- 用户消息的附件显示 -->
        <MessageAttachments
          v-if="isUser && message.attachments && message.attachments.length > 0"
          :attachments="message.attachments"
        />
        
	        <!-- 显示模式 -->
	        <div class="message-content">
	        <!-- 有 parts 时：按 parts 原始顺序渲染内容块 -->
	        <template v-if="displayBlocks.length > 0">
	          <template v-for="(block, index) in displayBlocks" :key="index">
            <!-- 思考块 + 工具调用块：合并显示为一个整体 -->
            <div v-if="block.type === 'thoughtTool'" class="thought-tool-block">
              <div
                class="thought-header thought-tool-header"
                @click="isThoughtExpanded = !isThoughtExpanded"
              >
                <i class="codicon" :class="isThoughtExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'"></i>
                <i class="codicon codicon-lightbulb thought-icon" :class="{ 'thinking-pulse': isThinking }"></i>
                <span class="thought-label">{{ isThinking ? t('components.message.thought.thinking') : t('components.message.thought.thoughtProcess') }}</span>
                <span v-if="thinkingTimeDisplay" class="thought-time" :class="{ 'thinking-active': isThinking }">
                  {{ thinkingTimeDisplay }}
                </span>
                <span v-if="!isThoughtExpanded" class="thought-preview">
                  {{ (block.text || '').slice(0, 50) }}{{ (block.text || '').length > 50 ? '...' : '' }}
                </span>
              </div>
              <div v-if="isThoughtExpanded" class="thought-content thought-tool-content">
                <MarkdownRenderer
                  :content="block.text || ''"
                  :latex-only="false"
                  :streaming="isStreaming"
                  class="thought-text"
                />
              </div>
              <div class="thought-tool-tools">
                <ToolMessage
                  :tools="block.tools!"
                  :embedded="true"
                />
              </div>
            </div>

            <!-- 思考块：可折叠显示 -->
            <div v-if="block.type === 'thought'" class="thought-block">
              <div
                class="thought-header"
                @click="isThoughtExpanded = !isThoughtExpanded"
              >
                <i class="codicon" :class="isThoughtExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'"></i>
                <i class="codicon codicon-lightbulb thought-icon" :class="{ 'thinking-pulse': isThinking }"></i>
                <span class="thought-label">{{ isThinking ? t('components.message.thought.thinking') : t('components.message.thought.thoughtProcess') }}</span>
                <span v-if="thinkingTimeDisplay" class="thought-time" :class="{ 'thinking-active': isThinking }">
                  {{ thinkingTimeDisplay }}
                </span>
                <span v-if="!isThoughtExpanded" class="thought-preview">
                  {{ (block.text || '').slice(0, 50) }}{{ (block.text || '').length > 50 ? '...' : '' }}
                </span>
              </div>
              <div v-if="isThoughtExpanded" class="thought-content">
                <MarkdownRenderer
                  :content="block.text || ''"
                  :latex-only="false"
                  :streaming="isStreaming"
                  class="thought-text"
                />
              </div>
            </div>
            
            <!-- 文本块：使用 MarkdownRenderer 渲染 -->
            <!-- 用户消息仅渲染 LaTeX，助手消息渲染完整 Markdown -->
            <MarkdownRenderer
              v-else-if="block.type === 'text'"
              :content="block.text || ''"
              :latex-only="isUser"
              :streaming="isStreaming"
              class="content-text"
            />
            
            <!-- 工具调用块 -->
            <ToolMessage
              v-else-if="block.type === 'tool'"
              :tools="block.tools!"
            />
          </template>
        </template>
        
        <!-- 无 parts 但有 content 时：直接渲染 content -->
        <!-- 用户消息仅渲染 LaTeX -->
        <MarkdownRenderer
          v-else-if="message.content"
          :content="message.content"
          :latex-only="isUser"
          :streaming="isStreaming"
          class="content-text"
        />

        <!-- 消息底部信息：工具栏统一放在下方 -->
        <div
          v-if="formattedTime || showFooterActions || (!isUser && hasUsage)"
          class="message-footer"
          :class="{ 'user-footer': isUser }"
        >
          <div v-if="!isUser" class="message-footer-left">
            <span class="role-label" :class="{ marquee: isStreaming }">{{ roleDisplayName }}</span>
	
	            <div v-if="hasUsage" class="token-usage">
	              <span v-if="usageMetadata?.totalTokenCount" class="token-total">
	                {{ formatTokenCount(usageMetadata.totalTokenCount) }}
	              </span>
	              <span v-if="usageMetadata?.candidatesTokenCount" class="token-item token-candidates">
	                <span class="token-arrow">↓</span>
	                <span class="token-count">{{ formatTokenCount(usageMetadata.candidatesTokenCount) }}</span>
	              </span>
	              <span v-if="usageMetadata?.promptTokenCount" class="token-item token-prompt">
	                <span class="token-arrow">↑</span>
	                <span class="token-count">{{ formatTokenCount(usageMetadata.promptTokenCount) }}</span>
	              </span>
	            </div>

              <span v-if="cacheHitInfo" class="cache-hit" :title="cacheHitTitle">
                <i class="codicon codicon-database"></i>
                <span class="cache-hit-tokens">{{ cacheHitInfo.cachedTokensText }}</span>
                <span class="cache-hit-paren">(</span>
                <span class="cache-hit-percent">{{ cacheHitInfo.percent }}%</span>
                <span class="cache-hit-paren">)</span>
              </span>
	
	            <span
              v-if="showFinishReason"
              class="finish-reason"
              :class="finishReasonClass"
              :title="finishReasonTitle"
              :aria-label="finishReasonTitle"
            >
              <i
                class="codicon"
                :class="[finishReasonIcon, { 'codicon-modifier-spin': finishReasonSpin }]"
              ></i>
            </span>
          </div>

          <div class="message-footer-right">
            <IconButton
              v-if="!isUser && !isTool && hasContextSnapshot"
              icon="codicon-eye"
              size="small"
              :tooltip="t('components.message.stats.contextUsed')"
              @click="handleOpenContextUsed"
            />
            <MessageActions
              v-if="showFooterActions"
              :message="message"
              :can-edit="isUser"
              :can-retry="!isUser"
              @edit="startEdit"
              @copy="handleCopy"
              @delete="handleDelete"
              @retry="handleRetryClick"
            />
            <span v-if="formattedTime" class="message-time">{{ formattedTime }}</span>
          </div>
        </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped src="./MessageItem.part1.css"></style>
<style scoped src="./MessageItem.part2.css"></style>
