import { computed, onMounted, ref, watch } from 'vue'
import { useChatStore } from '../../stores'
import { sendToExtension } from '../../utils/vscode'
import { formatModelName } from '../../utils/format'
import {
  isThinkingEffort,
  isThinkingEffortVisibleForModel,
  THINKING_EFFORT_OPTIONS,
  type ThinkingEffort
} from '../../utils/thinking'
import type { UnifiedModelOption } from './UnifiedModelSelector.vue'
import type { SelectOption } from '../common'

export function useInputAreaConfig() {
  const chatStore = useChatStore()
  const configs = ref<any[]>([])
  const isLoadingConfigs = ref(false)

  async function loadConfigs() {
    isLoadingConfigs.value = true
    try {
      const ids = await sendToExtension<string[]>('config.listConfigs', {})
      const loadedConfigs: any[] = []

      for (const id of ids) {
        const config = await sendToExtension('config.getConfig', { configId: id })
        if (config) {
          loadedConfigs.push(config)
        }
      }

      configs.value = loadedConfigs

      const activeConfigId = chatStore.configId
      if (activeConfigId) {
        const activeConfig = loadedConfigs.find(c => c?.id === activeConfigId)
        if (activeConfig?.enabled === false) {
          const fallback = loadedConfigs.find(c => c?.enabled !== false)
          if (fallback?.id && fallback.id !== activeConfigId) {
            await chatStore.setConfigId(String(fallback.id))
          }
        }
      }
    } catch (error) {
      console.error('Failed to load configs:', error)
    } finally {
      isLoadingConfigs.value = false
    }
  }

  const currentConfig = computed(() => {
    return configs.value.find(c => c.id === chatStore.configId)
  })

  const currentModel = computed(() => {
    return currentConfig.value?.model || ''
  })

  function getCurrentModelDisplayName(config: any): string {
    const modelId = String(config?.model || '').trim()
    if (!modelId) return ''

    const models: any[] = Array.isArray(config?.models) ? config.models : []
    const found = models.find(m => String((m && typeof m === 'object') ? m.id : m).trim() === modelId)

    if (found && typeof found === 'object') {
      return String(found.name || found.id || modelId)
    }

    return modelId
  }

  function getProviderLabel(config: any): string {
    const type = String(config?.type || '').trim()
    if (!type) return String(config?.name || '').trim() || 'unknown'
    if (type === 'openai-responses') return 'openai'
    return type
  }

  const isThinkingEffortVisible = computed(() => {
    const config = currentConfig.value
    if (!config) return false
    if (getProviderLabel(config) !== 'openai') return false

    return isThinkingEffortVisibleForModel({
      configType: config.type,
      modelId: config.model,
      modelName: getCurrentModelDisplayName(config)
    })
  })

  const thinkingEffortOptions = computed<SelectOption[]>(() => {
    return THINKING_EFFORT_OPTIONS.map((value) => {
      return {
        value,
        label: value
      }
    })
  })

  const thinkingEffortValue = computed<ThinkingEffort>(() => {
    const raw = currentConfig.value?.options?.reasoning?.effort
    return isThinkingEffort(raw) ? raw : 'high'
  })

  async function handleThinkingEffortChange(value: string) {
    if (!chatStore.configId) return
    if (!isThinkingEffort(value)) return

    const config = currentConfig.value
    if (!config) return

    const currentOptions = config.options || {}
    const currentReasoning = currentOptions.reasoning || {}
    const nextOptions = {
      ...currentOptions,
      reasoning: {
        ...currentReasoning,
        effort: value
      }
    }

    const currentOptionsEnabled = config.optionsEnabled || {}
    const nextOptionsEnabled = {
      ...currentOptionsEnabled,
      reasoning: true
    }

    try {
      await sendToExtension('config.updateConfig', {
        configId: chatStore.configId,
        updates: {
          options: nextOptions,
          optionsEnabled: nextOptionsEnabled
        }
      })

      const idx = configs.value.findIndex(c => c?.id === chatStore.configId)
      if (idx >= 0) {
        configs.value[idx] = {
          ...configs.value[idx],
          options: nextOptions,
          optionsEnabled: nextOptionsEnabled
        }
      }
    } catch (error) {
      console.error('Failed to update thinking effort:', error)
    }
  }

  const unifiedModelOptions = computed<UnifiedModelOption[]>(() => {
    const options: UnifiedModelOption[] = []
    const enabledConfigs = configs.value.filter(c => c?.enabled !== false)

    for (const config of enabledConfigs) {
      const providerLabel = getProviderLabel(config)
      const channelName = String(config?.name || config?.id || providerLabel)

      const models: any[] = Array.isArray(config?.models) ? config.models : []
      const seen = new Set<string>()

      for (const model of models) {
        const modelId = String((model && typeof model === 'object') ? model.id : model || '').trim()
        if (!modelId) continue
        if (seen.has(modelId)) continue
        seen.add(modelId)

        const modelName = formatModelName(String((model && typeof model === 'object') ? (model.name || model.id) : modelId))
        options.push({
          key: `${config.id}::${modelId}`,
          modelId,
          modelName,
          providerLabel,
          channelName
        })
      }

      const activeModelId = String(config?.model || '').trim()
      if (activeModelId && !seen.has(activeModelId)) {
        options.push({
          key: `${config.id}::${activeModelId}`,
          modelId: activeModelId,
          modelName: formatModelName(activeModelId),
          providerLabel,
          channelName
        })
      }
    }

    options.sort((a, b) => {
      const providerCmp = a.providerLabel.localeCompare(b.providerLabel)
      if (providerCmp !== 0) return providerCmp
      const modelCmp = a.modelName.localeCompare(b.modelName)
      if (modelCmp !== 0) return modelCmp
      return a.channelName.localeCompare(b.channelName)
    })

    return options
  })

  const unifiedModelValue = computed(() => {
    if (!chatStore.configId || !currentModel.value) return ''
    return `${chatStore.configId}::${currentModel.value}`
  })

  async function handleModelChange(modelId: string) {
    if (!chatStore.configId) return

    try {
      await sendToExtension('config.updateConfig', {
        configId: chatStore.configId,
        updates: { model: modelId }
      })

      const config = configs.value.find(c => c.id === chatStore.configId)
      if (config) {
        config.model = modelId
      }

      await chatStore.loadCurrentConfig()
    } catch (error) {
      console.error('Failed to update model:', error)
    }
  }

  async function handleUnifiedModelChange(key: string) {
    const selected = unifiedModelOptions.value.find(o => o.key === key)
    if (!selected) return
    if (selected.key === unifiedModelValue.value) return

    const [configId] = selected.key.split('::')
    if (configId && configId !== chatStore.configId) {
      await chatStore.setConfigId(configId)
    }

    if (selected.modelId && selected.modelId !== currentModel.value) {
      await handleModelChange(selected.modelId)
    }
  }

  onMounted(() => {
    loadConfigs()
  })

  watch(() => chatStore.configId, () => {
    if (chatStore.configId && !configs.value.some(c => c.id === chatStore.configId)) {
      loadConfigs()
    }
  })

  watch(() => chatStore.currentConfig, () => {
    loadConfigs()
  }, { deep: true })

  return {
    configs,
    isLoadingConfigs,
    loadConfigs,
    currentConfig,
    currentModel,
    isThinkingEffortVisible,
    thinkingEffortOptions,
    thinkingEffortValue,
    unifiedModelOptions,
    unifiedModelValue,
    handleThinkingEffortChange,
    handleUnifiedModelChange
  }
}
