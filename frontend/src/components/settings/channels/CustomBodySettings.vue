<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CustomScrollbar } from '../../common'
import { useI18n } from '../../../i18n'

const { t } = useI18n()

// 自定义 body 项类型
interface CustomBodyItem {
  key: string
  value: string
  enabled: boolean
}

// 自定义 body 配置类型
interface CustomBodyConfig {
  mode: 'simple' | 'advanced'
  items?: CustomBodyItem[]
  json?: string
}

const props = defineProps<{
  customBody: CustomBodyConfig
  enabled: boolean
}>()

const emit = defineEmits<{
  (e: 'update:enabled', value: boolean): void
  (e: 'update:config', config: CustomBodyConfig): void
}>()

// 简单模式下的项目列表
const customBodyItems = computed<CustomBodyItem[]>(() => {
  return props.customBody.items || []
})

// 复杂模式下的 JSON - 使用本地状态保持编辑内容
const localJsonValue = ref('')

// JSON 解析错误
const jsonError = ref('')

// 监听配置变化，同步到本地状态（仅当本地没有错误时）
watch(() => props.customBody.json, (newJson) => {
  if (!jsonError.value) {
    localJsonValue.value = newJson || ''
  }
}, { immediate: true })

// 更新模式
function updateMode(mode: 'simple' | 'advanced') {
  emit('update:config', {
    ...props.customBody,
    mode
  })
}

// 添加新 body 项（简单模式）
function addItem() {
  const items = [...customBodyItems.value, { key: '', value: '', enabled: true }]
  emit('update:config', {
    ...props.customBody,
    items
  })
}

// 删除 body 项
function removeItem(index: number) {
  const items = customBodyItems.value.filter((_, i) => i !== index)
  emit('update:config', {
    ...props.customBody,
    items
  })
}

// 更新 body 项字段
function updateItem(index: number, field: 'key' | 'value' | 'enabled', value: string | boolean) {
  const items = [...customBodyItems.value]
  if (items[index]) {
    items[index] = { ...items[index], [field]: value }
    emit('update:config', {
      ...props.customBody,
      items
    })
  }
}

// 更新本地 JSON 值（实时输入）
function handleJsonInput(e: Event) {
  const target = e.target as HTMLTextAreaElement
  localJsonValue.value = target.value
  
  // 实时验证 JSON
  try {
    if (target.value.trim()) {
      JSON.parse(target.value)
    }
    jsonError.value = ''
  } catch {
    jsonError.value = 'JSON 格式错误'
  }
}

// 保存复杂模式 JSON（失焦时）
function saveJson() {
  // 如果有错误，不保存
  if (jsonError.value) {
    return
  }
  
  emit('update:config', {
    ...props.customBody,
    json: localJsonValue.value
  })
}
</script>

<template>
  <div class="custom-body-panel">
    <div class="body-hint">
      {{ t('components.channels.customBody.hint') }}
    </div>
    
    <!-- 模式选择 -->
    <div class="body-mode-selector" :class="{ disabled: !enabled }">
      <label class="radio-option" :class="{ disabled: !enabled }">
        <input
          type="radio"
          name="bodyMode"
          value="simple"
          :checked="customBody.mode === 'simple'"
          :disabled="!enabled"
          @change="updateMode('simple')"
        />
        <span class="radio-mark"></span>
        <span class="radio-text">简单模式</span>
      </label>
      <label class="radio-option" :class="{ disabled: !enabled }">
        <input
          type="radio"
          name="bodyMode"
          value="advanced"
          :checked="customBody.mode === 'advanced'"
          :disabled="!enabled"
          @change="updateMode('advanced')"
        />
        <span class="radio-mark"></span>
        <span class="radio-text">复杂模式</span>
      </label>
    </div>
    
    <!-- 简单模式：键值对列表 -->
    <div v-if="customBody.mode === 'simple'" class="body-items-wrapper" :class="{ disabled: !enabled }">
      <CustomScrollbar :max-height="300" :width="5" :offset="1">
        <div class="body-items-list">
          <div
            v-for="(item, index) in customBodyItems"
            :key="index"
            class="body-item"
          >
        <label class="body-checkbox" :title="item.enabled ? t('components.channels.customBody.enabled') : t('components.channels.customBody.disabled')">
          <input
            type="checkbox"
            :checked="item.enabled"
            :disabled="!enabled"
            @change="(e: any) => updateItem(index, 'enabled', e.target.checked)"
          />
          <span class="body-checkmark"></span>
        </label>
        
        <div class="body-inputs">
          <input
            type="text"
            class="body-key"
            :value="item.key"
            :placeholder="t('components.channels.customBody.keyPlaceholder')"
            :disabled="!enabled"
            @input="(e: any) => updateItem(index, 'key', e.target.value)"
          />
          <textarea
            class="body-value"
            :value="item.value"
            :placeholder="t('components.channels.customBody.valuePlaceholder')"
            :disabled="!enabled"
            rows="3"
            @input="(e: any) => updateItem(index, 'value', e.target.value)"
          ></textarea>
        </div>
        
        <button
          class="body-remove"
          :title="t('components.channels.customBody.deleteTooltip')"
          :disabled="!enabled"
          @click="removeItem(index)"
        >
          <i class="codicon codicon-trash"></i>
        </button>
      </div>
      
          <!-- 空状态 -->
          <div v-if="customBodyItems.length === 0" class="body-empty">
            {{ t('components.channels.customBody.empty') }}
          </div>
        </div>
      </CustomScrollbar>
      
      <!-- 添加按钮 -->
      <button
        class="add-body-btn"
        :disabled="!enabled"
        @click="addItem"
      >
        <i class="codicon codicon-add"></i>
        {{ t('components.channels.customBody.addItem') }}
      </button>
    </div>
    
    <!-- 复杂模式：完整 JSON 编辑器 -->
    <div v-if="customBody.mode === 'advanced'" class="body-json-editor" :class="{ disabled: !enabled }">
      <textarea
        class="json-textarea"
        :class="{ 'has-error': jsonError }"
        :value="localJsonValue"
        :disabled="!enabled"
        placeholder='{
  "extra_body": {
    "google": {
      "thinking_config": {
        "include_thoughts": false
      }
    }
  }
}'
        rows="8"
        @input="handleJsonInput"
        @blur="saveJson"
      ></textarea>
      <span v-if="jsonError" class="json-error">{{ t('components.channels.customBody.jsonError') }}</span>
      <span class="body-json-hint">{{ t('components.channels.customBody.jsonHint') }}</span>
    </div>
  </div>
</template>

<style scoped src="./CustomBodySettings.css"></style>