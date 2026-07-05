<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import UnifiedModelSelector, { type UnifiedModelOption } from './UnifiedModelSelector.vue'
import SendButton from './SendButton.vue'
import { CustomSelect, IconButton, Tooltip, type SelectOption } from '../common'
import { formatNumber } from '../../utils/format'
import { useI18n } from '../../i18n'
import type { Attachment } from '../../types'
import type { ThinkingEffort } from '../../utils/thinking'

const props = defineProps<{
  unifiedModelValue: string
  unifiedModelOptions: UnifiedModelOption[]
  isLoadingConfigs: boolean
  thinkingEffortValue: ThinkingEffort
  thinkingEffortOptions: SelectOption[]
  showThinkingEffortVisible: boolean
  chatModeValue: string
  chatModeOptions: SelectOption[]
  tokenUsagePercent: number
  usedTokens: number
  maxContextTokens: number
  isWaitingForResponse: boolean
  canSend: boolean
  attachments?: Attachment[]
}>()

const emit = defineEmits<{
  updateUnifiedModel: [value: string]
  updateThinkingEffort: [value: string]
  updateChatMode: [value: string]
  openContextInspector: [attachments?: Attachment[]]
  summarize: []
  send: []
  cancel: []
}>()

const { t } = useI18n()

const composerFooterRef = ref<HTMLElement | null>(null)
const composerFooterActionsRef = ref<HTMLElement | null>(null)
const composerFooterWidth = ref(0)
const composerFooterActionsWidth = ref(0)
let composerFooterResizeObserver: ResizeObserver | null = null

function updateComposerFooterMetrics(): void {
  const footer = composerFooterRef.value
  if (footer) {
    composerFooterWidth.value = footer.clientWidth
  }

  const actions = composerFooterActionsRef.value
  if (actions) {
    composerFooterActionsWidth.value = actions.getBoundingClientRect().width
  }
}

onMounted(() => {
  updateComposerFooterMetrics()

  if (typeof ResizeObserver === 'undefined') return

  composerFooterResizeObserver = new ResizeObserver(() => {
    requestAnimationFrame(() => {
      updateComposerFooterMetrics()
    })
  })

  if (composerFooterRef.value) composerFooterResizeObserver.observe(composerFooterRef.value)
  if (composerFooterActionsRef.value) composerFooterResizeObserver.observe(composerFooterActionsRef.value)
})

onBeforeUnmount(() => {
  composerFooterResizeObserver?.disconnect()
  composerFooterResizeObserver = null
})

const showThinkingEffortSelector = computed(() => {
  if (!props.showThinkingEffortVisible) return false

  if (composerFooterWidth.value <= 0 || composerFooterActionsWidth.value <= 0) return true

  const reserved = 24
  const availableForSelectors = composerFooterWidth.value - composerFooterActionsWidth.value - reserved
  const minSelectorsWidthWithEffort = 280
  return availableForSelectors >= minSelectorsWidthWithEffort
})

const tokenRingColor = computed(() => {
  const percent = props.tokenUsagePercent
  if (percent >= 90) return '#f14c4c'
  if (percent >= 75) return '#cca700'
  return '#89d185'
})

const ringRadius = 8
const ringCircumference = 2 * Math.PI * ringRadius
const ringDashOffset = computed(() => {
  return ringCircumference * (1 - props.tokenUsagePercent / 100)
})

function emitOpenContextInspector() {
  emit('openContextInspector', props.attachments)
}
</script>

<template>
    <div ref="composerFooterRef" class="composer-footer">
    <div class="composer-selectors" :class="{ 'with-thinking-effort': showThinkingEffortSelector }">
      <div class="chat-mode-wrapper">
        <CustomSelect
          :model-value="props.chatModeValue"
          :options="props.chatModeOptions"
          :disabled="props.isLoadingConfigs || props.chatModeOptions.length === 0"
          :drop-up="true"
          :compact="true"
          placeholder="Mode"
          @update:model-value="(value) => emit('updateChatMode', value)"
        />
      </div>

      <div class="model-selector-wrapper">
        <UnifiedModelSelector
          :model-value="props.unifiedModelValue"
          :options="props.unifiedModelOptions"
          :disabled="props.isLoadingConfigs || props.unifiedModelOptions.length === 0"
          :drop-up="true"
          @update:model-value="(value) => emit('updateUnifiedModel', value)"
        />
      </div>

      <div v-if="showThinkingEffortSelector" class="thinking-effort-wrapper">
        <CustomSelect
          :model-value="props.thinkingEffortValue"
          :options="props.thinkingEffortOptions"
          :disabled="props.isLoadingConfigs"
          :drop-up="true"
          :compact="true"
          :placeholder="t('components.channels.openai.thinking.effortLabel')"
          @update:model-value="(value) => emit('updateThinkingEffort', value)"
        />
      </div>
    </div>

    <div ref="composerFooterActionsRef" class="composer-footer-actions">
      <Tooltip :content="t('components.input.summarizeContext')" placement="top">
        <IconButton
          icon="codicon-fold"
          size="small"
          class="summarize-button"
          :disabled="props.isWaitingForResponse"
          :aria-label="t('components.input.summarizeContext')"
          @click="emit('summarize')"
        />
      </Tooltip>

      <div class="token-ring-wrapper" @click="emitOpenContextInspector">
        <svg class="token-ring" width="22" height="22" viewBox="0 0 22 22">
          <circle
            cx="11"
            cy="11"
            :r="ringRadius"
            fill="none"
            stroke="var(--vscode-panel-border)"
            stroke-width="2"
          />
          <circle
            cx="11"
            cy="11"
            :r="ringRadius"
            fill="none"
            :stroke="tokenRingColor"
            stroke-width="2"
            stroke-linecap="round"
            :stroke-dasharray="ringCircumference"
            :stroke-dashoffset="ringDashOffset"
            transform="rotate(-90 11 11)"
          />
        </svg>
        <div class="token-tooltip">
          <div class="token-tooltip-row">
            <span class="token-tooltip-label">{{ t('components.input.tokenUsage') }}</span>
            <span class="token-tooltip-value">{{ props.tokenUsagePercent.toFixed(1) }}%</span>
          </div>
          <div class="token-tooltip-row">
            <span class="token-tooltip-label">{{ t('components.input.context') }}</span>
            <span class="token-tooltip-value">{{ formatNumber(props.usedTokens) }} / {{ formatNumber(props.maxContextTokens) }}</span>
          </div>
        </div>
      </div>

      <SendButton
        :disabled="!props.canSend"
        :loading="props.isWaitingForResponse"
        @click="emit('send')"
        @cancel="emit('cancel')"
      />
    </div>
  </div>
</template>

<style scoped>
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
  flex: 0 1 auto;
  min-width: 0;
  max-width: 220px;
}

.composer-selectors.with-thinking-effort {
  flex: 0 1 auto;
  max-width: 300px;
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

.summarize-button :deep(i.codicon) {
  font-size: 14px;
}

.model-selector-wrapper {
  flex: 0 1 auto;
  min-width: 0;
}

.model-selector-wrapper :deep(.unified-model-selector) {
  max-width: 100%;
}

.thinking-effort-wrapper {
  flex: 0 0 78px;
  min-width: 78px;
}

.thinking-effort-wrapper :deep(.custom-select) {
  width: 100%;
}

.chat-mode-wrapper {
  flex: 0 0 78px;
  min-width: 78px;
}

.chat-mode-wrapper :deep(.custom-select) {
  width: 100%;
}

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
</style>
