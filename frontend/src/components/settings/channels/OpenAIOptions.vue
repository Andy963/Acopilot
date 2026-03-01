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

// 思考强度选项
const effortOptions = computed<SelectOption[]>(() => [
  { value: 'none', label: t('components.channels.openai.thinking.effortNone'), description: '' },
  { value: 'low', label: t('components.channels.openai.thinking.effortLow'), description: '' },
  { value: 'medium', label: t('components.channels.openai.thinking.effortMedium'), description: '' },
  { value: 'high', label: t('components.channels.openai.thinking.effortHigh'), description: '' },
  { value: 'xhigh', label: t('components.channels.openai.thinking.effortXHigh'), description: '' }
])

// 输出详细程度选项
const summaryOptions = computed<SelectOption[]>(() => [
  { value: 'auto', label: t('components.channels.openai.thinking.summaryAuto'), description: '' },
  { value: 'concise', label: t('components.channels.openai.thinking.summaryConcise'), description: '' },
  { value: 'detailed', label: t('components.channels.openai.thinking.summaryDetailed'), description: '' }
])

// 默认配置值
const DEFAULT_VALUES: Record<string, any> = {
  temperature: 1.0,
  max_tokens: 8192,
  top_p: 1.0,
  frequency_penalty: 0,
  presence_penalty: 0,
  reasoning: {
    effort: 'high',
    summaryEnabled: false,
    summary: 'auto'
  }
}

// 检查配置项是否启用
function isOptionEnabled(optionKey: string): boolean {
  const enabled = props.config?.optionsEnabled?.[optionKey]
  return enabled ?? false
}

// 获取思考配置字段值
function getReasoningValue(field: string, defaultValue: any = undefined): any {
  return props.config?.options?.reasoning?.[field] ?? defaultValue
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
function updateReasoning(field: string, value: any) {
  const currentOptions = props.config?.options || {}
  const currentReasoning = currentOptions.reasoning || {}
  // 确保始终包含默认值，防止某些字段丢失
  const updatedReasoning = {
    ...DEFAULT_VALUES.reasoning,  // 首先应用默认值
    ...currentReasoning,          // 然后应用当前值
    [field]: value                // 最后应用新值
  }
  
  emit('update:option', 'reasoning', updatedReasoning)
}

// 处理数字输入变更，允许空值
function handleNumberChange(optionKey: string, event: any) {
  const value = event.target.value
  if (value === '' || value === null || value === undefined) {
    emit('update:option', optionKey, undefined)
  } else {
    emit('update:option', optionKey, Number(value))
  }
}
</script>

<template>
  <div class="openai-options">
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
        :value="config.options?.temperature"
        placeholder="1.0"
        :disabled="!isOptionEnabled('temperature')"
        :class="{ disabled: !isOptionEnabled('temperature') }"
        @input="(e: any) => handleNumberChange('temperature', e)"
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
            :checked="isOptionEnabled('max_tokens')"
            @change="(e: any) => handleOptionEnabledChange('max_tokens', e.target.checked)"
          />
          <span class="toggle-slider"></span>
        </label>
      </div>
      <input
        type="number"
        :value="config.options?.max_tokens"
        :placeholder="t('components.channels.common.maxTokens.placeholder')"
        :disabled="!isOptionEnabled('max_tokens')"
        :class="{ disabled: !isOptionEnabled('max_tokens') }"
        @input="(e: any) => handleNumberChange('max_tokens', e)"
      />
    </div>
    
    <!-- Top-P -->
    <div class="option-item option-with-toggle">
      <div class="option-header">
        <label>{{ t('components.channels.common.topP.label') }}</label>
        <label class="toggle-switch" :title="t('components.channels.common.topP.toggleHint')">
          <input
            type="checkbox"
            :checked="isOptionEnabled('top_p')"
            @change="(e: any) => handleOptionEnabledChange('top_p', e.target.checked)"
          />
          <span class="toggle-slider"></span>
        </label>
      </div>
      <input
        type="number"
        step="0.1"
        min="0"
        max="1"
        :value="config.options?.top_p"
        placeholder="1.0"
        :disabled="!isOptionEnabled('top_p')"
        :class="{ disabled: !isOptionEnabled('top_p') }"
        @input="(e: any) => handleNumberChange('top_p', e)"
      />
      <span class="option-hint">{{ t('components.channels.common.topP.hint') }}</span>
    </div>
    
    <!-- 频率惩罚 -->
    <div class="option-item option-with-toggle">
      <div class="option-header">
        <label>{{ t('components.channels.openai.frequencyPenalty.label') }}</label>
        <label class="toggle-switch" :title="t('components.channels.openai.frequencyPenalty.toggleHint')">
          <input
            type="checkbox"
            :checked="isOptionEnabled('frequency_penalty')"
            @change="(e: any) => handleOptionEnabledChange('frequency_penalty', e.target.checked)"
          />
          <span class="toggle-slider"></span>
        </label>
      </div>
      <input
        type="number"
        step="0.1"
        min="-2"
        max="2"
        :value="config.options?.frequency_penalty"
        placeholder="0"
        :disabled="!isOptionEnabled('frequency_penalty')"
        :class="{ disabled: !isOptionEnabled('frequency_penalty') }"
        @input="(e: any) => handleNumberChange('frequency_penalty', e)"
      />
      <span class="option-hint">{{ t('components.channels.openai.frequencyPenalty.hint') }}</span>
    </div>
    
    <!-- 存在惩罚 -->
    <div class="option-item option-with-toggle">
      <div class="option-header">
        <label>{{ t('components.channels.openai.presencePenalty.label') }}</label>
        <label class="toggle-switch" :title="t('components.channels.openai.presencePenalty.toggleHint')">
          <input
            type="checkbox"
            :checked="isOptionEnabled('presence_penalty')"
            @change="(e: any) => handleOptionEnabledChange('presence_penalty', e.target.checked)"
          />
          <span class="toggle-slider"></span>
        </label>
      </div>
      <input
        type="number"
        step="0.1"
        min="-2"
        max="2"
        :value="config.options?.presence_penalty"
        placeholder="0"
        :disabled="!isOptionEnabled('presence_penalty')"
        :class="{ disabled: !isOptionEnabled('presence_penalty') }"
        @input="(e: any) => handleNumberChange('presence_penalty', e)"
      />
      <span class="option-hint">{{ t('components.channels.openai.presencePenalty.hint') }}</span>
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
            :checked="isOptionEnabled('reasoning')"
            @change="(e: any) => handleOptionEnabledChange('reasoning', e.target.checked)"
          />
          <span class="toggle-slider"></span>
        </label>
      </div>
      
      <div class="option-section-content" :class="{ disabled: !isOptionEnabled('reasoning') }">
        <!-- 思考强度 -->
        <div class="option-item">
          <label>{{ t('components.channels.openai.thinking.effortLabel') }}</label>
          <CustomSelect
            :model-value="getReasoningValue('effort', 'high')"
            :options="effortOptions"
            :disabled="!isOptionEnabled('reasoning')"
            placeholder="选择思考强度"
            @update:model-value="(v: string) => updateReasoning('effort', v)"
          />
          <span class="option-hint">
            {{ t('components.channels.openai.thinking.effortHint') }}
          </span>
        </div>
        
        <!-- 输出详细程度 -->
        <div class="option-item option-with-toggle">
          <div class="option-header">
            <label>{{ t('components.channels.openai.thinking.summaryLabel') }}</label>
            <label class="toggle-switch small" title="启用后此参数将发送到 API">
              <input
                type="checkbox"
                :checked="getReasoningValue('summaryEnabled', false)"
                :disabled="!isOptionEnabled('reasoning')"
                @change="(e: any) => updateReasoning('summaryEnabled', e.target.checked)"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <CustomSelect
            :model-value="getReasoningValue('summary', 'auto')"
            :options="summaryOptions"
            :disabled="!isOptionEnabled('reasoning') || !getReasoningValue('summaryEnabled', false)"
            placeholder="选择输出详细程度"
            @update:model-value="(v: string) => updateReasoning('summary', v)"
          />
          <span class="option-hint">
            {{ t('components.channels.openai.thinking.summaryHint') }}
          </span>
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
        <!-- OAI 不需要签名选项 -->
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
          <span class="option-hint">{{ t('components.channels.openai.historyThinking.sendSignaturesHint') }}</span>
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
          <span class="option-hint">{{ t('components.channels.openai.historyThinking.sendContentHint') }}</span>
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

<style scoped src="./OpenAIOptions.css"></style>
