<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useI18n } from '@/i18n'
import { AVAILABLE_PROMPT_MODULES, CHANNEL_OPTIONS } from './types'
import type { ChannelType } from './types'

const { t } = useI18n()

const props = defineProps<{
  template: string
  isSaving: boolean
  hasChanges: boolean
  saveMessage: string
  selectedChannel: ChannelType
  isCountingTokens: boolean
  tokenCount: number | null
  tokenCountError: string
  validationIssues: Array<{ type: 'error' | 'warning'; message: string }>
  hasBlockingValidationIssues: boolean
}>()

const emit = defineEmits<{
  'update:template': [value: string]
  'update:selectedChannel': [value: ChannelType]
  save: []
  reset: []
  refreshTokenCount: []
}>()

const saveSucceeded = computed(() => props.saveMessage === t('components.settings.promptSettings.saveSuccess'))
const textareaRef = ref<HTMLTextAreaElement>()
const cursorPosition = ref(0)
const autocompleteQuery = computed(() => {
  const beforeCursor = props.template.slice(0, cursorPosition.value)
  const start = beforeCursor.lastIndexOf('{{$')
  if (start < 0) return null
  const value = beforeCursor.slice(start + 3)
  if (value.includes('}') || /\s/.test(value)) return null
  return { start, value: value.toUpperCase() }
})
const variableSuggestions = computed(() => {
  const query = autocompleteQuery.value
  if (!query) return []
  return AVAILABLE_PROMPT_MODULES
    .filter(module => module.id.includes(query.value))
    .slice(0, 6)
})

function formatTokenCount(count: number): string {
  if (count >= 1_000_000) return `${Math.round(count / 1_000_000)}m`
  if (count >= 1_000) return `${Math.round(count / 1_000)}k`
  return String(count)
}

function formatModulePlaceholder(moduleId: string): string {
  return `{{$${moduleId}}}`
}

function handleTemplateInput(event: Event) {
  const target = event.target as HTMLTextAreaElement
  cursorPosition.value = target.selectionStart
  emit('update:template', target.value)
}

function updateCursorPosition() {
  cursorPosition.value = textareaRef.value?.selectionStart || 0
}

async function insertVariable(moduleId: string) {
  const query = autocompleteQuery.value
  if (!query || !textareaRef.value) return

  const nextTemplate = `${props.template.slice(0, query.start)}{{$${moduleId}}}${props.template.slice(cursorPosition.value)}`
  const nextCursor = query.start + moduleId.length + 5
  emit('update:template', nextTemplate)
  await nextTick()
  textareaRef.value.focus()
  textareaRef.value.setSelectionRange(nextCursor, nextCursor)
  cursorPosition.value = nextCursor
}
</script>

<template>
  <div class="template-editor-section">
    <div class="template-section">
      <div class="section-header">
        <label class="section-label">
          <i class="codicon codicon-file-code"></i>
          {{ t('components.settings.promptSettings.templateSection.title') }}
        </label>
        <button class="reset-btn" @click="emit('reset')">
          <i class="codicon codicon-discard"></i>
          {{ t('components.settings.promptSettings.templateSection.resetButton') }}
        </button>
      </div>

      <p class="section-description">
        {{ t('components.settings.promptSettings.templateSection.description') }}
      </p>

      <textarea
        ref="textareaRef"
        :value="template"
        class="template-textarea"
        :placeholder="t('components.settings.promptSettings.templateSection.placeholder')"
        rows="16"
        @input="handleTemplateInput"
        @keyup="updateCursorPosition"
        @click="updateCursorPosition"
      ></textarea>

      <div v-if="variableSuggestions.length > 0" class="variable-autocomplete">
        <button
          v-for="module in variableSuggestions"
          :key="module.id"
          class="variable-suggestion"
          type="button"
          @mousedown.prevent="insertVariable(module.id)"
        >
          <span class="suggestion-id">{{ formatModulePlaceholder(module.id) }}</span>
          <span class="suggestion-name">{{ t(`components.settings.promptSettings.modules.${module.id}.name`) }}</span>
        </button>
      </div>
    </div>

    <div class="save-section">
      <div class="save-row">
        <button
          class="save-btn"
          :disabled="isSaving || !hasChanges || hasBlockingValidationIssues"
          @click="emit('save')"
        >
          <i v-if="isSaving" class="codicon codicon-loading codicon-modifier-spin"></i>
          <span v-else>{{ t('components.settings.promptSettings.saveButton') }}</span>
        </button>
        <span v-if="saveMessage" class="save-message" :class="{ success: saveSucceeded }">
          {{ saveMessage }}
        </span>
      </div>

      <div class="token-count-section">
        <div class="token-count-row">
          <label class="token-label">
            <i class="codicon codicon-symbol-numeric"></i>
            {{ t('components.settings.promptSettings.tokenCount.label') }}
          </label>

          <select
            :value="selectedChannel"
            class="channel-select"
            :title="t('components.settings.promptSettings.tokenCount.channelTooltip')"
            @change="emit('update:selectedChannel', ($event.target as HTMLSelectElement).value as ChannelType)"
          >
            <option v-for="opt in CHANNEL_OPTIONS" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>

          <button
            class="refresh-btn"
            :disabled="isCountingTokens"
            :title="t('components.settings.promptSettings.tokenCount.refreshTooltip')"
            @click="emit('refreshTokenCount')"
          >
            <i :class="['codicon', isCountingTokens ? 'codicon-loading codicon-modifier-spin' : 'codicon-refresh']"></i>
          </button>

          <div class="token-value">
            <template v-if="isCountingTokens">
              <i class="codicon codicon-loading codicon-modifier-spin"></i>
            </template>
            <template v-else-if="tokenCount !== null">
              <span class="token-number">{{ formatTokenCount(tokenCount) }}</span>
              <span class="token-unit">tokens</span>
            </template>
            <template v-else-if="tokenCountError">
              <span class="token-error" :title="tokenCountError">
                <i class="codicon codicon-warning"></i>
                {{ t('components.settings.promptSettings.tokenCount.failed') }}
              </span>
            </template>
            <template v-else>
              <span class="token-na">--</span>
            </template>
          </div>
        </div>

        <p class="token-hint">
          {{ t('components.settings.promptSettings.tokenCount.hint') }}
        </p>

        <div v-if="validationIssues.length > 0" class="validation-panel">
          <div
            v-for="(issue, index) in validationIssues"
            :key="index"
            class="validation-item"
            :class="`validation-${issue.type}`"
          >
            <i :class="['codicon', issue.type === 'error' ? 'codicon-error' : 'codicon-warning']"></i>
            <span>{{ issue.message }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.template-editor-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.template-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
}

.section-description {
  margin: 0;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.template-textarea {
  width: 100%;
  padding: 8px 10px;
  font-size: 12px;
  font-family: var(--vscode-editor-font-family), monospace;
  line-height: 1.5;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border);
  border-radius: 4px;
  resize: vertical;
  outline: none;
}

.template-textarea:focus {
  border-color: var(--vscode-focusBorder);
}

.variable-autocomplete {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px;
  margin-top: -8px;
  background: var(--vscode-dropdown-background);
  border: 1px solid var(--vscode-panel-border);
  border-top: none;
  border-radius: 0 0 4px 4px;
}

.variable-suggestion {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 999px;
  font-size: 11px;
  cursor: pointer;
}

.variable-suggestion:hover {
  background: var(--vscode-button-secondaryHoverBackground);
}

.suggestion-id {
  font-family: var(--vscode-editor-font-family), monospace;
}

.suggestion-name {
  color: var(--vscode-descriptionForeground);
}

.save-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 8px;
}

.save-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.save-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 80px;
  padding: 8px 16px;
  font-size: 13px;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.save-btn:hover:not(:disabled) {
  background: var(--vscode-button-hoverBackground);
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.save-message {
  font-size: 12px;
  color: var(--vscode-errorForeground);
}

.save-message.success {
  color: var(--vscode-terminal-ansiGreen);
}

.token-count-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
}

.token-count-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.token-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--vscode-foreground);
}

.channel-select {
  padding: 4px 8px;
  font-size: 11px;
  background: var(--vscode-dropdown-background);
  color: var(--vscode-dropdown-foreground);
  border: 1px solid var(--vscode-dropdown-border);
  border-radius: 4px;
  outline: none;
  cursor: pointer;
}

.channel-select:focus {
  border-color: var(--vscode-focusBorder);
}

.refresh-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  background: transparent;
  color: var(--vscode-foreground);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.refresh-btn:hover:not(:disabled) {
  background: var(--vscode-list-hoverBackground);
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.token-value {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  font-size: 13px;
}

.token-number {
  font-weight: 600;
  color: var(--vscode-charts-blue);
}

.token-unit {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}

.token-error {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--vscode-errorForeground);
  cursor: help;
}

.token-na {
  color: var(--vscode-descriptionForeground);
}

.token-hint {
  margin: 0;
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}

.validation-panel {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
}

.validation-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 12px;
}

.validation-error {
  color: var(--vscode-errorForeground);
}

.validation-warning {
  color: var(--vscode-editorWarning-foreground);
}

.reset-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  font-size: 11px;
  background: transparent;
  color: var(--vscode-foreground);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.reset-btn:hover:not(:disabled) {
  background: var(--vscode-list-hoverBackground);
}

.reset-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.codicon-modifier-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
