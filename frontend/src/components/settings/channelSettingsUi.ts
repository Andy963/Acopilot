import { computed, type ComputedRef, type Ref } from 'vue'
import type { SelectOption } from '../common'

export type Translator = (key: string, params?: Record<string, unknown>) => string

export interface CustomHeader {
  key: string
  value: string
  enabled: boolean
}

export interface CustomBodyItem {
  key: string
  value: string
  enabled: boolean
}

export interface CustomBodyConfig {
  mode: 'simple' | 'advanced'
  items?: CustomBodyItem[]
  json?: string
}

export interface CropImageToolOptions {
  useNormalizedCoordinates?: boolean
}

export interface ToolOptions {
  cropImage?: CropImageToolOptions
}

export interface CapabilitySummaryItem {
  label: string
  value: string
  status: 'success' | 'warning' | 'info'
}

export function useChannelSettingsUi(params: {
  configs: Ref<any[]>
  currentConfig: ComputedRef<any | undefined>
  actualLanguage: Ref<string>
  t: Translator
  updateConfigField: (field: string, value: any) => Promise<void>
}) {
  const { configs, currentConfig, actualLanguage, t, updateConfigField } = params

  function getTypeName(type: string): string {
    const key = `components.settings.channelSettings.form.channelType.${type}` as const
    return t(key)
  }

  const multimodalSummaryTypes = computed(() => {
    const config = currentConfig.value
    if (!config) return ''

    const type = config.type
    const toolMode = config.toolMode ?? 'function_call'

    const supportsImage =
      type === 'gemini' ||
      type === 'anthropic' ||
      type === 'openai-responses' ||
      (type === 'openai' && toolMode !== 'function_call')

    const supportsDocument = type === 'gemini' || type === 'anthropic' || type === 'openai-responses'

    const types: string[] = []
    if (supportsImage) {
      types.push(t('components.settings.channelSettings.form.multimodal.image'))
    }
    if (supportsDocument) {
      types.push(t('components.settings.channelSettings.form.multimodal.documentFormats'))
    }

    const separator = actualLanguage.value === 'en' ? ', ' : '\u3001'
    return types.join(separator)
  })

  const multimodalSummaryText = computed(() => {
    const typesText = multimodalSummaryTypes.value
    if (!typesText) {
      return t('components.settings.channelSettings.form.multimodal.legend.notSupported')
    }
    return typesText
  })

  const providerIcon = computed(() => {
    const type = currentConfig.value?.type
    switch (type) {
      case 'gemini':
        return 'codicon-sparkle'
      case 'openai':
      case 'openai-responses':
        return 'codicon-hubot'
      case 'anthropic':
        return 'codicon-comment-discussion'
      default:
        return 'codicon-cloud'
    }
  })

  const toolModeDisplayName = computed(() => {
    const mode = currentConfig.value?.toolMode || 'function_call'
    return t(
      `components.settings.channelSettings.form.toolMode.${mode === 'function_call' ? 'functionCall' : mode}.label`
    )
  })

  const configOptions = computed<SelectOption[]>(() =>
    configs.value.map((config) => ({
      value: config.id,
      label: config.name,
      description: `${config.type}${config.enabled === false ? ` · ${t('common.disabled')}` : ''}`
    }))
  )

  const typeOptions = computed<SelectOption[]>(() => [
    {
      value: 'gemini',
      label: t('components.settings.channelSettings.form.channelType.gemini'),
      description: 'Google Gemini'
    },
    {
      value: 'openai',
      label: t('components.settings.channelSettings.form.channelType.openai'),
      description: 'OpenAI Compatible'
    },
    {
      value: 'openai-responses',
      label: t('components.settings.channelSettings.form.channelType.openai-responses'),
      description: 'OpenAI Responses API'
    },
    {
      value: 'anthropic',
      label: t('components.settings.channelSettings.form.channelType.anthropic'),
      description: 'Anthropic Claude'
    }
  ])

  const toolModeOptions = computed<SelectOption[]>(() => [
    {
      value: 'function_call',
      label: t('components.settings.channelSettings.form.toolMode.functionCall.label'),
      description: t('components.settings.channelSettings.form.toolMode.functionCall.description')
    },
    {
      value: 'xml',
      label: t('components.settings.channelSettings.form.toolMode.xml.label'),
      description: t('components.settings.channelSettings.form.toolMode.xml.description')
    },
    {
      value: 'json',
      label: t('components.settings.channelSettings.form.toolMode.json.label'),
      description: t('components.settings.channelSettings.form.toolMode.json.description')
    }
  ])

  const customHeaders = computed<CustomHeader[]>(() => currentConfig.value?.customHeaders || [])

  const customHeadersEnabled = computed(() => currentConfig.value?.customHeadersEnabled ?? false)

  async function updateCustomHeadersEnabled(enabled: boolean) {
    await updateConfigField('customHeadersEnabled', enabled)
  }

  async function updateCustomHeaders(headers: CustomHeader[]) {
    await updateConfigField('customHeaders', headers)
  }

  const customBody = computed<CustomBodyConfig>(() => currentConfig.value?.customBody || { mode: 'simple', items: [], json: '' })

  const customBodyEnabled = computed(() => currentConfig.value?.customBodyEnabled ?? false)

  async function updateCustomBodyEnabled(enabled: boolean) {
    await updateConfigField('customBodyEnabled', enabled)
  }

  async function updateCustomBodyConfig(config: CustomBodyConfig) {
    await updateConfigField('customBody', config)
  }

  const retryEnabled = computed(() => currentConfig.value?.retryEnabled ?? true)
  const retryCount = computed(() => currentConfig.value?.retryCount ?? 3)
  const retryInterval = computed(() => currentConfig.value?.retryInterval ?? 3000)

  async function updateRetryEnabled(enabled: boolean) {
    await updateConfigField('retryEnabled', enabled)
  }

  async function updateRetryCount(count: number) {
    await updateConfigField('retryCount', count)
  }

  async function updateRetryInterval(interval: number) {
    await updateConfigField('retryInterval', interval)
  }

  const toolOptions = computed<ToolOptions>(() => currentConfig.value?.toolOptions || {})

  async function updateToolOptions(config: ToolOptions) {
    await updateConfigField('toolOptions', config)
  }

  const contextThresholdEnabled = computed(() => currentConfig.value?.contextThresholdEnabled ?? false)
  const contextThreshold = computed(() => currentConfig.value?.contextThreshold ?? '80%')
  const contextTrimExtraCut = computed(() => currentConfig.value?.contextTrimExtraCut ?? 0)

  const contextManagementSummary = computed(() => {
    if (!contextThresholdEnabled.value) return t('common.disabled')
    return `${t('common.enabled')} · ${contextThreshold.value} ${t('components.settings.channelSettings.form.status.thresholdValue')}`
  })

  const toolOptionsSummary = computed(() => {
    const opts = toolOptions.value
    const count = Object.keys(opts).length
    if (count === 0) return t('components.settings.channelSettings.form.status.defaultConfig')
    return t('components.settings.channelSettings.form.status.toolsConfigured', { count })
  })

  const tokenCountMethodSummary = computed(() => {
    const method = currentConfig.value?.tokenCountMethod || 'channel_default'
    if (method === 'channel_default') return t('components.channels.tokenCountMethod.options.channelDefault')
    if (method === 'local') return t('components.settings.channelSettings.form.status.localEstimate')
    return method
  })

  const customBodySummary = computed(() => {
    if (!customBodyEnabled.value) return t('common.disabled')
    const body = customBody.value
    if (body.mode === 'simple') {
      const items = body.items || []
      const enabledCount = items.filter((i) => i.enabled).length
      if (enabledCount === 0) return t('common.enabled')
      return t('components.settings.channelSettings.form.status.fieldsConfigured', { count: enabledCount })
    }
    return t('common.enabled')
  })

  const customHeadersSummary = computed(() => {
    if (!customHeadersEnabled.value) return t('common.disabled')
    const headers = customHeaders.value
    const enabledCount = headers.filter((h) => h.enabled).length
    if (enabledCount === 0) return t('common.enabled')
    return t('components.settings.channelSettings.form.status.headersConfigured', { count: enabledCount })
  })

  const autoRetrySummary = computed(() => {
    if (!retryEnabled.value) return t('common.disabled')
    return `${t('common.enabled')} · ${t('components.settings.channelSettings.form.status.maxRetries', { count: retryCount.value })}`
  })

  const advancedOptionsSummary = computed(() => {
    const type = currentConfig.value?.type
    return getTypeName(type || '')
  })

  const capabilitySummaryItems = computed<CapabilitySummaryItem[]>(() => {
    const config = currentConfig.value
    if (!config) return []

    const selectedModel = (config.models || []).find((model: any) => model.id === config.model)
    const toolMode = config.toolMode || 'function_call'
    const hasReasoning = Boolean(
      config.options?.thinkingConfig ||
      config.options?.thinking ||
      config.options?.reasoning
    )
    const supportsPromptCache = config.type === 'openai-responses'
    const multimodalEnabled = config.multimodalToolsEnabled === true

    return [
      {
        label: t('components.settings.channelSettings.form.capabilitySummary.model'),
        value: selectedModel?.name || config.model || t('components.settings.channelSettings.form.capabilitySummary.notSelected'),
        status: config.model ? 'success' : 'warning',
      },
      {
        label: t('components.settings.channelSettings.form.capabilitySummary.contextWindow'),
        value: String(selectedModel?.contextWindow || config.maxContextTokens || t('components.settings.channelSettings.form.capabilitySummary.unknown')),
        status: selectedModel?.contextWindow || config.maxContextTokens ? 'info' : 'warning',
      },
      {
        label: t('components.settings.channelSettings.form.capabilitySummary.maxOutput'),
        value: String(selectedModel?.maxOutputTokens || config.options?.maxTokens || config.options?.maxOutputTokens || t('components.settings.channelSettings.form.capabilitySummary.unknown')),
        status: selectedModel?.maxOutputTokens || config.options?.maxTokens || config.options?.maxOutputTokens ? 'info' : 'warning',
      },
      {
        label: t('components.settings.channelSettings.form.capabilitySummary.toolProtocol'),
        value: t(`components.settings.channelSettings.form.toolMode.${toolMode === 'function_call' ? 'functionCall' : toolMode}.label`),
        status: 'success',
      },
      {
        label: t('components.settings.channelSettings.form.capabilitySummary.multimodal'),
        value: multimodalEnabled ? multimodalSummaryText.value : t('common.disabled'),
        status: multimodalEnabled ? 'success' : 'info',
      },
      {
        label: t('components.settings.channelSettings.form.capabilitySummary.reasoning'),
        value: hasReasoning ? t('common.enabled') : t('components.settings.channelSettings.form.capabilitySummary.providerDefault'),
        status: hasReasoning ? 'success' : 'info',
      },
      {
        label: t('components.settings.channelSettings.form.capabilitySummary.promptCache'),
        value: supportsPromptCache ? t('common.enabled') : t('components.settings.channelSettings.form.capabilitySummary.providerDefault'),
        status: supportsPromptCache ? 'success' : 'info',
      },
      {
        label: t('components.settings.channelSettings.form.capabilitySummary.stream'),
        value: (config.options?.stream ?? true) ? t('common.enabled') : t('common.disabled'),
        status: (config.options?.stream ?? true) ? 'success' : 'info',
      },
    ]
  })

  async function updateContextThresholdEnabled(enabled: boolean) {
    await updateConfigField('contextThresholdEnabled', enabled)
  }

  async function updateContextThreshold(value: string) {
    const numValue = parseFloat(value)
    if (value.endsWith('%')) {
      const percent = parseFloat(value.replace('%', ''))
      if (!isNaN(percent) && percent > 0 && percent <= 100) {
        await updateConfigField('contextThreshold', value)
      }
    } else if (!isNaN(numValue) && numValue > 0) {
      await updateConfigField('contextThreshold', numValue)
    }
  }

  async function updateContextTrimExtraCut(value: string | number) {
    if (typeof value === 'string') {
      if (value === '' || value === '0') {
        await updateConfigField('contextTrimExtraCut', 0)
      } else if (value.endsWith('%')) {
        const percent = parseFloat(value.replace('%', ''))
        if (!isNaN(percent) && percent >= 0 && percent <= 100) {
          await updateConfigField('contextTrimExtraCut', value)
        }
      } else {
        const numValue = parseFloat(value)
        if (!isNaN(numValue) && numValue >= 0) {
          await updateConfigField('contextTrimExtraCut', numValue)
        }
      }
    } else if (typeof value === 'number' && value >= 0) {
      await updateConfigField('contextTrimExtraCut', value)
    }
  }

  return {
    getTypeName,
    multimodalSummaryTypes,
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
    updateContextTrimExtraCut
  }
}

