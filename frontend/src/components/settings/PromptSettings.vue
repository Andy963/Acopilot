<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from '@/i18n'
import { sendToExtension } from '@/utils/vscode'
import PromptModulesReference from './prompt/PromptModulesReference.vue'
import PromptSkillsSection from './prompt/PromptSkillsSection.vue'
import PromptTemplateEditorSection from './prompt/PromptTemplateEditorSection.vue'
import { validatePromptTemplate } from './prompt/promptTemplateValidation'
import { DEFAULT_TEMPLATE, normalizeSkills } from './prompt/types'
import type { ChannelType, SkillDefinition, SystemPromptConfig } from './prompt/types'

const { t } = useI18n()

type EditablePromptConfig = Pick<SystemPromptConfig, 'template' | 'customPrefix' | 'customSuffix'>
interface PromptHistoryEntry extends EditablePromptConfig {
  id: string
  savedAt: number
}

interface PromptValidationIssue {
  type: 'error' | 'warning'
  message: string
}

const config = reactive<EditablePromptConfig>({
  template: DEFAULT_TEMPLATE,
  customPrefix: '',
  customSuffix: ''
})

const originalConfig = ref<EditablePromptConfig | null>(null)
const hasChanges = computed(() => {
  if (!originalConfig.value) return false
  return config.template !== originalConfig.value.template ||
    config.customPrefix !== originalConfig.value.customPrefix ||
    config.customSuffix !== originalConfig.value.customSuffix
})

const isLoading = ref(true)
const isSaving = ref(false)
const saveMessage = ref('')
const promptHistory = ref<PromptHistoryEntry[]>([])

const skills = ref<SkillDefinition[]>([])

const tokenCount = ref<number | null>(null)
const isCountingTokens = ref(false)
const tokenCountError = ref('')
const selectedChannel = ref<ChannelType>('gemini')
const HISTORY_STORAGE_KEY = 'acopilot.prompt.templateHistory'
const HISTORY_LIMIT = 10

function snapshotConfig(): EditablePromptConfig {
  return {
    template: config.template,
    customPrefix: config.customPrefix,
    customSuffix: config.customSuffix
  }
}

function loadPromptHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    promptHistory.value = Array.isArray(parsed)
      ? parsed
        .filter((entry): entry is PromptHistoryEntry => entry && typeof entry === 'object' && typeof entry.template === 'string')
        .slice(0, HISTORY_LIMIT)
      : []
  } catch {
    promptHistory.value = []
  }
}

function savePromptHistory() {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(promptHistory.value.slice(0, HISTORY_LIMIT)))
  } catch {
    // Ignore storage failures.
  }
}

function rememberPromptVersion(entry: EditablePromptConfig) {
  const normalizedTemplate = entry.template.trim()
  if (!normalizedTemplate) return

  const latest = promptHistory.value[0]
  if (
    latest &&
    latest.template === entry.template &&
    latest.customPrefix === entry.customPrefix &&
    latest.customSuffix === entry.customSuffix
  ) {
    return
  }

  promptHistory.value = [
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      savedAt: Date.now(),
      ...entry
    },
    ...promptHistory.value
  ].slice(0, HISTORY_LIMIT)
  savePromptHistory()
}

function restorePromptVersion(entry: PromptHistoryEntry) {
  config.template = entry.template
  config.customPrefix = entry.customPrefix || ''
  config.customSuffix = entry.customSuffix || ''
  saveMessage.value = t('components.settings.promptSettings.history.restored')
}

function formatHistoryTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

const validationIssues = computed<PromptValidationIssue[]>(() => {
  return validatePromptTemplate(config.template || '').map(issue => ({
    type: issue.type,
    message: t(`components.settings.promptSettings.validation.${issue.key}`, {
      variables: issue.variables?.join(', ') || ''
    })
  }))
})

const hasBlockingValidationIssues = computed(() => validationIssues.value.some(issue => issue.type === 'error'))

async function loadConfig() {
  isLoading.value = true
  try {
    loadPromptHistory()
    const result = await sendToExtension<SystemPromptConfig>('getSystemPromptConfig', {})
    if (result) {
      config.template = result.template || DEFAULT_TEMPLATE
      config.customPrefix = result.customPrefix || ''
      config.customSuffix = result.customSuffix || ''
      skills.value = normalizeSkills(result.skills)
      originalConfig.value = snapshotConfig()
    }
  } catch (error) {
    console.error('Failed to load system prompt config:', error)
  } finally {
    isLoading.value = false
  }
}

async function saveConfig() {
  if (hasBlockingValidationIssues.value) {
    saveMessage.value = t('components.settings.promptSettings.validation.fixBeforeSave')
    return
  }

  isSaving.value = true
  saveMessage.value = ''
  try {
    if (originalConfig.value) rememberPromptVersion(originalConfig.value)
    await sendToExtension('updateSystemPromptConfig', {
      config: snapshotConfig()
    })
    originalConfig.value = snapshotConfig()
    saveMessage.value = t('components.settings.promptSettings.saveSuccess')
    setTimeout(() => { saveMessage.value = '' }, 2000)
    await countTokens()
  } catch (error) {
    console.error('Failed to save system prompt config:', error)
    saveMessage.value = t('components.settings.promptSettings.saveFailed')
  } finally {
    isSaving.value = false
  }
}

async function countTokens() {
  if (!config.template) {
    tokenCount.value = null
    return
  }

  isCountingTokens.value = true
  tokenCountError.value = ''

  try {
    const result = await sendToExtension<{
      success: boolean
      totalTokens?: number
      error?: string
    }>('countSystemPromptTokens', {
      text: config.template,
      channelType: selectedChannel.value
    })

    if (result?.success && result.totalTokens !== undefined) {
      tokenCount.value = result.totalTokens
    } else {
      tokenCount.value = null
      tokenCountError.value = result?.error || 'Token count failed'
    }
  } catch (error: any) {
    console.error('Failed to count tokens:', error)
    tokenCount.value = null
    tokenCountError.value = error.message || 'Token count failed'
  } finally {
    isCountingTokens.value = false
  }
}

function resetToDefault() {
  rememberPromptVersion(snapshotConfig())
  config.template = DEFAULT_TEMPLATE
}

function insertModule(moduleId: string) {
  config.template += `{{$${moduleId}}}`
}

onMounted(async () => {
  await loadConfig()
  await countTokens()
})

watch(selectedChannel, () => {
  void countTokens()
})
</script>

<template>
  <div class="prompt-settings">
    <div v-if="isLoading" class="loading-state">
      <i class="codicon codicon-loading codicon-modifier-spin"></i>
      <span>{{ t('components.settings.promptSettings.loading') }}</span>
    </div>

    <template v-else>
      <PromptTemplateEditorSection
        :template="config.template"
        :is-saving="isSaving"
        :has-changes="hasChanges"
        :save-message="saveMessage"
        :selected-channel="selectedChannel"
        :is-counting-tokens="isCountingTokens"
        :token-count="tokenCount"
        :token-count-error="tokenCountError"
        :validation-issues="validationIssues"
        :has-blocking-validation-issues="hasBlockingValidationIssues"
        @update:template="config.template = $event"
        @update:selected-channel="selectedChannel = $event"
        @save="saveConfig"
        @reset="resetToDefault"
        @refresh-token-count="countTokens"
      />

      <div class="prompt-history-section">
        <div class="history-header">
          <h5>
            <i class="codicon codicon-history"></i>
            {{ t('components.settings.promptSettings.history.title') }}
          </h5>
          <span class="history-hint">{{ t('components.settings.promptSettings.history.hint') }}</span>
        </div>
        <div v-if="promptHistory.length === 0" class="history-empty">
          {{ t('components.settings.promptSettings.history.empty') }}
        </div>
        <div v-else class="history-list">
          <div v-for="entry in promptHistory" :key="entry.id" class="history-item">
            <div class="history-main">
              <span class="history-time">{{ formatHistoryTime(entry.savedAt) }}</span>
              <span class="history-preview">{{ entry.template.slice(0, 120) }}</span>
            </div>
            <button class="history-restore-btn" @click="restorePromptVersion(entry)">
              <i class="codicon codicon-history"></i>
              {{ t('components.settings.promptSettings.history.restore') }}
            </button>
          </div>
        </div>
      </div>

      <PromptModulesReference @insert-module="insertModule" />

      <PromptSkillsSection
        :skills="skills"
        @update:skills="skills = $event"
      />
    </template>
  </div>
</template>

<style scoped>
.prompt-settings {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px;
  color: var(--vscode-descriptionForeground);
}

.prompt-history-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
}

.history-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.history-header h5 {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 13px;
  font-weight: 500;
}

.history-hint,
.history-empty {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  background: var(--vscode-list-hoverBackground);
  border-radius: 4px;
}

.history-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.history-time {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}

.history-preview {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.history-restore-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 4px 8px;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  background: transparent;
  color: var(--vscode-foreground);
  font-size: 11px;
  cursor: pointer;
}

.history-restore-btn:hover {
  background: var(--vscode-toolbar-hoverBackground);
}

.codicon-modifier-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
