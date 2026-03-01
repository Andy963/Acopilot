<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { sendToExtension } from '@/utils/vscode'
import { CustomScrollbar } from '../common'
import { useI18n } from '@/i18n'
import type { ModelInfo } from '@/types'

const { t } = useI18n()

interface Props {
  visible: boolean
  configId: string
  addedModelIds: string[]
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'confirm', models: ModelInfo[]): void
  (e: 'remove', modelId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 状态
const availableModels = ref<ModelInfo[]>([])
const selectedModelIds = ref<Set<string>>(new Set())
const isLoading = ref(false)
const error = ref<string>('')

// 筛选关键词
const filterKeyword = ref('')

// 筛选后的模型列表
const filteredModels = computed(() => {
  if (!filterKeyword.value.trim()) {
    return availableModels.value
  }
  const keyword = filterKeyword.value.toLowerCase().trim()
  return availableModels.value.filter(model =>
    model.id.toLowerCase().includes(keyword) ||
    (model.name && model.name.toLowerCase().includes(keyword)) ||
    (model.description && model.description.toLowerCase().includes(keyword))
  )
})

// 全选/全不选状态（基于筛选后的列表）
const isAllSelected = computed(() => {
  const selectableModels = filteredModels.value.filter(
    m => !props.addedModelIds.includes(m.id)
  )
  return selectableModels.length > 0 &&
         selectableModels.every(m => selectedModelIds.value.has(m.id))
})

// 切换全选/全不选（基于筛选后的列表）
function toggleSelectAll() {
  const selectableModels = filteredModels.value.filter(
    m => !props.addedModelIds.includes(m.id)
  )
  
  if (isAllSelected.value) {
    // 全不选
    selectableModels.forEach(m => selectedModelIds.value.delete(m.id))
  } else {
    // 全选
    selectableModels.forEach(m => selectedModelIds.value.add(m.id))
  }
}

// 切换模型选择状态
function toggleModel(modelId: string, isAdded: boolean) {
  if (isAdded) {
    // 如果已添加，点击时移除
    emit('remove', modelId)
  } else {
    // 未添加则切换选择状态
    if (selectedModelIds.value.has(modelId)) {
      selectedModelIds.value.delete(modelId)
    } else {
      selectedModelIds.value.add(modelId)
    }
  }
}

// 关闭对话框
function close() {
  emit('update:visible', false)
}

// 确认选择
function confirm() {
  const selected = availableModels.value.filter(m => selectedModelIds.value.has(m.id))
  emit('confirm', selected)
  close()
}

// 加载可用模型
async function loadModels() {
  if (!props.configId) return
  
  isLoading.value = true
  error.value = ''
  selectedModelIds.value.clear()
  
  try {
    const models = await sendToExtension<ModelInfo[]>('models.getModels', {
      configId: props.configId
    })
    availableModels.value = models || []
  } catch (err: any) {
    error.value = err.message || t('components.settings.modelSelectionDialog.error')
    console.error('Failed to load models:', err)
  } finally {
    isLoading.value = false
  }
}

// 监听面板显示状态
watch(() => props.visible, (visible) => {
  if (visible) {
    loadModels()
  } else {
    // 关闭时清空选择
    selectedModelIds.value.clear()
    availableModels.value = []
    error.value = ''
    filterKeyword.value = ''
  }
})
</script>

<template>
  <div v-if="visible" class="dialog-overlay" @click.self="close">
    <div class="dialog">
      <!-- 头部 -->
      <div class="dialog-header">
        <h4>{{ t('components.settings.modelSelectionDialog.title') }}</h4>
        <button
          v-if="availableModels.length > 0"
          class="select-all-btn"
          :title="isAllSelected ? t('components.settings.modelSelectionDialog.deselectAll') : t('components.settings.modelSelectionDialog.selectAll')"
          @click="toggleSelectAll"
        >
          <i :class="['codicon', isAllSelected ? 'codicon-close-all' : 'codicon-check-all']"></i>
          <span>{{ isAllSelected ? t('components.settings.modelSelectionDialog.deselectAll') : t('components.settings.modelSelectionDialog.selectAll') }}</span>
        </button>
        <button class="close-btn" :title="t('components.settings.modelSelectionDialog.close')" @click="close">
          <i class="codicon codicon-close"></i>
        </button>
      </div>
      
      <!-- 内容 -->
      <div class="dialog-body">
        <!-- 错误状态 -->
        <div v-if="error" class="error-state">
          <i class="codicon codicon-error"></i>
          <span>{{ error }}</span>
          <button class="retry-btn" @click="loadModels">{{ t('components.settings.modelSelectionDialog.retry') }}</button>
        </div>
        
        <!-- 加载状态 -->
        <div v-else-if="isLoading" class="loading-state">
          <i class="codicon codicon-loading codicon-modifier-spin"></i>
          <span>{{ t('components.settings.modelSelectionDialog.loading') }}</span>
        </div>
        
        <!-- 空状态 -->
        <div v-else-if="availableModels.length === 0" class="empty-state">
          <i class="codicon codicon-info"></i>
          <span>{{ t('components.settings.modelSelectionDialog.empty') }}</span>
        </div>
        
        <!-- 模型列表 -->
        <div v-else class="model-list-wrapper">
          <!-- 筛选输入框 -->
          <div class="filter-input-container">
            <i class="codicon codicon-search"></i>
            <input
              v-model="filterKeyword"
              type="text"
              :placeholder="t('components.settings.modelSelectionDialog.filterPlaceholder')"
              class="filter-input"
            />
            <button
              v-if="filterKeyword"
              class="filter-clear-btn"
              :title="t('components.settings.modelSelectionDialog.clearFilter')"
              @click="filterKeyword = ''"
            >
              <i class="codicon codicon-close"></i>
            </button>
          </div>
          
          <CustomScrollbar :max-height="300" :width="5" :offset="1">
            <div class="model-list">
              <!-- 筛选无结果提示 -->
              <div v-if="filteredModels.length === 0 && filterKeyword" class="no-results">
                <i class="codicon codicon-search"></i>
                <span>{{ t('components.settings.modelSelectionDialog.noResults') }}</span>
              </div>
              
              <div
                v-for="model in filteredModels"
                :key="model.id"
                :class="[
                  'model-item',
                  {
                    selected: selectedModelIds.has(model.id),
                    added: addedModelIds.includes(model.id)
                  }
                ]"
                @click="toggleModel(model.id, addedModelIds.includes(model.id))"
              >
                <div class="model-checkbox">
                  <i
                    :class="[
                      'codicon',
                      selectedModelIds.has(model.id) ? 'codicon-check' : 'codicon-blank'
                    ]"
                  ></i>
                </div>
                <div class="model-info">
                  <span class="model-id">{{ model.id }}</span>
                  <span v-if="model.name && model.name !== model.id" class="model-name">{{ model.name }}</span>
                  <span v-if="model.description" class="model-desc">{{ model.description }}</span>
                </div>
                <button
                  v-if="addedModelIds.includes(model.id)"
                  class="added-badge"
                  @click.stop="emit('remove', model.id)"
                >
                  {{ t('components.settings.modelSelectionDialog.added') }} ×
                </button>
              </div>
            </div>
          </CustomScrollbar>
        </div>
      </div>
      
      <!-- 底部 -->
      <div class="dialog-footer">
        <span class="selection-count">
          {{ t('components.settings.modelSelectionDialog.selectionCount', { count: selectedModelIds.size }) }}
        </span>
        <div class="dialog-actions">
          <button class="btn secondary" @click="close">{{ t('components.settings.modelSelectionDialog.cancel') }}</button>
          <button
            class="btn primary"
            :disabled="selectedModelIds.size === 0"
            @click="confirm"
          >
            {{ t('components.settings.modelSelectionDialog.add', { count: selectedModelIds.size }) }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="./ModelSelectionDialog.css"></style>
