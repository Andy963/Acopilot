<script setup lang="ts">
import { computed } from 'vue'
import { CustomSelect, type SelectOption } from '../../common'
import { useI18n } from '../../../i18n'

const { t } = useI18n()

const props = defineProps<{
  config: any
}>()

const emit = defineEmits<{
  (e: 'update:option', optionKey: string, value: any): void
  (e: 'update:optionEnabled', optionKey: string, enabled: boolean, optionValue?: any): void
  (e: 'update:field', field: string, value: any): void
}>()

// 思考等级选项
const thinkingLevelOptions = computed<SelectOption[]>(() => [
  { value: 'minimal', label: t('components.channels.gemini.thinking.levelMinimal'), description: '' },
  { value: 'low', label: t('components.channels.gemini.thinking.levelLow'), description: '' },
  { value: 'medium', label: t('components.channels.gemini.thinking.levelMedium'), description: '' },
  { value: 'high', label: t('components.channels.gemini.thinking.levelHigh'), description: '' }
])

// 默认配置值
const DEFAULT_VALUES: Record<string, any> = {
  temperature: 1.0,
  maxOutputTokens: 8192,
  thinkingConfig: {
    includeThoughts: true,
    mode: 'default',
    thinkingLevel: 'low',
    thinkingBudget: 1024
  }
}

// 检查配置项是否启用
function isOptionEnabled(optionKey: string): boolean {
  const enabled = props.config?.optionsEnabled?.[optionKey]
  return enabled ?? false
}

// 获取思考配置字段值
function getThinkingConfigValue(field: string, defaultValue: any = undefined): any {
  return props.config?.options?.thinkingConfig?.[field] ?? defaultValue
}

// 处理选项启用状态变更
function handleOptionEnabledChange(optionKey: string, enabled: boolean) {
  // 当开启选项时，确保写入默认值（合并已有值和默认值）
  if (enabled && optionKey in DEFAULT_VALUES) {
    const currentValue = props.config?.options?.[optionKey]
    const defaultValue = DEFAULT_VALUES[optionKey]
    
    let optionValue: any
    if (typeof defaultValue === 'object' && defaultValue !== null) {
      // 对象类型：合并默认值和当前值，确保所有默认字段都存在
      optionValue = {
        ...defaultValue,
        ...(currentValue || {})
      }
    } else if (currentValue === undefined || currentValue === null) {
      // 非对象类型：仅当当前值为空时写入默认值
      optionValue = defaultValue
    } else {
      optionValue = currentValue
    }
    
    // 同时发送 optionEnabled 和 option 更新，避免竞态条件
    emit('update:optionEnabled', optionKey, enabled, optionValue)
  } else {
    // 仅更新启用状态
    emit('update:optionEnabled', optionKey, enabled)
  }
}

// 更新思考配置字段
function updateThinkingConfig(field: string, value: any) {
  const currentOptions = props.config?.options || {}
  const currentThinkingConfig = currentOptions.thinkingConfig || {}
  // 确保始终包含默认值，防止某些字段丢失
  const updatedThinkingConfig = {
    ...DEFAULT_VALUES.thinkingConfig,  // 首先应用默认值
    ...currentThinkingConfig,          // 然后应用当前值
    [field]: value                      // 最后应用新值
  }
  
  emit('update:option', 'thinkingConfig', updatedThinkingConfig)
}
</script>

<template>
  <div class="gemini-options">
    <!-- 温度 -->
    <div class="option-item option-with-toggle">
      <div class="option-header">
        <label>{{ t('components.channels.common.temperature.label') }}</label>
        <label class="toggle-switch" :title="t('components.channels.common.temperature.toggleHint')">
          <input
            type="checkbox"
            :checked="isOptionEnabled('temperature')"
            @change="(e: any) => handleOptionEnabledChange('temperature', e.target.checked)"
          />
          <span class="toggle-slider"></span>
        </label>
      </div>
      <input
        type="number"
        step="0.1"
        min="0"
        max="2"
        :value="config.options?.temperature ?? 1.0"
        placeholder="1.0"
        :disabled="!isOptionEnabled('temperature')"
        :class="{ disabled: !isOptionEnabled('temperature') }"
        @input="(e: any) => emit('update:option', 'temperature', Number(e.target.value))"
      />
      <span class="option-hint">{{ t('components.channels.common.temperature.hint') }}</span>
    </div>
    
    <!-- 最大输出 Tokens -->
    <div class="option-item option-with-toggle">
      <div class="option-header">
        <label>{{ t('components.channels.common.maxTokens.label') }}</label>
        <label class="toggle-switch" :title="t('components.channels.common.maxTokens.toggleHint')">
          <input
            type="checkbox"
            :checked="isOptionEnabled('maxOutputTokens')"
            @change="(e: any) => handleOptionEnabledChange('maxOutputTokens', e.target.checked)"
          />
          <span class="toggle-slider"></span>
        </label>
      </div>
      <input
        type="number"
        :value="config.options?.maxOutputTokens ?? 8192"
        placeholder="8192"
        :disabled="!isOptionEnabled('maxOutputTokens')"
        :class="{ disabled: !isOptionEnabled('maxOutputTokens') }"
        @input="(e: any) => emit('update:option', 'maxOutputTokens', Number(e.target.value))"
      />
    </div>
    
    <!-- 思考配置 -->
    <div class="option-section">
      <div class="option-section-header">
        <span class="option-section-title">
          <i class="codicon codicon-lightbulb"></i>
          {{ t('components.channels.common.thinking.title') }}
        </span>
        <label class="toggle-switch" :title="t('components.channels.common.thinking.toggleHint')">
          <input
            type="checkbox"
            :checked="isOptionEnabled('thinkingConfig')"
            @change="(e: any) => handleOptionEnabledChange('thinkingConfig', e.target.checked)"
          />
          <span class="toggle-slider"></span>
        </label>
      </div>
      
      <div class="option-section-content" :class="{ disabled: !isOptionEnabled('thinkingConfig') }">
        <!-- 包含思考内容 -->
        <div class="option-item checkbox-option">
          <label class="custom-checkbox">
            <input
              type="checkbox"
              :checked="getThinkingConfigValue('includeThoughts', false)"
              :disabled="!isOptionEnabled('thinkingConfig')"
              @change="(e: any) => updateThinkingConfig('includeThoughts', e.target.checked)"
            />
            <span class="checkmark"></span>
            <span class="checkbox-text">{{ t('components.channels.gemini.thinking.includeThoughts') }}</span>
          </label>
          <span class="option-hint">{{ t('components.channels.gemini.thinking.includeThoughtsHint') }}</span>
        </div>
        
        <!-- 思考模式 -->
        <div class="option-item">
          <label>{{ t('components.channels.gemini.thinking.mode') }}</label>
          <div class="radio-group">
            <label class="radio-option" :class="{ disabled: !isOptionEnabled('thinkingConfig') }">
              <input
                type="radio"
                name="thinkingMode"
                value="default"
                :checked="getThinkingConfigValue('mode', 'default') === 'default'"
                :disabled="!isOptionEnabled('thinkingConfig')"
                @change="updateThinkingConfig('mode', 'default')"
              />
              <span class="radio-mark"></span>
              <span class="radio-text">{{ t('components.channels.gemini.thinking.modeDefault') }}</span>
            </label>
            <label class="radio-option" :class="{ disabled: !isOptionEnabled('thinkingConfig') }">
              <input
                type="radio"
                name="thinkingMode"
                value="level"
                :checked="getThinkingConfigValue('mode', 'default') === 'level'"
                :disabled="!isOptionEnabled('thinkingConfig')"
                @change="updateThinkingConfig('mode', 'level')"
              />
              <span class="radio-mark"></span>
              <span class="radio-text">{{ t('components.channels.gemini.thinking.modeLevel') }}</span>
            </label>
            <label class="radio-option" :class="{ disabled: !isOptionEnabled('thinkingConfig') }">
              <input
                type="radio"
                name="thinkingMode"
                value="budget"
                :checked="getThinkingConfigValue('mode', 'default') === 'budget'"
                :disabled="!isOptionEnabled('thinkingConfig')"
                @change="updateThinkingConfig('mode', 'budget')"
              />
              <span class="radio-mark"></span>
              <span class="radio-text">{{ t('components.channels.gemini.thinking.modeBudget') }}</span>
            </label>
          </div>
          <span class="option-hint">{{ t('components.channels.gemini.thinking.modeHint') }}</span>
        </div>
        
        <!-- 思考等级（等级模式下显示） -->
        <div v-if="getThinkingConfigValue('mode', 'default') === 'level'" class="option-item">
          <label>{{ t('components.channels.gemini.thinking.levelLabel') }}</label>
          <CustomSelect
            :model-value="getThinkingConfigValue('thinkingLevel', 'low')"
            :options="thinkingLevelOptions"
            :disabled="!isOptionEnabled('thinkingConfig')"
            placeholder="选择思考等级"
            @update:model-value="(v: string) => updateThinkingConfig('thinkingLevel', v)"
          />
          <span class="option-hint">{{ t('components.channels.gemini.thinking.levelHint') }}</span>
        </div>
        
        <!-- 思考预算（预算模式下显示） -->
        <div v-if="getThinkingConfigValue('mode', 'default') === 'budget'" class="option-item">
          <label>{{ t('components.channels.gemini.thinking.budgetLabel') }}</label>
          <input
            type="number"
            :value="getThinkingConfigValue('thinkingBudget', 1024)"
            :placeholder="t('components.channels.gemini.thinking.budgetPlaceholder')"
            :disabled="!isOptionEnabled('thinkingConfig')"
            :class="{ disabled: !isOptionEnabled('thinkingConfig') }"
            @input="(e: any) => updateThinkingConfig('thinkingBudget', Number(e.target.value))"
          />
          <span class="option-hint">{{ t('components.channels.gemini.thinking.budgetHint') }}</span>
        </div>
      </div>
    </div>
    
    <!-- 当前轮次思考配置 -->
    <div class="option-section">
      <div class="option-section-header">
        <span class="option-section-title">
          <i class="codicon codicon-zap"></i>
          {{ t('components.channels.common.currentThinking.title') }}
        </span>
      </div>
      
      <div class="option-section-content">
        <div class="option-item checkbox-option">
          <label class="custom-checkbox">
            <input
              type="checkbox"
              :checked="config.sendCurrentThoughtSignatures ?? true"
              @change="(e: any) => emit('update:field', 'sendCurrentThoughtSignatures', e.target.checked)"
            />
            <span class="checkmark"></span>
            <span class="checkbox-text">{{ t('components.channels.common.currentThinking.sendSignatures') }}</span>
          </label>
          <span class="option-hint">{{ t('components.channels.common.currentThinking.sendSignaturesHint') }}</span>
        </div>
        
        <div class="option-item checkbox-option">
          <label class="custom-checkbox">
            <input
              type="checkbox"
              :checked="config.sendCurrentThoughts ?? false"
              @change="(e: any) => emit('update:field', 'sendCurrentThoughts', e.target.checked)"
            />
            <span class="checkmark"></span>
            <span class="checkbox-text">{{ t('components.channels.common.currentThinking.sendContent') }}</span>
          </label>
          <span class="option-hint">{{ t('components.channels.common.currentThinking.sendContentHint') }}</span>
        </div>
      </div>
    </div>

    <!-- 历史思考配置 -->
    <div class="option-section history-thought-section">
      <div class="option-section-header">
        <span class="option-section-title">
          <i class="codicon codicon-history"></i>
          {{ t('components.channels.common.historyThinking.title') }}
        </span>
      </div>
      
      <div class="option-section-content">
        <div class="option-item checkbox-option">
          <label class="custom-checkbox">
            <input
              type="checkbox"
              :checked="config.sendHistoryThoughtSignatures ?? false"
              @change="(e: any) => emit('update:field', 'sendHistoryThoughtSignatures', e.target.checked)"
            />
            <span class="checkmark"></span>
            <span class="checkbox-text">{{ t('components.channels.common.historyThinking.sendSignatures') }}</span>
          </label>
          <span class="option-hint">{{ t('components.channels.common.historyThinking.sendSignaturesHint') }}</span>
        </div>
        
        <div class="option-item checkbox-option">
          <label class="custom-checkbox">
            <input
              type="checkbox"
              :checked="config.sendHistoryThoughts ?? false"
              @change="(e: any) => emit('update:field', 'sendHistoryThoughts', e.target.checked)"
            />
            <span class="checkmark"></span>
            <span class="checkbox-text">{{ t('components.channels.common.historyThinking.sendContent') }}</span>
          </label>
          <span class="option-hint">{{ t('components.channels.gemini.historyThinking.sendContentHint') }}</span>
        </div>
        
        <!-- 历史思考回合数配置 - 条件展开 -->
        <div
          v-if="(config.sendHistoryThoughtSignatures ?? false) || (config.sendHistoryThoughts ?? false)"
          class="option-item history-rounds-config"
        >
          <label>{{ t('components.channels.common.historyThinking.roundsLabel') }}</label>
          <input
            type="number"
            :value="config.historyThinkingRounds ?? -1"
            placeholder="-1"
            min="-1"
            @input="(e: any) => emit('update:field', 'historyThinkingRounds', Number(e.target.value))"
          />
          <span class="option-hint">{{ t('components.channels.common.historyThinking.roundsHint') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="./GeminiOptions.css"></style>
