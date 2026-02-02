<script setup lang="ts">
/**
 * InputArea - 输入区容器
 * 扁平化设计，底部栏布局：左侧附件按钮，右侧发送按钮
 */

import { ref, computed } from 'vue'
import InputBox from './InputBox.vue'
import FilePickerPanel from './FilePickerPanel.vue'
import ComposerTopBar from './ComposerTopBar.vue'
import InputAreaFooter from './InputAreaFooter.vue'
import PinnedFilesPanel from './PinnedFilesPanel.vue'
import CreateTaskModal from '../task/CreateTaskModal.vue'
import CreatePlanModal from '../plan/CreatePlanModal.vue'
import { useChatStore } from '../../stores'
import type { Attachment } from '../../types'
import { useInputAreaConfig } from './useInputAreaConfig'
import { useInputAreaInput } from './useInputAreaInput'
import { useAtFilePicker } from './useAtFilePicker'

// 固定文件项类型
const props = defineProps<{
  uploading?: boolean
  placeholder?: string
  attachments?: Attachment[]
}>()

// 从 store 读取等待状态
const chatStore = useChatStore()

const {
  isLoadingConfigs,
  isThinkingEffortVisible,
  thinkingEffortOptions,
  thinkingEffortValue,
  unifiedModelOptions,
  unifiedModelValue,
  handleThinkingEffortChange,
  handleUnifiedModelChange
} = useInputAreaConfig()

const emit = defineEmits<{
  send: [content: string, attachments: Attachment[]]
  cancel: []
  attachFile: []
  removeAttachment: [id: string]
  pasteFiles: [files: File[]]
}>()

const {
  inputValue,
  historyNavigationActive,
  canSend,
  pushPromptToHistory,
  resetPromptHistoryNavigation,
  handlePromptHistoryKeydown,
  handleInput,
  handleCompositionStart,
  handleCompositionEnd
} = useInputAreaInput({
  uploading: props.uploading,
  attachments: props.attachments
})

const {
  showFilePicker,
  filePickerQuery,
  inputBoxRef,
  filePickerRef,
  handleTriggerAtPicker,
  handleAtQueryChange,
  handleCloseAtPicker,
  handleSelectFile,
  handleAtPickerKeydown
} = useAtFilePicker()

function handleSend() {
  if (!canSend.value) return

  const content = inputValue.value.trim()
  const attachments = props.attachments || []

  pushPromptToHistory(content)
  resetPromptHistoryNavigation()
  emit('send', content, attachments)
  chatStore.clearInputValue()
}

function handleCancel() {
  emit('cancel')
}

function handleAttachFile() {
  emit('attachFile')
}

function handleRemoveAttachment(id: string) {
  emit('removeAttachment', id)
}

function handlePasteFiles(files: File[]) {
  emit('pasteFiles', files)
}

// Create Task Modal
const showCreateTaskModal = ref(false)

// Create Plan Modal
const showCreatePlanModal = ref(false)

// 是否显示固定文件面板
const showPinnedFilesPanel = ref(false)

const enabledPinnedFilesCount = ref(0)
const hasPinnedPrompt = computed(() => Boolean(chatStore.pinnedPrompt?.mode && chatStore.pinnedPrompt.mode !== 'none'))

function handlePinnedPanelStats(count: number) {
  enabledPinnedFilesCount.value = count
}


function openPinnedFilesPanel() {
  showPinnedFilesPanel.value = true
}

</script>

<template>
  <div class="input-area">
    <CreateTaskModal v-model="showCreateTaskModal" />
    <CreatePlanModal v-model="showCreatePlanModal" />

    <PinnedFilesPanel
      :visible="showPinnedFilesPanel"
      @close="showPinnedFilesPanel = false"
      @stats-change="(count) => handlePinnedPanelStats(count)"
    />

    <!-- 单个输入框容器：所有控件都在同一个框内 -->
    <div class="composer">
      <!-- 顶部：文件/钉住 -->
      <ComposerTopBar
        :uploading="uploading"
        :attachments="attachments"
        :enabled-pinned-files-count="enabledPinnedFilesCount"
        :has-pinned-prompt="hasPinnedPrompt"
        :selection-references="chatStore.selectionReferences"
        @attach-file="handleAttachFile"
        @remove-attachment="handleRemoveAttachment"
        @remove-selection-reference="chatStore.removeSelectionReference"
        @open-pinned-panel="openPinnedFilesPanel"
        @open-task-modal="showCreateTaskModal = true"
        @open-plan-modal="showCreatePlanModal = true"
      />

      <!-- 中部：输入框 + 发送按钮（在输入框内） -->
      <div class="composer-body">
        <div class="composer-input">
          <!-- @ 文件选择面板 -->
          <FilePickerPanel
            ref="filePickerRef"
            :visible="showFilePicker"
            :query="filePickerQuery"
            @select="handleSelectFile"
            @close="handleCloseAtPicker"
            @update:query="(q) => filePickerQuery = q"
          />

          <!-- 输入框 -->
          <InputBox
            ref="inputBoxRef"
            :value="inputValue"
            :disabled="false"
            :placeholder="placeholder"
            variant="embedded"
            :history-navigation-active="historyNavigationActive"
            @update:value="handleInput"
            @send="handleSend"
            @composition-start="handleCompositionStart"
            @composition-end="handleCompositionEnd"
            @paste="handlePasteFiles"
            @history-keydown="handlePromptHistoryKeydown"
            @trigger-at-picker="handleTriggerAtPicker"
            @close-at-picker="handleCloseAtPicker"
            @at-query-change="handleAtQueryChange"
            @at-picker-keydown="handleAtPickerKeydown"
          />
        </div>
      </div>

      <InputAreaFooter
        :unified-model-value="unifiedModelValue"
        :unified-model-options="unifiedModelOptions"
        :is-loading-configs="isLoadingConfigs"
        :thinking-effort-value="thinkingEffortValue"
        :thinking-effort-options="thinkingEffortOptions"
        :show-thinking-effort-visible="isThinkingEffortVisible"
        :chat-mode-value="chatStore.chatMode"
        :chat-mode-options="[{ value: 'chat', label: 'Chat' }, { value: 'plan', label: 'Plan' }, { value: 'agent', label: 'Agent' }]"
        :token-usage-percent="chatStore.tokenUsagePercent"
        :used-tokens="chatStore.usedTokens"
        :max-context-tokens="chatStore.maxContextTokens"
        :is-waiting-for-response="chatStore.isWaitingForResponse"
        :can-send="canSend"
        :attachments="attachments"
        @update-unified-model="handleUnifiedModelChange"
        @update-thinking-effort="handleThinkingEffortChange"
        @update-chat-mode="(value) => chatStore.setChatMode(value as any)"
        @open-context-inspector="(atts) => chatStore.openContextInspectorPreview(atts)"
        @send="handleSend"
        @cancel="handleCancel"
      />
    </div>
  </div>
</template>

<style scoped>
.input-area {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 8px;
  background: var(--vscode-editor-background);
  border-top: 1px solid var(--vscode-panel-border);
  z-index: 2000;
}

/* 输入框整体容器：一个框里放所有控件 */
.composer {
  display: flex;
  flex-direction: column;
  background: var(--vscode-input-background);
  border: 1px solid var(--vscode-input-border);
  border-radius: 6px;
  overflow: visible;
}

.composer:focus-within {
  border-color: var(--vscode-focusBorder);
}

.composer-top {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 6px;
  min-width: 0;
  flex-wrap: nowrap;
}

.composer-body {
  display: flex;
  align-items: stretch;
}

.composer-input {
  position: relative;
  flex: 1;
  min-width: 0;
}

.composer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: nowrap;
  gap: 8px;
  padding: 0 6px;
  min-width: 0;
}

.composer-selectors {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 1 170px;
  min-width: 0;
  max-width: 170px;
}

.composer-selectors.with-thinking-effort {
  flex: 0 1 280px;
  max-width: 280px;
}

.composer-footer-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 0 1 auto;
  min-width: 0;
  flex-wrap: nowrap;
  justify-content: flex-end;
  margin-left: auto;
}

/* 模型选择器 */
.model-selector-wrapper {
  flex: 1;
  min-width: 0;
}

.model-selector-wrapper :deep(.unified-model-selector) {
  width: 100%;
}

.thinking-effort-wrapper {
  flex: 0 0 78px;
  min-width: 78px;
}

.thinking-effort-wrapper :deep(.custom-select) {
  width: 100%;
}

/* Token 圆环 */
.token-ring-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.token-ring {
  display: block;
}

.token-tooltip {
  position: absolute;
  bottom: calc(100% + 6px);
  right: 0;
  padding: 4px 8px;
  background: var(--vscode-editorWidget-background);
  border: 1px solid var(--vscode-editorWidget-border);
  border-radius: 3px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.15s, visibility 0.15s;
  z-index: 1000;
  pointer-events: none;
}

.token-ring-wrapper:hover .token-tooltip {
  opacity: 1;
  visibility: visible;
}

/* 提示框小三角 */
.token-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  right: 8px;
  border: 4px solid transparent;
  border-top-color: var(--vscode-editorWidget-border);
}

.token-tooltip::before {
  content: '';
  position: absolute;
  top: 100%;
  right: 9px;
  border: 3px solid transparent;
  border-top-color: var(--vscode-editorWidget-background);
  z-index: 1;
}

.token-tooltip-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 10px;
  line-height: 1.5;
}

.token-tooltip-label {
  color: var(--vscode-descriptionForeground);
}

.token-tooltip-value {
  color: var(--vscode-foreground);
  font-family: var(--vscode-editor-font-family);
  font-size: 10px;
}

/* 本条消息上下文开关按钮 */
.context-overrides-button-wrapper {
  position: relative;
  display: inline-flex;
}

.context-overrides-button.has-overrides :deep(i.codicon) {
  color: var(--vscode-textLink-foreground);
}

.context-overrides-button.active {
  background: var(--vscode-toolbar-hoverBackground);
}

.context-overrides-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  font-size: 10px;
  font-weight: 500;
  line-height: 14px;
  text-align: center;
  color: var(--vscode-badge-foreground);
  background: var(--vscode-badge-background);
  border-radius: 7px;
}

</style>
