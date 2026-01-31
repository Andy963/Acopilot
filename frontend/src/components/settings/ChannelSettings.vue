<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { CustomSelect, ConfirmDialog } from '../common'
import ModelManager from './ModelManager.vue'
import {
  GeminiOptions,
  OpenAIOptions,
  OpenAIResponsesOptions,
  AnthropicOptions,
  CustomBodySettings,
  CustomHeadersSettings,
  ToolOptionsSettings,
  TokenCountMethodSettings
} from './channels'
import { useChannelSettingsUi } from './channelSettingsUi'
import { sendToExtension } from '@/utils/vscode'
import { useChatStore } from '@/stores'
import type { ModelInfo } from '@/types'
import { t, useI18n } from '@/i18n'

// Chat Store - 用于同步配置状态
const chatStore = useChatStore()
const { actualLanguage } = useI18n()

// 配置列表
const configs = ref<any[]>([])
const currentConfigId = ref<string>('')
const isLoading = ref(false)

// 编辑模式
const isEditing = ref(false)
const editingName = ref('')
const editInput = ref<HTMLInputElement>()

// 新建配置对话框
const showNewDialog = ref(false)
const newConfigName = ref('')
const newConfigType = ref<'gemini' | 'openai' | 'openai-responses' | 'anthropic'>('gemini')

// 高级选项展开状态
const showAdvancedOptions = ref(false)

// 自定义标头展开状态
const showCustomHeaders = ref(false)

// 自定义 body 展开状态
const showCustomBody = ref(false)

// API Key 显示/隐藏
const showApiKey = ref(false)

// 自动重试展开状态
const showRetryOptions = ref(false)

// 上下文阈值展开状态
const showContextThreshold = ref(false)

// 工具配置展开状态
const showToolOptions = ref(false)

// Token 计数方式展开状态
const showTokenCountMethod = ref(false)

// 多模态详情展开状态
const showMultimodalDetails = ref(false)

// 确认对话框
const showConfirmDialog = ref(false)
const confirmDialogTitle = ref('')
const confirmDialogMessage = ref('')
const confirmDialogAction = ref<() => void>(() => { })

// 更新options字段
async function updateOption(optionKey: string, value: any) {
  if (!currentConfig.value) return

  const currentOptions = currentConfig.value.options || {}
  const updatedOptions = {
    ...currentOptions,
    [optionKey]: value
  }

  await updateConfigField('options', updatedOptions)
}

// 更新配置项启用状态（可选同时更新 option 值，避免竞态条件）
async function updateOptionEnabled(optionKey: string, enabled: boolean, optionValue?: any) {
  if (!currentConfig.value) return

  const currentOptionsEnabled = currentConfig.value.optionsEnabled || {}
  const updatedOptionsEnabled = {
    ...currentOptionsEnabled,
    [optionKey]: enabled
  }

  if (optionValue !== undefined) {
    // 同时更新 optionsEnabled 和 options，避免竞态条件
    const currentOptions = currentConfig.value.options || {}
    const updatedOptions = {
      ...currentOptions,
      [optionKey]: optionValue
    }

    // 合并为单个更新，避免两个请求相互覆盖
    await updateConfigFields({
      optionsEnabled: updatedOptionsEnabled,
      options: updatedOptions
    })
  } else {
    await updateConfigField('optionsEnabled', updatedOptionsEnabled)
  }
}

// 当前配置
const currentConfig = computed(() =>
  configs.value.find(c => c.id === currentConfigId.value)
)

const {
  multimodalSummaryText,
  providerIcon,
  toolModeDisplayName,
  configOptions,
  typeOptions,
  toolModeOptions,
  customHeaders,
  customHeadersEnabled,
  updateCustomHeadersEnabled,
  updateCustomHeaders,
  customBody,
  customBodyEnabled,
  updateCustomBodyEnabled,
  updateCustomBodyConfig,
  retryEnabled,
  retryCount,
  retryInterval,
  updateRetryEnabled,
  updateRetryCount,
  updateRetryInterval,
  toolOptions,
  updateToolOptions,
  contextThresholdEnabled,
  contextThreshold,
  contextTrimExtraCut,
  contextManagementSummary,
  toolOptionsSummary,
  tokenCountMethodSummary,
  customBodySummary,
  customHeadersSummary,
  autoRetrySummary,
  advancedOptionsSummary,
  updateContextThresholdEnabled,
  updateContextThreshold,
  updateContextTrimExtraCut
} = useChannelSettingsUi({
  configs,
  currentConfig,
  actualLanguage,
  t,
  updateConfigField
})

function toggleMultimodalDetails() {
  showMultimodalDetails.value = !showMultimodalDetails.value
}

// 复制到剪贴板
function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
}

// 加载配置列表
async function loadConfigs() {
  isLoading.value = true
  try {
    const ids = await sendToExtension<string[]>('config.listConfigs', {})
    configs.value = []

    for (const id of ids) {
      const config = await sendToExtension('config.getConfig', { configId: id })
      if (config) {
        configs.value.push(config)
      }
    }

    // 不在这里自动选择配置，让 onMounted 统一处理
  } catch (error) {
    console.error('Failed to load configs:', error)
  } finally {
    isLoading.value = false
  }
}

// 创建新配置
async function createConfig() {
  if (!newConfigName.value.trim()) return

  try {
    // 只传递必要参数，其他由后端提供默认值
    const configId = await sendToExtension<string>('config.createConfig', {
      type: newConfigType.value,
      name: newConfigName.value.trim()
    })

    await loadConfigs()
    currentConfigId.value = configId
    showNewDialog.value = false
    newConfigName.value = ''
  } catch (error) {
    console.error('Failed to create config:', error)
  }
}

// 显示确认对话框
function showConfirm(title: string, message: string, action: () => void) {
  confirmDialogTitle.value = title
  confirmDialogMessage.value = message
  confirmDialogAction.value = action
  showConfirmDialog.value = true
}

// 格式化确认消息（支持变量替换）
function formatMessage(message: string, name: string): string {
  return message.replace('{name}', name)
}

// 确认对话框确认回调
function onConfirmDialogConfirm() {
  confirmDialogAction.value()
}

function isConfigDisabled(configId: string): boolean {
  const config = configs.value.find(c => c.id === configId)
  return config?.enabled === false
}

async function toggleConfigEnabledById(configId: string) {
  const configIndex = configs.value.findIndex(c => c.id === configId)
  if (configIndex === -1) return

  const nextEnabled = configs.value[configIndex]?.enabled === false

  try {
    await sendToExtension('config.updateConfig', {
      configId,
      updates: { enabled: nextEnabled }
    })

    configs.value[configIndex] = {
      ...configs.value[configIndex],
      enabled: nextEnabled
    }

    if (!nextEnabled && configId === chatStore.configId) {
      const fallbackId = configs.value.find(c => c.id !== configId && c?.enabled !== false)?.id
      if (fallbackId) {
        currentConfigId.value = fallbackId
        await chatStore.setConfigId(fallbackId)
      } else {
        await chatStore.loadCurrentConfig()
      }
    } else {
      await chatStore.loadCurrentConfig()
    }
  } catch (error) {
    console.error('Failed to toggle config enabled:', error)
  }
}

// 删除指定配置
async function deleteConfigById(configId: string) {
  const config = configs.value.find(c => c.id === configId)
  if (!config) return

  if (configs.value.length <= 1) {
    showConfirm(
      t('components.settings.channelSettings.dialog.delete.title'),
      t('components.settings.channelSettings.dialog.delete.atLeastOne'),
      () => { }
    )
    return
  }

  showConfirm(
    t('components.settings.channelSettings.dialog.delete.title'),
    formatMessage(t('components.settings.channelSettings.dialog.delete.message'), config.name),
    async () => {
      try {
        const deletedId = config.id
        await sendToExtension('config.deleteConfig', {
          configId: deletedId
        })

        await loadConfigs()

        // 如果删除的是当前正在使用的配置，立即切换到一个仍存在的配置。
        if (deletedId === chatStore.configId) {
          const fallbackId = configs.value[0]?.id
          if (fallbackId) {
            currentConfigId.value = fallbackId
            await chatStore.setConfigId(fallbackId)
          }
        } else {
          // 刷新 InputArea 使用的最小 currentConfig 快照。
          await chatStore.loadCurrentConfig()
        }
      } catch (error) {
        console.error('Failed to delete config:', error)
      }
    }
  )
}

// 开始编辑
async function startEditing() {
  if (!currentConfig.value) return
  editingName.value = currentConfig.value.name
  isEditing.value = true
  await nextTick()
  editInput.value?.focus()
  editInput.value?.select()
}

// 保存编辑
async function saveEditing() {
  if (!editingName.value.trim() || !currentConfig.value) {
    isEditing.value = false
    return
  }

  try {
    await sendToExtension('config.updateConfig', {
      configId: currentConfig.value.id,
      updates: { name: editingName.value.trim() }
    })
    await loadConfigs()
  } catch (error) {
    console.error('Failed to update config:', error)
  }

  isEditing.value = false
}

// 取消编辑
function cancelEditing() {
  isEditing.value = false
  editingName.value = ''
}

// 处理键盘事件
function handleEditKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    saveEditing()
  } else if (e.key === 'Escape') {
    cancelEditing()
  }
}

// 取消新建
function cancelNew() {
  showNewDialog.value = false
  newConfigName.value = ''
}

// 更新多个配置字段（单个请求，避免竞态条件）
async function updateConfigFields(updates: Record<string, any>) {
  if (!currentConfig.value) return

  try {
    // 确保数据可序列化（深拷贝移除响应式代理）
    const serializableUpdates: Record<string, any> = {}
    for (const [field, value] of Object.entries(updates)) {
      serializableUpdates[field] = JSON.parse(JSON.stringify(value))
    }

    await sendToExtension('config.updateConfig', {
      configId: currentConfig.value.id,
      updates: serializableUpdates
    })

    // 直接在本地更新配置值
    const configIndex = configs.value.findIndex(c => c.id === currentConfig.value!.id)
    if (configIndex !== -1) {
      configs.value[configIndex] = {
        ...configs.value[configIndex],
        ...serializableUpdates
      }
    }

    // 如果修改的是当前使用的配置，同步到 chatStore
    if (currentConfig.value.id === chatStore.configId) {
      await chatStore.loadCurrentConfig()
    }
  } catch (error) {
    console.error('Failed to update config fields:', error)
  }
}

// 更新配置字段
async function updateConfigField(field: string, value: any) {
  if (!currentConfig.value) return

  try {
    // 确保数据可序列化（深拷贝移除响应式代理）
    let serializableValue = JSON.parse(JSON.stringify(value))

    // 特殊处理 models 字段
    if (field === 'models' && Array.isArray(serializableValue)) {
      serializableValue = serializableValue.map((m: any) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        contextWindow: m.contextWindow,
        maxOutputTokens: m.maxOutputTokens
      }))
    }

    await sendToExtension('config.updateConfig', {
      configId: currentConfig.value.id,
      updates: { [field]: serializableValue }
    })

    // 直接在本地更新配置值，避免重新加载导致滚动位置丢失
    const configIndex = configs.value.findIndex(c => c.id === currentConfig.value!.id)
    if (configIndex !== -1) {
      configs.value[configIndex] = {
        ...configs.value[configIndex],
        [field]: serializableValue
      }
    }

    // 如果修改的是当前使用的配置，同步到 chatStore
    if (currentConfig.value.id === chatStore.configId) {
      await chatStore.loadCurrentConfig()
    }
  } catch (error) {
    console.error('Failed to update config:', error)
  }
}

// 更新模型列表
async function handleUpdateModels(models: ModelInfo[]) {
  await updateConfigField('models', models)
}

// 更新当前选择的模型
async function handleUpdateSelectedModel(modelId: string) {
  await updateConfigField('model', modelId)
}

// 是否已完成初始化（防止初始化时的 watch 触发同步）
const isInitialized = ref(false)

// 监听 currentConfigId 变化，同步到 chatStore（仅在初始化完成后）
watch(currentConfigId, (newId) => {
  showApiKey.value = false
  showMultimodalDetails.value = false
  if (isInitialized.value && newId && newId !== chatStore.configId) {
    chatStore.setConfigId(newId)
  }
})

// 监听 chatStore.configId 变化，同步到本地
watch(() => chatStore.configId, (newId) => {
  if (newId && newId !== currentConfigId.value && configs.value.some(c => c.id === newId)) {
    currentConfigId.value = newId
  }
})

// 初始化
onMounted(async () => {
  await loadConfigs()

  // 优先使用 chatStore 的配置 ID
  if (chatStore.configId && configs.value.some(c => c.id === chatStore.configId)) {
    currentConfigId.value = chatStore.configId
  } else if (configs.value.length > 0 && !currentConfigId.value) {
    // 如果 chatStore 没有配置或配置不存在，才选择第一个
    currentConfigId.value = configs.value[0].id
  }

  // 标记初始化完成
  isInitialized.value = true
})
</script>

<template>
  <div class="channel-settings v2">
    <!-- 确认对话框 -->
    <ConfirmDialog v-model="showConfirmDialog" :title="confirmDialogTitle" :message="confirmDialogMessage"
      :is-danger="confirmDialogTitle === t('components.settings.channelSettings.dialog.delete.title')"
      :confirm-text="t('components.settings.channelSettings.dialog.delete.confirm')"
      :cancel-text="t('components.settings.channelSettings.dialog.delete.cancel')" @confirm="onConfirmDialogConfirm" />

    <!-- 新建对话框 -->
    <div v-if="showNewDialog" class="config-dialog">
      <div class="dialog-content">
        <h4>{{ t('components.settings.channelSettings.dialog.new.title') }}</h4>

        <div class="form-group">
          <label>{{ t('components.settings.channelSettings.dialog.new.nameLabel') }}</label>
          <input v-model="newConfigName" type="text"
            :placeholder="t('components.settings.channelSettings.dialog.new.namePlaceholder')"
            @keyup.enter="createConfig" />
        </div>

        <div class="form-group">
          <label>{{ t('components.settings.channelSettings.dialog.new.typeLabel') }}</label>
          <CustomSelect v-model="newConfigType" :options="typeOptions"
            :placeholder="t('components.settings.channelSettings.dialog.new.typePlaceholder')" />
        </div>

        <div class="dialog-actions">
          <button class="btn secondary" @click="cancelNew">{{ t('components.settings.channelSettings.dialog.new.cancel')
          }}</button>
          <button class="btn primary" @click="createConfig">{{
            t('components.settings.channelSettings.dialog.new.create') }}</button>
        </div>
      </div>
    </div>

    <!-- ==================== 1. 顶部：身份与凭据区 ==================== -->
    <!-- 配置选择器 -->
    <div class="config-selector">
      <i :class="['provider-icon', 'codicon', providerIcon]"></i>
      <!-- 编辑模式：输入框 + 确认/取消按钮 -->
      <template v-if="isEditing">
        <input ref="editInput" v-model="editingName" type="text" class="config-input"
          :placeholder="t('components.settings.channelSettings.selector.inputPlaceholder')"
          @keydown="handleEditKeydown" />
        <button class="icon-btn confirm" :title="t('components.settings.channelSettings.selector.confirm')"
          @click="saveEditing">
          <i class="codicon codicon-check"></i>
        </button>
        <button class="icon-btn cancel" :title="t('components.settings.channelSettings.selector.cancel')"
          @click="cancelEditing">
          <i class="codicon codicon-close"></i>
        </button>
      </template>

      <!-- 正常模式：自定义下拉框 -->
      <div v-else class="config-select-wrapper">
        <CustomSelect v-model="currentConfigId" :options="configOptions"
          :placeholder="t('components.settings.channelSettings.selector.placeholder')">
          <template #option-actions="{ option }">
            <button
              type="button"
              class="icon-btn option-toggle-btn"
              :title="isConfigDisabled(String(option.value)) ? t('common.enable') : t('common.disable')"
              @click="toggleConfigEnabledById(String(option.value))"
            >
              <i
                :class="[
                  'codicon',
                  isConfigDisabled(String(option.value)) ? 'codicon-eye-closed' : 'codicon-eye'
                ]"
              ></i>
            </button>
            <button type="button" class="icon-btn danger option-delete-btn"
              :title="t('components.settings.channelSettings.selector.delete')" :disabled="configs.length <= 1"
              @click="deleteConfigById(String(option.value))">
              <i class="codicon codicon-trash"></i>
            </button>
          </template>
        </CustomSelect>
      </div>

      <button v-if="!isEditing" class="icon-btn" :title="t('components.settings.channelSettings.selector.rename')"
        @click="startEditing">
        <i class="codicon codicon-edit"></i>
      </button>

      <button v-if="!isEditing" class="icon-btn" :title="t('components.settings.channelSettings.selector.add')"
        @click="showNewDialog = true">
        <i class="codicon codicon-add"></i>
      </button>
    </div>

    <!-- 配置表单 -->
    <div v-if="currentConfig" class="config-form">
      <!-- 身份与凭据区 -->
      <div class="section-group credentials-section">
        <div class="section-title">
          <i class="codicon codicon-key"></i>
          <span>{{ t('components.settings.channelSettings.form.sections.identityCredentials') }}</span>
        </div>

        <div class="credentials-card">
          <div class="credential-row api-row">
            <i class="codicon codicon-globe row-icon"></i>
            <input :value="currentConfig.url" type="text" class="credential-input" :placeholder="currentConfig.type === 'openai-responses'
              ? t('components.settings.channelSettings.form.apiUrl.placeholderResponses')
              : t('components.settings.channelSettings.form.apiUrl.placeholder')"
              @input="(e: any) => updateConfigField('url', e.target.value)" />
            <button v-if="currentConfig.url" class="credential-action copy-btn" :title="t('common.copy')"
              @click="copyToClipboard(currentConfig.url)">
              <i class="codicon codicon-copy"></i>
            </button>
          </div>

          <div class="credential-row api-key-row">
            <i class="codicon codicon-key row-icon"></i>
            <input :value="currentConfig.apiKey" :type="showApiKey ? 'text' : 'password'" class="credential-input"
              :placeholder="t('components.settings.channelSettings.form.apiKey.placeholder')"
              @input="(e: any) => updateConfigField('apiKey', e.target.value)" />
            <button class="credential-action" :title="showApiKey
              ? t('components.settings.channelSettings.form.apiKey.hide')
              : t('components.settings.channelSettings.form.apiKey.show')" @click="showApiKey = !showApiKey">
              <i :class="['codicon', showApiKey ? 'codicon-eye-closed' : 'codicon-eye']"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- ==================== 2. 中部：模型与性能区 ==================== -->
      <div class="section-group model-section">
        <!-- 模型管理器 -->
        <ModelManager :config-id="currentConfig.id" :models="currentConfig.models || []"
          :selected-model="currentConfig.model || ''" @update:models="handleUpdateModels"
          @update:selected-model="handleUpdateSelectedModel" />

        <label class="custom-checkbox compact">
          <input type="checkbox" :checked="currentConfig.options?.stream ?? true"
            @change="(e: any) => updateOption('stream', e.target.checked)" />
          <span class="checkmark"></span>
          <span class="checkbox-text">{{ t('components.settings.channelSettings.form.stream.label') }}</span>
        </label>

        <!-- 超时时间和最大上下文 Tokens 并排 -->
        <div class="performance-row">
          <div class="perf-item">
            <label>{{ t('components.settings.channelSettings.form.timeout.label') }}</label>
            <input :value="currentConfig.timeout" type="number"
              :placeholder="t('components.settings.channelSettings.form.timeout.placeholder')"
              @input="(e: any) => updateConfigField('timeout', Number(e.target.value))" />
          </div>
          <div class="perf-item">
            <label>{{ t('components.settings.channelSettings.form.maxContextTokens.label') }}</label>
            <input :value="currentConfig.maxContextTokens || 128000" type="number"
              :placeholder="t('components.settings.channelSettings.form.maxContextTokens.placeholder')"
              @input="(e: any) => updateConfigField('maxContextTokens', Number(e.target.value))" />
          </div>
        </div>
        <span class="field-hint perf-hint">{{ t('components.settings.channelSettings.form.maxContextTokens.hint')
        }}</span>
      </div>

      <!-- ==================== 3. 中部：功能能力区 ==================== -->
      <div class="section-group capabilities-section">
        <div class="section-title">
          <i class="codicon codicon-extensions"></i>
          <span>{{ t('components.settings.channelSettings.form.sections.capabilities') }}</span>
        </div>

        <!-- 工具调用格式 -->
        <div class="capability-row">
          <div class="capability-icon">
            <i class="codicon codicon-symbol-method"></i>
          </div>
          <div class="capability-content">
            <div class="capability-header">
              <span class="capability-label">{{ t('components.settings.channelSettings.form.toolMode.label') }}</span>
              <span class="capability-value">{{ toolModeDisplayName }}</span>
            </div>
            <CustomSelect :model-value="currentConfig.toolMode || 'function_call'" :options="toolModeOptions"
              :placeholder="t('components.settings.channelSettings.form.toolMode.placeholder')"
              class="capability-select" @update:model-value="(v: string) => updateConfigField('toolMode', v)" />
          </div>
        </div>

        <!-- 多模态工具配置 -->
        <div class="capability-row multimodal-row">
          <div class="capability-icon">
            <i class="codicon codicon-file"></i>
          </div>
          <div class="capability-content">
            <div class="capability-header">
              <label class="custom-checkbox compact">
                <input type="checkbox" :checked="currentConfig.multimodalToolsEnabled ?? false"
                  @change="(e: any) => updateConfigField('multimodalToolsEnabled', e.target.checked)" />
                <span class="checkmark"></span>
                <span class="checkbox-text">{{ t('components.settings.channelSettings.form.multimodalSummary') }}</span>
              </label>
            </div>
            <div class="multimodal-inline">
              <span class="multimodal-types">{{ multimodalSummaryText }}</span>
              <button type="button" class="inline-link" @click="toggleMultimodalDetails">
                {{ t('components.settings.channelSettings.form.viewCompatibility') }}
                <i class="codicon codicon-chevron-right"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- 多模态兼容性矩阵展开内容 -->
        <div v-show="showMultimodalDetails" class="multimodal-matrix-panel">
          <div class="matrix-header">
            <span>{{ t('components.settings.channelSettings.form.multimodal.capabilities') }}</span>
            <button class="close-btn" @click="showMultimodalDetails = false">
              <i class="codicon codicon-close"></i>
            </button>
          </div>
          <div class="channel-support-table detailed">
            <div class="channel-row header-row">
              <span class="channel-name">{{ t('components.settings.channelSettings.form.multimodal.table.channel')
              }}</span>
              <span class="channel-feature">{{ t('components.settings.channelSettings.form.multimodal.table.readImage')
              }}</span>
              <span class="channel-feature">{{
                t('components.settings.channelSettings.form.multimodal.table.readDocument')
              }}</span>
              <span class="channel-feature">{{
                t('components.settings.channelSettings.form.multimodal.table.generateImage')
              }}</span>
              <span class="channel-feature">{{
                t('components.settings.channelSettings.form.multimodal.table.historyMultimodal') }}</span>
            </div>
            <div class="channel-row" :class="{ current: currentConfig.type === 'gemini' }">
              <span class="channel-name">{{ t('components.settings.channelSettings.form.multimodal.channels.geminiAll')
              }}</span>
              <span class="channel-feature support-yes">✓</span>
              <span class="channel-feature support-yes">✓</span>
              <span class="channel-feature support-yes">✓</span>
              <span class="channel-feature support-yes">✓</span>
            </div>
            <div class="channel-row" :class="{ current: currentConfig.type === 'anthropic' }">
              <span class="channel-name">{{
                t('components.settings.channelSettings.form.multimodal.channels.anthropicAll')
              }}</span>
              <span class="channel-feature support-yes">✓</span>
              <span class="channel-feature support-yes">✓</span>
              <span class="channel-feature support-yes">✓</span>
              <span class="channel-feature support-yes">✓</span>
            </div>
            <div class="channel-row" :class="{ current: currentConfig.type === 'openai-responses' }">
              <span class="channel-name">{{
                t('components.settings.channelSettings.form.multimodal.channels.openaiResponses') }}</span>
              <span class="channel-feature support-yes">✓</span>
              <span class="channel-feature support-yes">✓</span>
              <span class="channel-feature support-no">✗</span>
              <span class="channel-feature support-yes">✓</span>
            </div>
            <div class="channel-row"
              :class="{ current: currentConfig.type === 'openai' && (currentConfig.toolMode === 'xml' || currentConfig.toolMode === 'json') }">
              <span class="channel-name">{{
                t('components.settings.channelSettings.form.multimodal.channels.openaiXmlJson')
              }}</span>
              <span class="channel-feature support-yes">✓</span>
              <span class="channel-feature support-no">✗</span>
              <span class="channel-feature support-yes">✓</span>
              <span class="channel-feature support-yes">✓</span>
            </div>
            <div class="channel-row"
              :class="{ current: currentConfig.type === 'openai' && (currentConfig.toolMode === 'function_call' || !currentConfig.toolMode) }">
              <span class="channel-name">{{
                t('components.settings.channelSettings.form.multimodal.channels.openaiFunction')
              }}</span>
              <span class="channel-feature support-no">✗</span>
              <span class="channel-feature support-no">✗</span>
              <span class="channel-feature support-no">✗</span>
              <span class="channel-feature support-no">✗</span>
            </div>
          </div>
          <div class="support-legend">
            <span class="legend-item">
              <span class="legend-symbol support-yes">✓</span>
              <span class="legend-text">{{ t('components.settings.channelSettings.form.multimodal.legend.supported')
              }}</span>
            </span>
            <span class="legend-item">
              <span class="legend-symbol support-no">✗</span>
              <span class="legend-text">{{ t('components.settings.channelSettings.form.multimodal.legend.notSupported')
              }}</span>
            </span>
          </div>
        </div>
      </div>

      <!-- ==================== 4. 下部：逻辑配置广场 ==================== -->
      <div class="section-group accordion-square">
        <div class="section-title">
          <i class="codicon codicon-settings-gear"></i>
          <span>{{ t('components.settings.channelSettings.form.sections.advancedConfig') }}</span>
        </div>

        <!-- 上下文管理 -->
        <div class="accordion-item" :class="{ disabled: !contextThresholdEnabled, expanded: showContextThreshold }">
          <button class="accordion-header" @click="showContextThreshold = !showContextThreshold">
            <i class="codicon codicon-chevron-right expand-icon"></i>
            <i class="codicon codicon-history item-icon"></i>
            <span class="item-title">{{ t('components.settings.channelSettings.form.contextManagement.title') }}</span>
            <span class="item-summary">{{ contextManagementSummary }}</span>
            <label class="toggle-switch" @click.stop>
              <input type="checkbox" :checked="contextThresholdEnabled"
                @change="(e: any) => updateContextThresholdEnabled(e.target.checked)" />
              <span class="toggle-slider"></span>
            </label>
          </button>
          <div v-if="showContextThreshold" class="accordion-content">
            <div class="context-threshold-options">
              <div class="option-item">
                <label>{{ t('components.settings.channelSettings.form.contextManagement.threshold.label') }}</label>
                <input type="text" :value="contextThreshold"
                  :placeholder="t('components.settings.channelSettings.form.contextManagement.threshold.placeholder')"
                  :disabled="!contextThresholdEnabled" :class="{ disabled: !contextThresholdEnabled }"
                  @input="(e: any) => updateContextThreshold(e.target.value)" />
                <span class="option-hint">{{
                  t('components.settings.channelSettings.form.contextManagement.threshold.hint')
                }}</span>
              </div>

              <div class="option-item">
                <label>{{ t('components.settings.channelSettings.form.contextManagement.extraCut.label') }}</label>
                <input type="text" :value="contextTrimExtraCut"
                  :placeholder="t('components.settings.channelSettings.form.contextManagement.extraCut.placeholder')"
                  :disabled="!contextThresholdEnabled" :class="{ disabled: !contextThresholdEnabled }"
                  @input="(e: any) => updateContextTrimExtraCut(e.target.value)" />
                <span class="option-hint">{{
                  t('components.settings.channelSettings.form.contextManagement.extraCut.hint')
                }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 工具配置 -->
        <div class="accordion-item" :class="{ expanded: showToolOptions }">
          <button class="accordion-header" @click="showToolOptions = !showToolOptions">
            <i class="codicon codicon-chevron-right expand-icon"></i>
            <i class="codicon codicon-tools item-icon"></i>
            <span class="item-title">{{ t('components.settings.channelSettings.form.toolOptions.title') }}</span>
            <span class="item-summary">{{ toolOptionsSummary }}</span>
          </button>
          <div v-if="showToolOptions" class="accordion-content">
            <ToolOptionsSettings :tool-options="toolOptions" @update:config="updateToolOptions" />
          </div>
        </div>

        <!-- Token 计数方式 -->
        <div class="accordion-item" :class="{ expanded: showTokenCountMethod }">
          <button class="accordion-header" @click="showTokenCountMethod = !showTokenCountMethod">
            <i class="codicon codicon-chevron-right expand-icon"></i>
            <i class="codicon codicon-symbol-number item-icon"></i>
            <span class="item-title">{{ t('components.channels.tokenCountMethod.title') }}</span>
            <span class="item-summary">{{ tokenCountMethodSummary }}</span>
          </button>
          <div v-if="showTokenCountMethod" class="accordion-content">
            <TokenCountMethodSettings :token-count-method="currentConfig.tokenCountMethod || 'channel_default'"
              :token-count-api-config="currentConfig.tokenCountApiConfig || {}" :channel-type="currentConfig.type"
              @update:token-count-method="(v: string) => updateConfigField('tokenCountMethod', v)"
              @update:token-count-api-config="(v: any) => updateConfigField('tokenCountApiConfig', v)" />
          </div>
        </div>

        <!-- 分割线 -->
        <div class="accordion-divider"></div>

        <!-- 自定义 Body -->
        <div class="accordion-item" :class="{ disabled: !customBodyEnabled, expanded: showCustomBody }">
          <button class="accordion-header" @click="showCustomBody = !showCustomBody">
            <i class="codicon codicon-chevron-right expand-icon"></i>
            <i class="codicon codicon-code item-icon"></i>
            <span class="item-title">{{ t('components.settings.channelSettings.form.customBody.title') }}</span>
            <span class="item-summary">{{ customBodySummary }}</span>
            <label class="toggle-switch" @click.stop>
              <input type="checkbox" :checked="customBodyEnabled"
                @change="(e: any) => updateCustomBodyEnabled(e.target.checked)" />
              <span class="toggle-slider"></span>
            </label>
          </button>
          <div v-if="showCustomBody" class="accordion-content">
            <CustomBodySettings :custom-body="customBody" :enabled="customBodyEnabled"
              @update:enabled="updateCustomBodyEnabled" @update:config="updateCustomBodyConfig" />
          </div>
        </div>

        <!-- 自定义标头 -->
        <div class="accordion-item" :class="{ disabled: !customHeadersEnabled, expanded: showCustomHeaders }">
          <button class="accordion-header" @click="showCustomHeaders = !showCustomHeaders">
            <i class="codicon codicon-chevron-right expand-icon"></i>
            <i class="codicon codicon-list-unordered item-icon"></i>
            <span class="item-title">{{ t('components.settings.channelSettings.form.customHeaders.title') }}</span>
            <span class="item-summary">{{ customHeadersSummary }}</span>
            <label class="toggle-switch" @click.stop>
              <input type="checkbox" :checked="customHeadersEnabled"
                @change="(e: any) => updateCustomHeadersEnabled(e.target.checked)" />
              <span class="toggle-slider"></span>
            </label>
          </button>
          <div v-if="showCustomHeaders" class="accordion-content">
            <CustomHeadersSettings :headers="customHeaders" :enabled="customHeadersEnabled"
              @update:enabled="updateCustomHeadersEnabled" @update:headers="updateCustomHeaders" />
          </div>
        </div>

        <!-- 自动重试 -->
        <div class="accordion-item" :class="{ disabled: !retryEnabled, expanded: showRetryOptions }">
          <button class="accordion-header" @click="showRetryOptions = !showRetryOptions">
            <i class="codicon codicon-chevron-right expand-icon"></i>
            <i class="codicon codicon-sync item-icon"></i>
            <span class="item-title">{{ t('components.settings.channelSettings.form.autoRetry.title') }}</span>
            <span class="item-summary">{{ autoRetrySummary }}</span>
            <label class="toggle-switch" @click.stop>
              <input type="checkbox" :checked="retryEnabled"
                @change="(e: any) => updateRetryEnabled(e.target.checked)" />
              <span class="toggle-slider"></span>
            </label>
          </button>
          <div v-if="showRetryOptions" class="accordion-content">
            <div class="retry-options">
              <div class="option-item">
                <label>{{ t('components.settings.channelSettings.form.autoRetry.retryCount.label') }}</label>
                <input type="number" :value="retryCount" min="1" max="10" :disabled="!retryEnabled"
                  :class="{ disabled: !retryEnabled }" @input="(e: any) => updateRetryCount(Number(e.target.value))" />
                <span class="option-hint">{{ t('components.settings.channelSettings.form.autoRetry.retryCount.hint')
                }}</span>
              </div>

              <div class="option-item">
                <label>{{ t('components.settings.channelSettings.form.autoRetry.retryInterval.label') }}</label>
                <input type="number" :value="retryInterval" min="1000" max="60000" step="1000" :disabled="!retryEnabled"
                  :class="{ disabled: !retryEnabled }"
                  @input="(e: any) => updateRetryInterval(Number(e.target.value))" />
                <span class="option-hint">{{ t('components.settings.channelSettings.form.autoRetry.retryInterval.hint')
                }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 高级选项 -->
        <div class="accordion-item" :class="{ expanded: showAdvancedOptions }">
          <button class="accordion-header" @click="showAdvancedOptions = !showAdvancedOptions">
            <i class="codicon codicon-chevron-right expand-icon"></i>
            <i class="codicon codicon-beaker item-icon"></i>
            <span class="item-title">{{ t('components.settings.channelSettings.form.advancedOptions.title') }}</span>
            <span class="item-summary">{{ advancedOptionsSummary }}</span>
          </button>
          <div v-if="showAdvancedOptions" class="accordion-content">
            <!-- Gemini 选项 -->
            <GeminiOptions v-if="currentConfig.type === 'gemini'" :config="currentConfig" @update:option="updateOption"
              @update:option-enabled="updateOptionEnabled" @update:field="updateConfigField" />

            <!-- OpenAI 选项 -->
            <OpenAIOptions v-if="currentConfig.type === 'openai'" :config="currentConfig" @update:option="updateOption"
              @update:option-enabled="updateOptionEnabled" @update:field="updateConfigField" />

            <!-- OpenAI Responses 选项 -->
            <OpenAIResponsesOptions v-if="currentConfig.type === 'openai-responses'" :config="currentConfig"
              @update:option="updateOption" @update:option-enabled="updateOptionEnabled"
              @update:field="updateConfigField" />

            <!-- Anthropic 选项 -->
            <AnthropicOptions v-if="currentConfig.type === 'anthropic'" :config="currentConfig"
              @update:option="updateOption" @update:option-enabled="updateOptionEnabled"
              @update:field="updateConfigField" />
          </div>
        </div>
      </div>

      <!-- ==================== 5. 底部：启用此配置 ==================== -->
      <div class="footer-section">
        <label class="custom-checkbox">
          <input type="checkbox" :checked="currentConfig.enabled"
            @change="(e: any) => updateConfigField('enabled', e.target.checked)" />
          <span class="checkmark"></span>
          <span class="checkbox-text">{{ t('components.settings.channelSettings.form.enabled.label') }}</span>
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped src="./ChannelSettings.css"></style>
