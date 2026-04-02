<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from '@/i18n'
import { sendToExtension } from '@/utils/vscode'
import PromptModulesReference from './prompt/PromptModulesReference.vue'
import PromptSkillsSection from './prompt/PromptSkillsSection.vue'
import PromptTemplateEditorSection from './prompt/PromptTemplateEditorSection.vue'
import { DEFAULT_TEMPLATE, normalizeSkills } from './prompt/types'
import type { ChannelType, SkillDefinition, SystemPromptConfig } from './prompt/types'

const { t } = useI18n()

type EditablePromptConfig = Pick<SystemPromptConfig, 'template' | 'customPrefix' | 'customSuffix'>

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

const skills = ref<SkillDefinition[]>([])

const tokenCount = ref<number | null>(null)
const isCountingTokens = ref(false)
const tokenCountError = ref('')
const selectedChannel = ref<ChannelType>('gemini')

function snapshotConfig(): EditablePromptConfig {
  return {
    template: config.template,
    customPrefix: config.customPrefix,
    customSuffix: config.customSuffix
  }
}

async function loadConfig() {
  isLoading.value = true
  try {
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
  isSaving.value = true
  saveMessage.value = ''
  try {
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
        @update:template="config.template = $event"
        @update:selected-channel="selectedChannel = $event"
        @save="saveConfig"
        @reset="resetToDefault"
        @refresh-token-count="countTokens"
      />

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

.codicon-modifier-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
