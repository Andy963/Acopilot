<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CustomScrollbar } from '../../common'
import { useI18n } from '../../../i18n'
import { validateAdvancedBodyJson, validateDottedBodyKeys, type ValidationIssue } from './customPayloadValidation'

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
const jsonError = ref<ValidationIssue | null>(null)

const exampleJson = `{
  "extra_body": {
    "google": {
      "thinking_config": {
        "include_thoughts": false
      }
    }
  }
}`

const bodyItemIssues = computed(() => validateDottedBodyKeys(customBodyItems.value))

function getItemIssue(index: number): ValidationIssue | undefined {
  return bodyItemIssues.value.find(issue => issue.index === index)
}

function formatBodyItemIssue(issue: ValidationIssue): string {
  return t(`components.channels.customBody.validation.${issue.code}`)
}

const formattedJsonError = computed(() => {
  const issue = jsonError.value
  if (!issue) return ''
  const base = t(`components.channels.customBody.validation.${issue.code}`)
  const detail = issue.detail ? `: ${issue.detail}` : ''
  const location = issue.line && issue.column
    ? ` ${t('components.channels.customBody.validation.location', { line: issue.line, column: issue.column })}`
    : ''
  return `${base}${detail}${location}`
})

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
  jsonError.value = validateAdvancedBodyJson(target.value)
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

function insertExampleJson() {
  localJsonValue.value = exampleJson
  jsonError.value = null
  saveJson()
}

function resetJson() {
  localJsonValue.value = ''
  jsonError.value = null
  saveJson()
}

function clearSimpleItems() {
  emit('update:config', {
    ...props.customBody,
    items: []
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
        <span class="radio-text">{{ t('components.channels.customBody.modeSimple') }}</span>
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
        <span class="radio-text">{{ t('components.channels.customBody.modeAdvanced') }}</span>
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
            :class="{ 'has-error': getItemIssue(index) }"
            :value="item.key"
            :placeholder="t('components.channels.customBody.keyPlaceholder')"
            :disabled="!enabled"
            @input="(e: any) => updateItem(index, 'key', e.target.value)"
          />
          <span v-if="getItemIssue(index)" class="body-key-error">{{ formatBodyItemIssue(getItemIssue(index)!) }}</span>
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
      <button
        class="secondary-action-btn"
        :disabled="!enabled || customBodyItems.length === 0"
        @click="clearSimpleItems"
      >
        <i class="codicon codicon-clear-all"></i>
        {{ t('components.channels.customBody.clearItems') }}
      </button>
    </div>
    
    <!-- 复杂模式：完整 JSON 编辑器 -->
    <div v-if="customBody.mode === 'advanced'" class="body-json-editor" :class="{ disabled: !enabled }">
      <div class="json-actions">
        <button type="button" :disabled="!enabled" @click="insertExampleJson">
          <i class="codicon codicon-symbol-snippet"></i>
          {{ t('components.channels.customBody.insertExample') }}
        </button>
        <button type="button" :disabled="!enabled" @click="resetJson">
          <i class="codicon codicon-discard"></i>
          {{ t('components.channels.customBody.resetDefault') }}
        </button>
      </div>
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
      <span v-if="jsonError" class="json-error">{{ formattedJsonError }}</span>
      <span class="body-json-hint">{{ t('components.channels.customBody.jsonHint') }}</span>
    </div>
  </div>
</template>

<style scoped src="./CustomBodySettings.css"></style>