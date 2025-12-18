<script setup lang="ts">
/**
 * ToolMessage - 工具调用消息组件（重新设计）
 *
 * 功能：
 * 1. 显示工具名称在标题栏
 * 2. 显示描述（参数摘要）
 * 3. 可展开/收起详细内容
 * 4. 支持自定义内容面板组件
 * 5. 通过工具 ID 从 store 获取响应结果
 */

import { ref, computed, Component, h, watchEffect } from 'vue'
import type { ToolUsage } from '../../types'
import { getToolConfig } from '../../utils/toolRegistry'
import { ensureMcpToolRegistered } from '../../utils/tools'
import { useChatStore } from '../../stores'
import { sendToExtension } from '../../utils/vscode'
import { useI18n } from '../../i18n'

const { t } = useI18n()

const props = defineProps<{
  tools: ToolUsage[]
}>()

const chatStore = useChatStore()


// 确保 MCP 工具已注册
watchEffect(() => {
  for (const tool of props.tools) {
    ensureMcpToolRegistered(tool.name)
  }
})

// 增强后的工具列表，包含从 store 获取的响应
const enhancedTools = computed(() => {
  const result = props.tools.map((tool) => {
    // 如果工具已经有结果，直接使用
    if (tool.result) {
      return { ...tool, status: 'success' as const, awaitingConfirmation: false }
    }
    
    // 通过工具调用 ID 查找响应
    if (tool.id) {
      const response = chatStore.getToolResponseById(tool.id)
      if (response) {
        return { ...tool, result: response, status: 'success' as const, awaitingConfirmation: false }
      }
    }
    
    // 如果正在处理确认，显示 running 状态
    if (processingToolIds.value.has(tool.id)) {
      return { ...tool, status: 'running' as const, awaitingConfirmation: false }
    }
    
    // 检查是否等待确认：后端发送 awaitingConfirmation 时会设置 status = 'pending'
    const awaitingConfirm = tool.status === 'pending'
    
    // 没有找到响应，使用当前状态
    const effectiveStatus = tool.status || 'running'
    return { ...tool, status: effectiveStatus, awaitingConfirmation: awaitingConfirm }
  })
  
  return result
})

// 正在处理确认的工具 ID 集合
const processingToolIds = ref<Set<string>>(new Set())

// 确认工具执行
async function confirmToolExecution(toolId: string, toolName: string) {
  // 标记为正在处理（这会使按钮消失，显示 running 状态）
  processingToolIds.value.add(toolId)
  
  // 发送确认到后端
  await sendToolConfirmation([{
    id: toolId,
    name: toolName,
    confirmed: true
  }])
}

// 拒绝工具执行
async function rejectToolExecution(toolId: string, toolName: string) {
  // 标记为正在处理
  processingToolIds.value.add(toolId)
  
  // 发送拒绝到后端
  await sendToolConfirmation([{
    id: toolId,
    name: toolName,
    confirmed: false
  }])
}

// 发送工具确认响应到后端
async function sendToolConfirmation(toolResponses: Array<{ id: string; name: string; confirmed: boolean }>) {
  try {
    const currentConversationId = chatStore.currentConversationId
    const currentConfig = chatStore.currentConfig
    
    if (!currentConversationId || !currentConfig?.id) {
      console.error('No conversation or config ID')
      return
    }
    
    await sendToExtension('toolConfirmation', {
      conversationId: currentConversationId,
      configId: currentConfig.id,
      toolResponses
    })
  } catch (error) {
    console.error('Failed to send tool confirmation:', error)
  }
}

// 展开状态
const expandedTools = ref<Set<string>>(new Set())

// 切换展开/收起
function toggleExpand(toolId: string) {
  if (expandedTools.value.has(toolId)) {
    expandedTools.value.delete(toolId)
  } else {
    expandedTools.value.add(toolId)
  }
}

// 检查是否已展开
function isExpanded(toolId: string): boolean {
  return expandedTools.value.has(toolId)
}

// 获取工具显示名称
function getToolLabel(tool: ToolUsage): string {
  const config = getToolConfig(tool.name)
  return config?.label || tool.name
}

// 获取工具图标
function getToolIcon(tool: ToolUsage): string {
  const config = getToolConfig(tool.name)
  return config?.icon || 'codicon-tools'
}

// 获取工具描述
function getToolDescription(tool: ToolUsage): string {
  const config = getToolConfig(tool.name)
  if (config?.descriptionFormatter) {
    return config.descriptionFormatter(tool.args)
  }
  // 默认描述：显示参数数量
  const argCount = Object.keys(tool.args || {}).length
  return t('components.message.tool.paramCount', { count: argCount })
}

// 检查工具是否可展开
function isExpandable(tool: ToolUsage): boolean {
  const config = getToolConfig(tool.name)
  // 默认可展开，除非显式设置为 false
  return config?.expandable !== false
}

// 检查工具是否支持 diff 预览
function hasDiffPreview(tool: ToolUsage): boolean {
  const config = getToolConfig(tool.name)
  return config?.hasDiffPreview === true
}

// 获取 diff 预览的文件路径
function getDiffFilePaths(tool: ToolUsage): string[] {
  const config = getToolConfig(tool.name)
  if (!config?.getDiffFilePath) return []
  
  const result = config.getDiffFilePath(tool.args)
  if (Array.isArray(result)) return result
  return result ? [result] : []
}

// 打开 diff 预览（在 VSCode 中）
async function openDiffPreview(tool: ToolUsage) {
  const paths = getDiffFilePaths(tool)
  if (paths.length === 0) return
  
  try {
    // 使用 JSON 序列化确保数据可克隆
    const serializedArgs = JSON.parse(JSON.stringify(tool.args || {}))
    const serializedResult = tool.result ? JSON.parse(JSON.stringify(tool.result)) : undefined
    
    await sendToExtension('diff.openPreview', {
      toolId: tool.id,
      toolName: tool.name,
      filePaths: paths,
      args: serializedArgs,
      result: serializedResult
    })
  } catch (err) {
    console.error(t('components.message.tool.openDiffFailed'), err)
  }
}

// 获取状态图标
function getStatusIcon(status?: string, awaitingConfirmation?: boolean): string {
  if (awaitingConfirmation) {
    return 'codicon-shield'
  }
  switch (status) {
    case 'pending':
      return 'codicon-clock'
    case 'running':
      return 'codicon-loading'
    case 'success':
      return 'codicon-check'
    case 'error':
      return 'codicon-error'
    default:
      return ''
  }
}

// 获取状态类名
function getStatusClass(status?: string, awaitingConfirmation?: boolean): string {
  if (awaitingConfirmation) {
    return 'status-warning'
  }
  switch (status) {
    case 'success':
      return 'status-success'
    case 'error':
      return 'status-error'
    case 'running':
      return 'status-running'
    case 'pending':
      return 'status-pending'
    default:
      return ''
  }
}

// 渲染工具内容
function renderToolContent(tool: ToolUsage) {
  const config = getToolConfig(tool.name)
  
  // 如果有自定义组件，使用自定义组件
  if (config?.contentComponent) {
    return h(config.contentComponent as Component, {
      args: tool.args,
      result: tool.result,
      error: tool.error,
      status: tool.status,
      toolId: tool.id
    })
  }
  
  // 如果有内容格式化器，使用格式化器
  if (config?.contentFormatter) {
    const content = config.contentFormatter(tool.args, tool.result)
    return h('div', { class: 'tool-content-text' }, content)
  }
  
  // 默认显示：参数和结果的 JSON
  return h('div', { class: 'tool-content-default' }, [
    tool.args && h('div', { class: 'content-section' }, [
      h('div', { class: 'section-label' }, t('components.message.tool.parameters') + ':'),
      h('pre', { class: 'section-data' }, JSON.stringify(tool.args, null, 2))
    ]),
    tool.result && h('div', { class: 'content-section' }, [
      h('div', { class: 'section-label' }, t('components.message.tool.result') + ':'),
      h('pre', { class: 'section-data' }, JSON.stringify(tool.result, null, 2))
    ]),
    tool.error && h('div', { class: 'content-section error-section' }, [
      h('div', { class: 'section-label' }, t('components.message.tool.error') + ':'),
      h('div', { class: 'error-message' }, tool.error)
    ])
  ])
}
</script>

<template>
  <div class="tool-message">
    <div
      v-for="tool in enhancedTools"
      :key="tool.id"
      class="tool-item"
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
          
          <!-- 工具图标 -->
          <span :class="['tool-icon', 'codicon', getToolIcon(tool)]"></span>
          
          <!-- 工具名称 -->
          <span class="tool-name">{{ getToolLabel(tool) }}</span>
          
          <!-- 状态图标 -->
          <span
            v-if="tool.status || tool.awaitingConfirmation"
            :class="[
              'status-icon',
              'codicon',
              getStatusIcon(tool.status, tool.awaitingConfirmation),
              getStatusClass(tool.status, tool.awaitingConfirmation)
            ]"
          ></span>
          
          <!-- 执行时间 -->
          <span v-if="tool.duration" class="tool-duration">
            {{ tool.duration }}ms
          </span>
        </div>
        
        <!-- 工具描述和操作按钮 -->
        <div class="tool-description-row">
          <div class="tool-description">
            {{ getToolDescription(tool) }}
          </div>
          
          <div class="tool-action-buttons">
            <!-- 确认按钮：当工具等待确认时显示 (status === 'pending') -->
            <button
              v-if="tool.awaitingConfirmation"
              class="confirm-btn"
              :title="t('components.message.tool.confirmExecution')"
              @click.stop="confirmToolExecution(tool.id, tool.name)"
            >
              <span class="confirm-btn-icon codicon codicon-check"></span>
              <span class="confirm-btn-text">{{ t('components.message.tool.confirm') }}</span>
            </button>
            
            <!-- 拒绝按钮：当工具等待确认时显示 -->
            <button
              v-if="tool.awaitingConfirmation"
              class="reject-btn"
              :title="t('components.message.tool.reject')"
              @click.stop="rejectToolExecution(tool.id, tool.name)"
            >
              <span class="reject-btn-icon codicon codicon-close"></span>
              <span class="reject-btn-text">{{ t('components.message.tool.reject') }}</span>
            </button>
            
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

<style scoped>
.tool-message {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm, 8px);
}

.tool-item {
  display: flex;
  flex-direction: column;
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: var(--radius-sm, 2px);
  overflow: hidden;
}

.tool-header {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs, 4px);
  padding: var(--spacing-sm, 8px);
  cursor: pointer;
  transition: background-color var(--transition-fast, 0.1s);
}

.tool-header:hover {
  background: var(--vscode-list-hoverBackground);
}

.tool-header.not-expandable {
  cursor: default;
}

.tool-header.not-expandable:hover {
  background: transparent;
}

.tool-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs, 4px);
}

.expand-icon {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
  transition: transform var(--transition-fast, 0.1s);
}

.tool-icon {
  font-size: 14px;
  color: var(--vscode-charts-blue);
}

.tool-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--vscode-foreground);
  font-family: var(--vscode-font-family);
}

.status-icon {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
  margin-left: var(--spacing-xs, 4px);
}

.status-icon.status-success {
  color: var(--vscode-testing-iconPassed);
}

.status-icon.status-error {
  color: var(--vscode-testing-iconFailed);
}

.status-icon.status-running {
  color: var(--vscode-testing-runAction);
  animation: spin 1s linear infinite;
}

.status-icon.status-warning {
  color: var(--vscode-inputValidation-warningForeground);
}

.status-icon.status-pending {
  color: var(--vscode-inputValidation-warningForeground);
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.tool-duration {
  margin-left: auto;
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}

.tool-description-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-sm, 8px);
  margin-left: 28px; /* 对齐图标 */
}

.tool-action-buttons {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs, 4px);
  flex-shrink: 0;
}

.tool-description {
  flex: 1;
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.4;
  font-family: var(--vscode-editor-font-family);
}

/* 确认按钮 - 极简无边框设计 */
.confirm-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  background: transparent;
  border: none;
  border-radius: 2px;
  color: var(--vscode-foreground);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.12s ease;
  flex-shrink: 0;
}

.confirm-btn:hover {
  background: rgba(128, 128, 128, 0.15);
}

.confirm-btn:active {
  background: rgba(128, 128, 128, 0.2);
}

.confirm-btn-icon {
  font-size: 12px;
}

.confirm-btn-text {
  white-space: nowrap;
}

/* 拒绝按钮 - 无边框设计 */
.reject-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  background: transparent;
  border: none;
  border-radius: 2px;
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.12s ease;
  flex-shrink: 0;
}

.reject-btn:hover {
  background: rgba(128, 128, 128, 0.1);
  color: var(--vscode-foreground);
}

.reject-btn:active {
  background: rgba(128, 128, 128, 0.15);
}

.reject-btn-icon {
  font-size: 12px;
}

.reject-btn-text {
  white-space: nowrap;
}

/* Diff 预览按钮 - 极简灰白设计 */
.diff-preview-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  background: transparent;
  border: 1px solid #555555;
  border-radius: 2px;
  color: var(--vscode-foreground);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.12s ease;
  flex-shrink: 0;
}

.diff-preview-btn:hover {
  background: rgba(128, 128, 128, 0.1);
  border-color: #777777;
}

.diff-preview-btn:active {
  background: rgba(128, 128, 128, 0.2);
}

.diff-btn-icon {
  font-size: 12px;
  opacity: 0.85;
}

.diff-btn-text {
  white-space: nowrap;
}

.diff-btn-arrow {
  font-size: 10px;
  opacity: 0.5;
  transition: transform 0.12s ease, opacity 0.12s ease;
}

.diff-preview-btn:hover .diff-btn-arrow {
  transform: translateX(2px);
  opacity: 0.8;
}

.tool-content {
  padding: var(--spacing-sm, 8px);
  border-top: 1px solid var(--vscode-panel-border);
  background: var(--vscode-editor-inactiveSelectionBackground);
}

/* 默认内容样式 */
.tool-content-default {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm, 8px);
}

.content-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs, 4px);
}

.section-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--vscode-descriptionForeground);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section-data {
  padding: var(--spacing-xs, 4px);
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: var(--radius-sm, 2px);
  font-size: 11px;
  font-family: var(--vscode-editor-font-family);
  color: var(--vscode-foreground);
  white-space: pre;
  overflow-x: auto;
  margin: 0;
}

.error-section {
  padding: var(--spacing-sm, 8px);
  background: var(--vscode-inputValidation-errorBackground);
  border: 1px solid var(--vscode-inputValidation-errorBorder);
  border-radius: var(--radius-sm, 2px);
}

.error-message {
  font-size: 12px;
  color: var(--vscode-inputValidation-errorForeground);
  font-family: var(--vscode-editor-font-family);
}

.tool-content-text {
  font-size: 12px;
  color: var(--vscode-foreground);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>