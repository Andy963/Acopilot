<script setup lang="ts">
import { ref, computed } from 'vue'
import ModelSelectionDialog from './ModelSelectionDialog.vue'
import ConfirmDialog from '../common/ConfirmDialog.vue'
import CustomScrollbar from '../common/CustomScrollbar.vue'
import SettingsGroup from './common/SettingsGroup.vue'
import { sendToExtension } from '@/utils/vscode'
import { useI18n } from '@/i18n'
import type { ModelInfo } from '@/types'

const { t } = useI18n()

interface Props {
  configId: string
  models: ModelInfo[]
  selectedModel: string
}

interface Emits {
  (e: 'update:models', models: ModelInfo[]): void
  (e: 'update:selectedModel', modelId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 对话框状态
const showDialog = ref(false)
const showClearConfirm = ref(false)
const newModelId = ref('')

// 筛选关键词
const filterKeyword = ref('')

// 已添加模型的 ID 列表
const addedModelIds = computed(() => props.models.map(m => m.id))

// 筛选后的模型列表
const filteredModels = computed(() => {
  if (!filterKeyword.value.trim()) {
    return props.models
  }
  const keyword = filterKeyword.value.toLowerCase().trim()
  return props.models.filter(model =>
    model.id.toLowerCase().includes(keyword) ||
    (model.name && model.name.toLowerCase().includes(keyword)) ||
    (model.description && model.description.toLowerCase().includes(keyword))
  )
})

// 打开选择对话框
function openDialog() {
  showDialog.value = true
}

// 处理对话框确认
async function handleConfirm(selectedModels: ModelInfo[]) {
  try {
    // 确保数据是可序列化的纯对象
    const serializableModels = selectedModels.map(m => ({
      id: m.id,
      name: m.name,
      description: m.description,
      contextWindow: m.contextWindow,
      maxOutputTokens: m.maxOutputTokens
    }))
    
    await sendToExtension('models.addModels', {
      configId: props.configId,
      models: serializableModels
    })
    // 触发父组件重新加载配置
    const updatedModels = [...props.models, ...serializableModels]
    emit('update:models', updatedModels)
  } catch (error) {
    console.error('Failed to add models:', error)
    alert(t('components.settings.modelManager.errors.addFailed'))
  }
}

// 处理对话框移除
function handleDialogRemove(modelId: string) {
  removeModel(modelId)
}

// 手动添加模型
async function addCustomModel() {
  if (!newModelId.value.trim()) return
  
  const model = {
    id: newModelId.value.trim(),
    name: newModelId.value.trim()
  }
  
  try {
    await sendToExtension('models.addModels', {
      configId: props.configId,
      models: [model]
    })
    // 触发父组件重新加载配置
    const updatedModels = [...props.models, model]
    emit('update:models', updatedModels)
    newModelId.value = ''
  } catch (error) {
    console.error('Failed to add model:', error)
    alert(t('components.settings.modelManager.errors.addFailed'))
  }
}

// 移除模型
async function removeModel(modelId: string) {
  try {
    await sendToExtension('models.removeModel', {
      configId: props.configId,
      modelId
    })
    // 触发父组件重新加载配置
    const updatedModels = props.models.filter(m => m.id !== modelId)
    emit('update:models', updatedModels)
    
    // 如果移除的是当前模型，清空（允许删除正在使用的模型）
    if (props.selectedModel === modelId) {
      emit('update:selectedModel', '')
    }
  } catch (error) {
    console.error('Failed to remove model:', error)
    alert(t('components.settings.modelManager.errors.removeFailed'))
  }
}

// 显示清除确认对话框
function showClearConfirmDialog() {
  if (props.models.length === 0) return
  showClearConfirm.value = true
}

// 确认清除所有模型
async function confirmClearAllModels() {
  try {
    // 逐个删除模型
    for (const model of props.models) {
      await sendToExtension('models.removeModel', {
        configId: props.configId,
        modelId: model.id
      })
    }
    
    // 清空列表和当前选择
    emit('update:models', [])
    emit('update:selectedModel', '')
  } catch (error) {
    console.error('Failed to clear models:', error)
  }
}

// 选择模型作为启用
async function selectModel(modelId: string) {
  try {
    await sendToExtension('models.setActiveModel', {
      configId: props.configId,
      modelId
    })
    emit('update:selectedModel', modelId)
  } catch (error) {
    console.error('Failed to set active model:', error)
    alert(t('components.settings.modelManager.errors.setActiveFailed'))
  }
}
</script>

<template>
  <div class="model-manager">
    <SettingsGroup
      :title="t('components.settings.modelManager.title')"
      icon="codicon-list-tree"
      :badge="models.length"
      :storage-key="`acopilot.settings.modelManager.${configId}.expanded`"
      :default-expanded="true"
    >
      <template #actions>
        <button class="fetch-btn" @click="openDialog">
          <i class="codicon codicon-add"></i>
          <span>{{ t('components.settings.modelManager.fetchModels') }}</span>
        </button>
        <button
          class="clear-btn"
          :disabled="models.length === 0"
          :title="t('components.settings.modelManager.clearAllTooltip')"
          @click="showClearConfirmDialog"
        >
          <i class="codicon codicon-clear-all"></i>
          <span>{{ t('components.settings.modelManager.clearAll') }}</span>
        </button>
      </template>

      <!-- 已添加的模型 -->
      <div v-if="models.length > 0" class="model-list-container">
        <!-- 筛选输入框 -->
        <div class="filter-input-container">
          <i class="codicon codicon-search"></i>
          <input
            v-model="filterKeyword"
            type="text"
            :placeholder="t('components.settings.modelManager.filterPlaceholder')"
            class="filter-input"
          />
          <button
            v-if="filterKeyword"
            class="filter-clear-btn"
            :title="t('components.settings.modelManager.clearFilter')"
            @click="filterKeyword = ''"
          >
            <i class="codicon codicon-close"></i>
          </button>
        </div>
        
        <CustomScrollbar class="model-list-scrollbar">
          <div class="model-list">
            <!-- 筛选无结果提示 -->
            <div v-if="filteredModels.length === 0 && filterKeyword" class="no-results">
              <i class="codicon codicon-search"></i>
              <span>{{ t('components.settings.modelManager.noResults') }}</span>
            </div>
            
            <div
              v-for="model in filteredModels"
              :key="model.id"
              :class="['model-item', { enabled: selectedModel === model.id }]"
              @click="selectModel(model.id)"
            >
              <div class="model-status">
                <i
                  :class="[
                    'codicon',
                    selectedModel === model.id ? 'codicon-circle-filled' : 'codicon-circle-outline'
                  ]"
                ></i>
              </div>
              <div class="model-info">
                <span class="model-id">{{ model.id }}</span>
                <span v-if="model.name && model.name !== model.id" class="model-name">{{ model.name }}</span>
                <span v-if="model.description" class="model-desc">{{ model.description }}</span>
              </div>
              <button
                class="model-remove-btn"
                :title="t('components.settings.modelManager.removeTooltip')"
                @click.stop="removeModel(model.id)"
              >
                <i class="codicon codicon-close"></i>
              </button>
            </div>
          </div>
        </CustomScrollbar>
      </div>
      
      <!-- 空状态 -->
      <div v-else class="empty-models">
        <i class="codicon codicon-info"></i>
        <span>{{ t('components.settings.modelManager.empty') }}</span>
      </div>
      
      <!-- 手动添加 -->
      <div class="add-model">
        <input
          v-model="newModelId"
          type="text"
          :placeholder="t('components.settings.modelManager.addPlaceholder')"
          @keyup.enter="addCustomModel"
        />
        <button
          class="add-btn"
          :title="t('components.settings.modelManager.addTooltip')"
          :disabled="!newModelId.trim()"
          @click="addCustomModel"
        >
          <i class="codicon codicon-add"></i>
        </button>
      </div>
    </SettingsGroup>
    
    <!-- 模型选择对话框 -->
    <ModelSelectionDialog
      v-model:visible="showDialog"
      :config-id="configId"
      :added-model-ids="addedModelIds"
      @confirm="handleConfirm"
      @remove="handleDialogRemove"
    />
    
    <!-- 清除确认对话框 -->
    <ConfirmDialog
      v-model="showClearConfirm"
      :title="t('components.settings.modelManager.clearDialog.title')"
      :message="t('components.settings.modelManager.clearDialog.message', { count: models.length })"
      :confirm-text="t('components.settings.modelManager.clearDialog.confirm')"
      :cancel-text="t('components.settings.modelManager.clearDialog.cancel')"
      :is-danger="true"
      @confirm="confirmClearAllModels"
    />
  </div>
</template>

<style scoped src="./ModelManager.css"></style>
