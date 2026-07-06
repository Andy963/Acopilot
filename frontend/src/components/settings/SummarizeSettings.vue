<script setup lang="ts">
/**
 * SummarizeSettings - 总结设置面板
 * 配置上下文总结功能
 */

import { reactive, ref, computed, onMounted, watch } from 'vue'
import { CustomCheckbox, CustomSelect, type SelectOption } from '../common'
import { sendToExtension } from '@/utils/vscode'
import { useI18n } from '@/i18n'
import type { ModelInfo } from '@/types'
import { useSettingsStore } from '@/stores'

const { t } = useI18n()
const settingsStore = useSettingsStore()

// 渠道配置类型
interface ChannelConfig {
  id: string
  name: string
  type: string
  enabled: boolean
  model: string
  models: ModelInfo[]
}

// 渠道列表
const channels = ref<ChannelConfig[]>([])
const isLoadingChannels = ref(false)

// 总结配置
const summarizeConfig = reactive({
  // 自动总结
  autoSummarize: false,
  // 触发阈值（百分比）
  autoSummarizeThreshold: 80,
  // 总结提示词
  summarizePrompt: '请将以上对话内容进行总结，保留关键信息和上下文要点，去除冗余内容。',
  // 保留最近 N 轮不总结
  keepRecentRounds: 10,
  // 使用专门的总结模型
  useSeparateModel: false,
  // 总结用的渠道 ID
  summarizeChannelId: '',
  // 总结用的模型 ID
  summarizeModelId: ''
})

// 已启用的渠道选项
const enabledChannelOptions = computed<SelectOption[]>(() => {
  return channels.value
    .filter(c => c.enabled)
    .map(c => ({
      value: c.id,
      label: c.name,
      description: c.type
    }))
})

// 当前选择的渠道
const selectedChannel = computed(() => {
  return channels.value.find(c => c.id === summarizeConfig.summarizeChannelId)
})

// 当前渠道的模型选项
const modelOptions = computed<SelectOption[]>(() => {
  if (!selectedChannel.value || !selectedChannel.value.models) {
    return []
  }
  return selectedChannel.value.models.map(m => ({
    value: m.id,
    label: m.name || m.id,
    description: m.description
  }))
})

const selectedSummarizeModelExists = computed(() => {
  if (!summarizeConfig.summarizeModelId) return false
  return modelOptions.value.some(option => option.value === summarizeConfig.summarizeModelId)
})

const separateModelWarning = computed(() => {
  if (!summarizeConfig.useSeparateModel) return ''
  if (!summarizeConfig.summarizeChannelId || !summarizeConfig.summarizeModelId) {
    return t('components.settings.summarizeSettings.modelSection.warningHint')
  }
  if (!selectedChannel.value || !selectedChannel.value.enabled || !selectedSummarizeModelExists.value) {
    return t('components.settings.summarizeSettings.modelSection.invalidSelectionHint')
  }
  return ''
})

function openChannelSettings() {
  settingsStore.showSettings('channel')
}

// 加载渠道列表
async function loadChannels() {
  isLoadingChannels.value = true
  try {
    const ids = await sendToExtension<string[]>('config.listConfigs', {})
    const loadedChannels: ChannelConfig[] = []
    
    for (const id of ids) {
      const config = await sendToExtension<ChannelConfig>('config.getConfig', { configId: id })
      if (config) {
        loadedChannels.push(config)
      }
    }
    
    channels.value = loadedChannels
  } catch (error) {
    console.error('Failed to load channels:', error)
  } finally {
    isLoadingChannels.value = false
  }
}

// 加载配置
async function loadConfig() {
  try {
    const response = await sendToExtension<any>('getSummarizeConfig', {})
    if (response) {
      Object.assign(summarizeConfig, response)
    }
  } catch (error) {
    console.error('Failed to load summarize config:', error)
  }
}

// 更新配置字段（即时保存）
async function updateConfigField(field: string, value: any) {
  // 先更新本地值
  (summarizeConfig as any)[field] = value
  
  // 保存到后端
  try {
    await sendToExtension('updateSummarizeConfig', {
      config: { ...summarizeConfig }
    })
  } catch (error) {
    console.error('Failed to save summarize config:', error)
  }
}

// 更新渠道选择
async function updateChannelId(channelId: string) {
  summarizeConfig.summarizeChannelId = channelId
  // 切换渠道时，清空模型选择
  summarizeConfig.summarizeModelId = ''
  
  // 保存到后端
  try {
    await sendToExtension('updateSummarizeConfig', {
      config: { ...summarizeConfig }
    })
  } catch (error) {
    console.error('Failed to save summarize config:', error)
  }
}

// 更新模型选择
async function updateModelId(modelId: string) {
  summarizeConfig.summarizeModelId = modelId
  
  // 保存到后端
  try {
    await sendToExtension('updateSummarizeConfig', {
      config: { ...summarizeConfig }
    })
  } catch (error) {
    console.error('Failed to save summarize config:', error)
  }
}

// 监听专用模型开关
watch(() => summarizeConfig.useSeparateModel, (enabled) => {
  if (!enabled) {
    // 关闭时清空渠道和模型选择
    summarizeConfig.summarizeChannelId = ''
    summarizeConfig.summarizeModelId = ''
  }
})

// 初始化
onMounted(async () => {
  await Promise.all([loadConfig(), loadChannels()])
})
</script>

<template>
  <div class="summarize-settings">
    <!-- 功能说明 -->
    <div class="feature-description">
      <i class="codicon codicon-info"></i>
      <p>
        {{ t('components.settings.summarizeSettings.description') }}
      </p>
    </div>
    
    <!-- 手动总结说明 -->
    <div class="section">
      <h5 class="section-title">
        <i class="codicon codicon-fold"></i>
        {{ t('components.settings.summarizeSettings.manualSection.title') }}
      </h5>
      <p class="section-description">
        {{ t('components.settings.summarizeSettings.manualSection.description') }}
      </p>
    </div>
    
    <!-- 自动总结设置 -->
    <div class="section">
      <h5 class="section-title">
        <i class="codicon codicon-zap"></i>
        {{ t('components.settings.summarizeSettings.autoSection.title') }}
      </h5>
      
      <div class="form-group">
        <CustomCheckbox
          :model-value="summarizeConfig.autoSummarize"
          :label="t('components.settings.summarizeSettings.autoSection.enable')"
          @update:model-value="(v: boolean) => updateConfigField('autoSummarize', v)"
        />
        <p class="field-hint">{{ t('components.settings.summarizeSettings.autoSection.enableHint') }}</p>
      </div>
      
      <div class="form-group">
        <label>{{ t('components.settings.summarizeSettings.autoSection.threshold') }}</label>
        <div class="threshold-input">
          <input
            type="number"
            :value="summarizeConfig.autoSummarizeThreshold"
            min="50"
            max="95"
            :disabled="!summarizeConfig.autoSummarize"
            @input="(e: any) => updateConfigField('autoSummarizeThreshold', Number(e.target.value))"
          />
          <span class="unit">{{ t('components.settings.summarizeSettings.autoSection.thresholdUnit') }}</span>
        </div>
        <p class="field-hint">{{ t('components.settings.summarizeSettings.autoSection.thresholdHint') }}</p>
      </div>
    </div>
    
    <!-- 总结选项 -->
    <div class="section">
      <h5 class="section-title">
        <i class="codicon codicon-settings"></i>
        {{ t('components.settings.summarizeSettings.optionsSection.title') }}
      </h5>
      
      <div class="form-group">
        <label>{{ t('components.settings.summarizeSettings.optionsSection.keepRounds') }}</label>
        <div class="rounds-input">
          <input
            type="number"
            :value="summarizeConfig.keepRecentRounds"
            min="0"
            max="10"
            @input="(e: any) => updateConfigField('keepRecentRounds', Number(e.target.value))"
          />
          <span class="unit">{{ t('components.settings.summarizeSettings.optionsSection.keepRoundsUnit') }}</span>
        </div>
        <p class="field-hint">{{ t('components.settings.summarizeSettings.optionsSection.keepRoundsHint') }}</p>
      </div>
      
      <div class="form-group">
        <label>{{ t('components.settings.summarizeSettings.optionsSection.prompt') }}</label>
        <textarea
          :value="summarizeConfig.summarizePrompt"
          rows="3"
          :placeholder="t('components.settings.summarizeSettings.optionsSection.promptPlaceholder')"
          @input="(e: any) => updateConfigField('summarizePrompt', e.target.value)"
        ></textarea>
        <p class="field-hint">{{ t('components.settings.summarizeSettings.optionsSection.promptHint') }}</p>
      </div>
    </div>
    
    <!-- 专用总结模型 -->
    <div class="section">
      <h5 class="section-title">
        <i class="codicon codicon-beaker"></i>
        {{ t('components.settings.summarizeSettings.modelSection.title') }}
      </h5>
      
      <div class="form-group">
        <CustomCheckbox
          :model-value="summarizeConfig.useSeparateModel"
          :label="t('components.settings.summarizeSettings.modelSection.useSeparate')"
          @update:model-value="(v: boolean) => updateConfigField('useSeparateModel', v)"
        />
        <p class="field-hint">
          {{ t('components.settings.summarizeSettings.modelSection.useSeparateHint') }}
        </p>
      </div>
      
      <div class="default-model-hint" v-if="!summarizeConfig.useSeparateModel">
        <i class="codicon codicon-info"></i>
        <span>{{ t('components.settings.summarizeSettings.modelSection.currentModelHint') }}</span>
      </div>
      
      <template v-if="summarizeConfig.useSeparateModel">
        <!-- 渠道选择 -->
        <div class="form-group">
          <label>{{ t('components.settings.summarizeSettings.modelSection.selectChannel') }}</label>
          <CustomSelect
            :model-value="summarizeConfig.summarizeChannelId"
            :options="enabledChannelOptions"
            :placeholder="t('components.settings.summarizeSettings.modelSection.selectChannelPlaceholder')"
            @update:model-value="updateChannelId"
          />
          <p class="field-hint">{{ t('components.settings.summarizeSettings.modelSection.selectChannelHint') }}</p>
        </div>
        
        <!-- 模型选择 -->
        <div class="form-group">
          <label>{{ t('components.settings.summarizeSettings.modelSection.selectModel') }}</label>
          <CustomSelect
            :model-value="summarizeConfig.summarizeModelId"
            :options="modelOptions"
            :disabled="!summarizeConfig.summarizeChannelId"
            :placeholder="t('components.settings.summarizeSettings.modelSection.selectModelPlaceholder')"
            @update:model-value="updateModelId"
          />
          <p class="field-hint">
            {{ t('components.settings.summarizeSettings.modelSection.selectModelHint') }}
          </p>
        </div>
        
        <!-- 选择状态提示 -->
        <div v-if="separateModelWarning" class="warning-hint">
          <i class="codicon codicon-warning"></i>
          <span>{{ separateModelWarning }}</span>
          <button type="button" class="text-link-button" @click="openChannelSettings">
            {{ t('components.settings.summarizeSettings.modelSection.openChannelSettings') }}
          </button>
        </div>
      </template>
    </div>
    
  </div>
</template>

<style scoped src="./SummarizeSettings.css"></style>
