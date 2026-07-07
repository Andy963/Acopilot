import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useChannelSettingsUi } from './channelSettingsUi'
import { sendToExtension } from '@/utils/vscode'
import { useChatStore, useSettingsStore } from '@/stores'
import type { ModelInfo } from '@/types'
import { t, useI18n } from '@/i18n'

type ChannelConfigType = 'gemini' | 'openai' | 'openai-responses' | 'anthropic'

export function useChannelSettings() {
  const chatStore = useChatStore()
  const settingsStore = useSettingsStore()
  const { actualLanguage } = useI18n()

  const configs = ref<any[]>([])
  const currentConfigId = ref<string>('')
  const isLoading = ref(false)

  const isEditing = ref(false)
  const editingName = ref('')
  const editInput = ref<HTMLInputElement>()

  const showNewDialog = ref(false)
  const newConfigName = ref('')
  const newConfigType = ref<ChannelConfigType>('gemini')

  const showAdvancedOptions = ref(false)
  const showCustomHeaders = ref(false)
  const showCustomBody = ref(false)
  const showApiKey = ref(false)
  const showRetryOptions = ref(false)
  const showContextThreshold = ref(false)
  const showToolOptions = ref(false)
  const showTokenCountMethod = ref(false)
  const showMultimodalDetails = ref(false)
  const isTestingConnection = ref(false)
  const connectionTestResult = ref<{ ok: boolean; message: string; latencyMs?: number } | null>(null)

  const showConfirmDialog = ref(false)
  const confirmDialogTitle = ref('')
  const confirmDialogMessage = ref('')
  const confirmDialogAction = ref<() => void>(() => {})

  const currentConfig = computed(() => configs.value.find(c => c.id === currentConfigId.value))

  async function updateConfigFields(updates: Record<string, any>) {
    if (!currentConfig.value) return
    connectionTestResult.value = null

    try {
      const serializableUpdates: Record<string, any> = {}
      for (const [field, value] of Object.entries(updates)) {
        serializableUpdates[field] = JSON.parse(JSON.stringify(value))
      }

      await sendToExtension('config.updateConfig', {
        configId: currentConfig.value.id,
        updates: serializableUpdates,
      })

      const idx = configs.value.findIndex(c => c.id === currentConfig.value!.id)
      if (idx !== -1) {
        configs.value[idx] = { ...configs.value[idx], ...serializableUpdates }
      }

      if (currentConfig.value.id === chatStore.configId) {
        await chatStore.loadCurrentConfig()
      }
    } catch (error) {
      console.error('Failed to update config fields:', error)
    }
  }

  async function updateConfigField(field: string, value: any) {
    if (!currentConfig.value) return
    connectionTestResult.value = null

    try {
      let serializableValue = JSON.parse(JSON.stringify(value))
      if (field === 'models' && Array.isArray(serializableValue)) {
        serializableValue = serializableValue.map((m: any) => ({
          id: m.id,
          name: m.name,
          description: m.description,
          contextWindow: m.contextWindow,
          maxOutputTokens: m.maxOutputTokens,
        }))
      }

      await sendToExtension('config.updateConfig', {
        configId: currentConfig.value.id,
        updates: { [field]: serializableValue },
      })

      const idx = configs.value.findIndex(c => c.id === currentConfig.value!.id)
      if (idx !== -1) {
        configs.value[idx] = { ...configs.value[idx], [field]: serializableValue }
      }

      if (currentConfig.value.id === chatStore.configId) {
        await chatStore.loadCurrentConfig()
      }
    } catch (error) {
      console.error('Failed to update config:', error)
    }
  }

  async function updateOption(optionKey: string, value: any) {
    if (!currentConfig.value) return
    const currentOptions = currentConfig.value.options || {}
    await updateConfigField('options', { ...currentOptions, [optionKey]: value })
  }

  async function updateOptionEnabled(optionKey: string, enabled: boolean, optionValue?: any) {
    if (!currentConfig.value) return

    const currentOptionsEnabled = currentConfig.value.optionsEnabled || {}
    const updatedOptionsEnabled = { ...currentOptionsEnabled, [optionKey]: enabled }

    if (optionValue !== undefined) {
      const currentOptions = currentConfig.value.options || {}
      const updatedOptions = { ...currentOptions, [optionKey]: optionValue }
      await updateConfigFields({ optionsEnabled: updatedOptionsEnabled, options: updatedOptions })
      return
    }

    await updateConfigField('optionsEnabled', updatedOptionsEnabled)
  }

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
    capabilitySummaryItems,
    updateContextThresholdEnabled,
    updateContextThreshold,
    updateContextTrimExtraCut,
  } = useChannelSettingsUi({
    configs,
    currentConfig,
    actualLanguage,
    t,
    updateConfigField,
  })

  function toggleMultimodalDetails() {
    showMultimodalDetails.value = !showMultimodalDetails.value
  }

  function copyToClipboard(text: string) {
    void navigator.clipboard.writeText(text)
  }

  function openToolsSettings() {
    settingsStore.setActiveTab('tools')
  }

  async function testConnection() {
    if (!currentConfig.value || isTestingConnection.value) return

    isTestingConnection.value = true
    connectionTestResult.value = null
    try {
      const result = await sendToExtension<{ ok: boolean; message: string; latencyMs?: number }>('config.testConnection', {
        configId: currentConfig.value.id,
      })
      connectionTestResult.value = result
    } catch (error) {
      connectionTestResult.value = {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      }
    } finally {
      isTestingConnection.value = false
    }
  }

  async function loadConfigs() {
    isLoading.value = true
    try {
      const ids = await sendToExtension<string[]>('config.listConfigs', {})
      configs.value = []
      for (const id of ids) {
        const config = await sendToExtension('config.getConfig', { configId: id })
        if (config) configs.value.push(config)
      }
    } catch (error) {
      console.error('Failed to load configs:', error)
    } finally {
      isLoading.value = false
    }
  }

  async function createConfig() {
    if (!newConfigName.value.trim()) return

    try {
      const configId = await sendToExtension<string>('config.createConfig', {
        type: newConfigType.value,
        name: newConfigName.value.trim(),
      })

      await loadConfigs()
      currentConfigId.value = configId
      showNewDialog.value = false
      newConfigName.value = ''
    } catch (error) {
      console.error('Failed to create config:', error)
    }
  }

  function showConfirm(title: string, message: string, action: () => void) {
    confirmDialogTitle.value = title
    confirmDialogMessage.value = message
    confirmDialogAction.value = action
    showConfirmDialog.value = true
  }

  function formatMessage(message: string, name: string): string {
    return message.replace('{name}', name)
  }

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
      await sendToExtension('config.updateConfig', { configId, updates: { enabled: nextEnabled } })

      configs.value[configIndex] = { ...configs.value[configIndex], enabled: nextEnabled }

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

  async function deleteConfigById(configId: string) {
    const config = configs.value.find(c => c.id === configId)
    if (!config) return

    if (configs.value.length <= 1) {
      showConfirm(
        t('components.settings.channelSettings.dialog.delete.title'),
        t('components.settings.channelSettings.dialog.delete.atLeastOne'),
        () => {},
      )
      return
    }

    showConfirm(
      t('components.settings.channelSettings.dialog.delete.title'),
      formatMessage(t('components.settings.channelSettings.dialog.delete.message'), config.name),
      async () => {
        try {
          const deletedId = config.id
          await sendToExtension('config.deleteConfig', { configId: deletedId })
          await loadConfigs()

          if (deletedId === chatStore.configId) {
            const fallbackId = configs.value[0]?.id
            if (fallbackId) {
              currentConfigId.value = fallbackId
              await chatStore.setConfigId(fallbackId)
            }
          } else {
            await chatStore.loadCurrentConfig()
          }
        } catch (error) {
          console.error('Failed to delete config:', error)
        }
      },
    )
  }

  async function startEditing() {
    if (!currentConfig.value) return
    editingName.value = currentConfig.value.name
    isEditing.value = true
    await nextTick()
    editInput.value?.focus()
    editInput.value?.select()
  }

  async function saveEditing() {
    if (!editingName.value.trim() || !currentConfig.value) {
      isEditing.value = false
      return
    }

    try {
      await sendToExtension('config.updateConfig', {
        configId: currentConfig.value.id,
        updates: { name: editingName.value.trim() },
      })
      await loadConfigs()
    } catch (error) {
      console.error('Failed to update config:', error)
    }

    isEditing.value = false
  }

  function cancelEditing() {
    isEditing.value = false
    editingName.value = ''
  }

  function handleEditKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      void saveEditing()
    } else if (e.key === 'Escape') {
      cancelEditing()
    }
  }

  function cancelNew() {
    showNewDialog.value = false
    newConfigName.value = ''
  }

  async function handleUpdateModels(models: ModelInfo[]) {
    await updateConfigField('models', models)
  }

  async function handleUpdateSelectedModel(modelId: string) {
    await updateConfigField('model', modelId)
  }

  const isInitialized = ref(false)

  watch(currentConfigId, (newId) => {
    showApiKey.value = false
    showMultimodalDetails.value = false
    connectionTestResult.value = null
    if (isInitialized.value && newId && newId !== chatStore.configId) {
      void chatStore.setConfigId(newId)
    }
  })

  watch(
    () => chatStore.configId,
    (newId) => {
      if (newId && newId !== currentConfigId.value && configs.value.some(c => c.id === newId)) {
        currentConfigId.value = newId
      }
    },
  )

  onMounted(async () => {
    await loadConfigs()

    if (chatStore.configId && configs.value.some(c => c.id === chatStore.configId)) {
      currentConfigId.value = chatStore.configId
    } else if (configs.value.length > 0 && !currentConfigId.value) {
      currentConfigId.value = configs.value[0].id
    }

    isInitialized.value = true
  })

  return {
    t,
    chatStore,
    actualLanguage,
    configs,
    currentConfigId,
    currentConfig,
    isLoading,
    isEditing,
    editingName,
    editInput,
    showNewDialog,
    newConfigName,
    newConfigType,
    showAdvancedOptions,
    showCustomHeaders,
    showCustomBody,
    showApiKey,
    showRetryOptions,
    showContextThreshold,
    showToolOptions,
    showTokenCountMethod,
    showMultimodalDetails,
    showConfirmDialog,
    confirmDialogTitle,
    confirmDialogMessage,
    confirmDialogAction,
    updateOption,
    updateOptionEnabled,
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
    capabilitySummaryItems,
    updateContextThresholdEnabled,
    updateContextThreshold,
    updateContextTrimExtraCut,
    toggleMultimodalDetails,
    copyToClipboard,
    openToolsSettings,
    testConnection,
    loadConfigs,
    createConfig,
    showConfirm,
    formatMessage,
    onConfirmDialogConfirm,
    isConfigDisabled,
    toggleConfigEnabledById,
    deleteConfigById,
    startEditing,
    saveEditing,
    cancelEditing,
    handleEditKeydown,
    cancelNew,
    updateConfigFields,
    updateConfigField,
    handleUpdateModels,
    handleUpdateSelectedModel,
    isInitialized,
    isTestingConnection,
    connectionTestResult,
  }
}

