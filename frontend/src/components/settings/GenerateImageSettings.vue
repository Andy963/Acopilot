<script setup lang="ts">
/**
 * GenerateImageSettings - 图像生成工具设置面板
 * 配置图像生成 API 和默认参数
 */

import { reactive, ref, onMounted, computed } from 'vue'
import { CustomSelect, CustomCheckbox, type SelectOption } from '../common'
import { sendToExtension } from '@/utils/vscode'
import { useI18n } from '@/i18n'

const { t } = useI18n()

type ImageProvider = 'gemini' | 'together'

const GEMINI_DEFAULT_URL = 'https://generativelanguage.googleapis.com/v1beta'
const GEMINI_DEFAULT_MODEL = 'gemini-3-pro-image-preview'

const TOGETHER_DEFAULT_URL = 'https://api.together.xyz/v1'
const TOGETHER_DEFAULT_MODEL = 'google/flash-image-2.5'

// 图像生成配置
const imageConfig = reactive({
  provider: 'gemini' as ImageProvider,
  url: GEMINI_DEFAULT_URL,
  apiKey: '',
  model: GEMINI_DEFAULT_MODEL,
  enableAspectRatio: false,
  defaultAspectRatio: '',
  enableImageSize: false,
  defaultImageSize: '',
  maxBatchTasks: 5,
  maxImagesPerTask: 1
})

// API Key 显示状态
const showApiKey = ref(false)
const isTestingConnection = ref(false)
const testConnectionResult = ref<{ success: boolean; message: string } | null>(null)

function detectProvider(url: string, model: string): ImageProvider {
  const u = String(url || '').toLowerCase()
  const m = String(model || '').toLowerCase()
  if (u.includes('together') || u.includes('/images/generations') || m.includes('/')) return 'together'
  return 'gemini'
}

const currentProvider = computed<ImageProvider>(() => imageConfig.provider || detectProvider(imageConfig.url, imageConfig.model))
const isTogetherProvider = computed(() => currentProvider.value === 'together')

const providerOptions = computed<SelectOption[]>(() => [
  {
    value: 'gemini',
    label: t('components.settings.generateImageSettings.api.providerOptions.gemini'),
    description: 'Google Generative Language API'
  },
  {
    value: 'together',
    label: t('components.settings.generateImageSettings.api.providerOptions.together'),
    description: 'Together Images API (/v1/images/generations)'
  }
])

const modelPresetOptions = computed<SelectOption[]>(() => {
  if (currentProvider.value === 'together') {
    return [
      { value: 'google/gemini-3-pro-image', label: 'google/gemini-3-pro-image' },
      { value: 'google/flash-image-2.5', label: 'google/flash-image-2.5' },
      { value: 'black-forest-labs/FLUX.2-pro', label: 'black-forest-labs/FLUX.2-pro' }
    ]
  }

  return [
    { value: GEMINI_DEFAULT_MODEL, label: GEMINI_DEFAULT_MODEL }
  ]
})

const selectedModelPreset = computed(() => {
  return modelPresetOptions.value.some(opt => opt.value === imageConfig.model) ? imageConfig.model : ''
})

const urlPlaceholder = computed(() =>
  currentProvider.value === 'together' ? TOGETHER_DEFAULT_URL : t('components.settings.generateImageSettings.api.urlPlaceholder')
)

const modelPlaceholder = computed(() =>
  currentProvider.value === 'together' ? TOGETHER_DEFAULT_MODEL : t('components.settings.generateImageSettings.api.modelPlaceholder')
)

// 宽高比选项
const aspectRatioOptions = computed<SelectOption[]>(() => [
  { value: '', label: t('components.settings.generateImageSettings.aspectRatio.options.auto'), description: t('components.settings.generateImageSettings.aspectRatio.options.auto') },
  { value: '1:1', label: '1:1', description: t('components.settings.generateImageSettings.aspectRatio.options.square') },
  { value: '3:2', label: '3:2', description: t('components.settings.generateImageSettings.aspectRatio.options.landscape') },
  { value: '2:3', label: '2:3', description: t('components.settings.generateImageSettings.aspectRatio.options.portrait') },
  { value: '3:4', label: '3:4', description: t('components.settings.generateImageSettings.aspectRatio.options.portrait') },
  { value: '4:3', label: '4:3', description: t('components.settings.generateImageSettings.aspectRatio.options.landscape') },
  { value: '4:5', label: '4:5', description: t('components.settings.generateImageSettings.aspectRatio.options.portrait') },
  { value: '5:4', label: '5:4', description: t('components.settings.generateImageSettings.aspectRatio.options.landscape') },
  { value: '9:16', label: '9:16', description: t('components.settings.generateImageSettings.aspectRatio.options.mobilePortrait') },
  { value: '16:9', label: '16:9', description: t('components.settings.generateImageSettings.aspectRatio.options.widescreen') },
  { value: '21:9', label: '21:9', description: t('components.settings.generateImageSettings.aspectRatio.options.ultrawide') }
])

// 图片尺寸选项
const imageSizeOptions = computed<SelectOption[]>(() => [
  { value: '', label: t('components.settings.generateImageSettings.imageSize.options.auto'), description: t('components.settings.generateImageSettings.imageSize.options.auto') },
  { value: '1K', label: '1K', description: '1024px' },
  { value: '2K', label: '2K', description: '2048px' },
  { value: '4K', label: '4K', description: '4096px' }
])

// 加载配置
async function loadConfig() {
  try {
    const response = await sendToExtension<any>('getGenerateImageConfig', {})
    if (response) {
      Object.assign(imageConfig, response)
    }
  } catch (error) {
    console.error('Failed to load generate image config:', error)
  }
}

async function updateConfig(patch: Record<string, any>) {
  Object.assign(imageConfig as any, patch)
  testConnectionResult.value = null
  try {
    await sendToExtension('updateGenerateImageConfig', {
      config: { ...imageConfig }
    })
  } catch (error) {
    console.error('Failed to save generate image config:', error)
  }
}

// 更新配置字段（即时保存）
async function updateConfigField(field: string, value: any) {
  // 先更新本地值
  (imageConfig as any)[field] = value
  testConnectionResult.value = null
  
  // 保存到后端
  try {
    await sendToExtension('updateGenerateImageConfig', {
      config: { ...imageConfig }
    })
  } catch (error) {
    console.error('Failed to save generate image config:', error)
  }
}

async function handleProviderChange(provider: ImageProvider) {
  if (provider === currentProvider.value) return

  if (provider === 'together') {
    const patch: Record<string, any> = {
      provider,
      enableAspectRatio: false,
      defaultAspectRatio: undefined,
      enableImageSize: false,
      defaultImageSize: undefined,
    }
    if (!imageConfig.url || String(imageConfig.url).toLowerCase().includes('generativelanguage.googleapis.com')) {
      patch.url = TOGETHER_DEFAULT_URL
    }
    if (!imageConfig.model || !String(imageConfig.model).includes('/')) {
      patch.model = TOGETHER_DEFAULT_MODEL
    }
    await updateConfig(patch)
    return
  }

  const patch: Record<string, any> = { provider }
  if (!imageConfig.url || String(imageConfig.url).toLowerCase().includes('together') || String(imageConfig.url).includes('/images/generations')) {
    patch.url = GEMINI_DEFAULT_URL
  }
  if (!imageConfig.model || String(imageConfig.model).includes('/')) {
    patch.model = GEMINI_DEFAULT_MODEL
  }
  await updateConfig(patch)
}

async function handleModelPresetChange(model: string) {
  const value = String(model || '').trim()
  if (!value) return

  const patch: Record<string, any> = { model: value }

  // If user selects a Together model but still has Gemini base URL, switch to Together endpoint automatically.
  if (value.includes('/') && String(imageConfig.url).toLowerCase().includes('generativelanguage.googleapis.com')) {
    patch.url = TOGETHER_DEFAULT_URL
  }

  await updateConfig(patch)
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(value), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

async function updateBoundedNumber(field: 'maxBatchTasks' | 'maxImagesPerTask', value: unknown, fallback: number, min: number, max: number) {
  await updateConfigField(field, clampNumber(value, fallback, min, max))
}

async function testConnection() {
  isTestingConnection.value = true
  testConnectionResult.value = null
  try {
    const result = await sendToExtension<{ success: boolean; provider?: string; model?: string; error?: string }>('testGenerateImageConnection', {
      config: { ...imageConfig }
    })
    testConnectionResult.value = result.success
      ? { success: true, message: t('components.settings.generateImageSettings.api.testSuccess', { provider: result.provider || currentProvider.value, model: result.model || imageConfig.model }) }
      : { success: false, message: result.error || t('components.settings.generateImageSettings.api.testFailed') }
  } catch (error) {
    testConnectionResult.value = {
      success: false,
      message: error instanceof Error ? error.message : String(error)
    }
  } finally {
    isTestingConnection.value = false
  }
}

// 初始化
onMounted(async () => {
  await loadConfig()
})
</script>

<template>
  <div class="generate-image-settings">
    <!-- 功能说明 -->
    <div class="feature-description">
      <i class="codicon codicon-image"></i>
      <p>{{ t('components.settings.generateImageSettings.description') }}</p>
    </div>
    
    <!-- API 配置 -->
    <div class="section">
      <h5 class="section-title">
        <i class="codicon codicon-plug"></i>
        {{ t('components.settings.generateImageSettings.api.title') }}
      </h5>

      <div class="form-group">
        <label>{{ t('components.settings.generateImageSettings.api.provider') }}</label>
        <CustomSelect
          :model-value="currentProvider"
          :options="providerOptions"
          @update:model-value="(v: string) => handleProviderChange(v as ImageProvider)"
        />
        <p class="field-hint">{{ t('components.settings.generateImageSettings.api.providerHint') }}</p>
      </div>
      
      <div class="form-group">
        <label>{{ t('components.settings.generateImageSettings.api.url') }}</label>
        <input
          type="text"
          :value="imageConfig.url"
          :placeholder="urlPlaceholder"
          @input="(e: any) => updateConfigField('url', e.target.value)"
        />
        <p class="field-hint">{{ t('components.settings.generateImageSettings.api.urlHint') }}</p>
      </div>
      
      <div class="form-group">
        <label>{{ t('components.settings.generateImageSettings.api.apiKey') }}</label>
        <div class="input-with-action">
          <input
            :type="showApiKey ? 'text' : 'password'"
            :value="imageConfig.apiKey"
            :placeholder="t('components.settings.generateImageSettings.api.apiKeyPlaceholder')"
            @input="(e: any) => updateConfigField('apiKey', e.target.value)"
          />
          <button
            class="input-action-btn"
            :title="showApiKey ? t('components.settings.generateImageSettings.api.hide') : t('components.settings.generateImageSettings.api.show')"
            @click="showApiKey = !showApiKey"
          >
            <i :class="['codicon', showApiKey ? 'codicon-eye-closed' : 'codicon-eye']"></i>
          </button>
        </div>
        <p class="field-hint">{{ t('components.settings.generateImageSettings.api.apiKeyHint') }}</p>
      </div>
      
      <div class="form-group">
        <label>{{ t('components.settings.generateImageSettings.api.model') }}</label>
        <input
          type="text"
          :value="imageConfig.model"
          :placeholder="modelPlaceholder"
          @input="(e: any) => updateConfigField('model', e.target.value)"
        />
        <p class="field-hint">{{ t('components.settings.generateImageSettings.api.modelHint') }}</p>
      </div>

      <div class="form-group">
        <label>{{ t('components.settings.generateImageSettings.api.modelPreset') }}</label>
        <CustomSelect
          :model-value="selectedModelPreset"
          :options="modelPresetOptions"
          :placeholder="t('components.settings.generateImageSettings.api.modelPresetPlaceholder')"
          @update:model-value="(v: string) => handleModelPresetChange(v)"
        />
        <p class="field-hint">{{ t('components.settings.generateImageSettings.api.modelPresetHint') }}</p>
      </div>

      <div class="connection-test">
        <button
          class="test-connection-btn"
          :disabled="isTestingConnection || !imageConfig.apiKey || !imageConfig.model || !imageConfig.url"
          @click="testConnection"
        >
          <i :class="['codicon', isTestingConnection ? 'codicon-loading codicon-modifier-spin' : 'codicon-debug-start']"></i>
          {{ t('components.settings.generateImageSettings.api.testConnection') }}
        </button>
        <span
          v-if="testConnectionResult"
          :class="['connection-result', testConnectionResult.success ? 'success' : 'error']"
        >
          <i :class="['codicon', testConnectionResult.success ? 'codicon-check' : 'codicon-error']"></i>
          {{ testConnectionResult.message }}
        </span>
      </div>
    </div>
    
    <!-- 宽高比参数 -->
    <div class="section" :class="{ 'provider-disabled': isTogetherProvider }">
      <h5 class="section-title">
        <i class="codicon codicon-symbol-ruler"></i>
        {{ t('components.settings.generateImageSettings.aspectRatio.title') }}
      </h5>
      
      <CustomCheckbox
        :model-value="imageConfig.enableAspectRatio"
        :label="t('components.settings.generateImageSettings.aspectRatio.enable')"
        :disabled="isTogetherProvider"
        @update:model-value="(v: boolean) => updateConfigField('enableAspectRatio', v)"
      />
      
      <div class="form-group" :class="{ disabled: isTogetherProvider || !imageConfig.enableAspectRatio }">
        <label>{{ t('components.settings.generateImageSettings.aspectRatio.fixedRatio') }}</label>
        <CustomSelect
          :model-value="imageConfig.defaultAspectRatio || ''"
          :options="aspectRatioOptions"
          :placeholder="t('components.settings.generateImageSettings.aspectRatio.placeholder')"
          :disabled="isTogetherProvider || !imageConfig.enableAspectRatio"
          @update:model-value="(v: string) => updateConfigField('defaultAspectRatio', v || undefined)"
        />
        <p class="field-hint">
          <template v-if="isTogetherProvider">
            {{ t('components.settings.generateImageSettings.aspectRatio.hints.together') }}
          </template>
          <template v-else-if="!imageConfig.enableAspectRatio">
            {{ t('components.settings.generateImageSettings.aspectRatio.hints.disabled') }}
          </template>
          <template v-else-if="imageConfig.defaultAspectRatio">
            {{ t('components.settings.generateImageSettings.aspectRatio.hints.fixed', { ratio: imageConfig.defaultAspectRatio }) }}
          </template>
          <template v-else>
            {{ t('components.settings.generateImageSettings.aspectRatio.hints.flexible') }}
          </template>
        </p>
      </div>
    </div>
    
    <!-- 图片尺寸参数 -->
    <div class="section" :class="{ 'provider-disabled': isTogetherProvider }">
      <h5 class="section-title">
        <i class="codicon codicon-screen-full"></i>
        {{ t('components.settings.generateImageSettings.imageSize.title') }}
      </h5>
      
      <CustomCheckbox
        :model-value="imageConfig.enableImageSize"
        :label="t('components.settings.generateImageSettings.imageSize.enable')"
        :disabled="isTogetherProvider"
        @update:model-value="(v: boolean) => updateConfigField('enableImageSize', v)"
      />
      
      <div class="form-group" :class="{ disabled: isTogetherProvider || !imageConfig.enableImageSize }">
        <label>{{ t('components.settings.generateImageSettings.imageSize.fixedSize') }}</label>
        <CustomSelect
          :model-value="imageConfig.defaultImageSize || ''"
          :options="imageSizeOptions"
          :placeholder="t('components.settings.generateImageSettings.imageSize.placeholder')"
          :disabled="isTogetherProvider || !imageConfig.enableImageSize"
          @update:model-value="(v: string) => updateConfigField('defaultImageSize', v || undefined)"
        />
        <p class="field-hint">
          <template v-if="isTogetherProvider">
            {{ t('components.settings.generateImageSettings.imageSize.hints.together') }}
          </template>
          <template v-else-if="!imageConfig.enableImageSize">
            {{ t('components.settings.generateImageSettings.imageSize.hints.disabled') }}
          </template>
          <template v-else-if="imageConfig.defaultImageSize">
            {{ t('components.settings.generateImageSettings.imageSize.hints.fixed', { size: imageConfig.defaultImageSize }) }}
          </template>
          <template v-else>
            {{ t('components.settings.generateImageSettings.imageSize.hints.flexible') }}
          </template>
        </p>
      </div>
    </div>
    
    <!-- 批量生成限制 -->
    <div class="section">
      <h5 class="section-title">
        <i class="codicon codicon-layers"></i>
        {{ t('components.settings.generateImageSettings.batch.title') }}
      </h5>
      
      <div class="form-group">
        <label>{{ t('components.settings.generateImageSettings.batch.maxTasks') }}</label>
        <input
          type="number"
          :value="imageConfig.maxBatchTasks"
          min="1"
          max="20"
          @input="(e: any) => updateBoundedNumber('maxBatchTasks', e.target.value, 5, 1, 20)"
        />
        <p class="field-hint">{{ t('components.settings.generateImageSettings.batch.maxTasksHint') }}</p>
      </div>
      
      <div class="form-group">
        <label>{{ t('components.settings.generateImageSettings.batch.maxImagesPerTask') }}</label>
        <input
          type="number"
          :value="imageConfig.maxImagesPerTask"
          min="1"
          max="10"
          @input="(e: any) => updateBoundedNumber('maxImagesPerTask', e.target.value, 1, 1, 10)"
        />
        <p class="field-hint">{{ t('components.settings.generateImageSettings.batch.maxImagesPerTaskHint') }}</p>
      </div>
      
      <div class="limits-summary">
        <i class="codicon codicon-info"></i>
        <span>{{ t('components.settings.generateImageSettings.batch.summary', { maxTasks: imageConfig.maxBatchTasks, maxImages: imageConfig.maxImagesPerTask }) }}</span>
      </div>
    </div>
    
    <!-- 使用说明 -->
    <div class="section">
      <h5 class="section-title">
        <i class="codicon codicon-question"></i>
        {{ t('components.settings.generateImageSettings.usage.title') }}
      </h5>
      
      <div class="usage-notes">
        <div class="note-item">
          <span class="note-number">1</span>
          <span class="note-text">{{ t('components.settings.generateImageSettings.usage.step1') }}</span>
        </div>
        <div class="note-item">
          <span class="note-number">2</span>
          <span class="note-text">{{ t('components.settings.generateImageSettings.usage.step2') }}</span>
        </div>
        <div class="note-item">
          <span class="note-number">3</span>
          <span class="note-text">{{ t('components.settings.generateImageSettings.usage.step3') }}</span>
        </div>
        <div class="note-item">
          <span class="note-number">4</span>
          <span class="note-text">{{ t('components.settings.generateImageSettings.usage.step4') }}</span>
        </div>
      </div>
      
      <div class="warning-hint" v-if="!imageConfig.apiKey">
        <i class="codicon codicon-warning"></i>
        <span>{{ t('components.settings.generateImageSettings.usage.warning') }}</span>
      </div>
    </div>
    
  </div>
</template>

<style scoped src="./GenerateImageSettings.css"></style>
