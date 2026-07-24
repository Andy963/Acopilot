import { computed, reactive, ref } from 'vue'
import { t } from '@/i18n'
import { useChatStore } from '@/stores'
import { sendToExtension } from '@/utils/vscode'
import type {
  CheckpointConfig,
  CheckpointMessageType,
  MessageCheckpointConfig,
  ToolInfo,
} from './types'

export type CheckpointPresetId = 'safe' | 'light' | 'off' | 'dangerous'

const MUTATING_CHECKPOINT_TOOLS = [
  'apply_diff',
  'write_file',
  'delete_file',
  'create_directory',
  'execute_command',
  'replace_in_files',
  'generate_image',
]

const DANGEROUS_CHECKPOINT_TOOLS = [
  'apply_diff',
  'delete_file',
  'execute_command',
  'replace_in_files',
]

function createDefaultMessageCheckpoint(): MessageCheckpointConfig {
  return {
    beforeMessages: [],
    afterMessages: [],
    modelOuterLayerOnly: true,
    mergeUnchangedCheckpoints: true,
  }
}

function normalizeMessageCheckpoint(
  messageCheckpoint?: MessageCheckpointConfig,
): MessageCheckpointConfig {
  return {
    ...createDefaultMessageCheckpoint(),
    ...(messageCheckpoint ?? {}),
    beforeMessages: [...(messageCheckpoint?.beforeMessages ?? [])],
    afterMessages: [...(messageCheckpoint?.afterMessages ?? [])],
  }
}

function toggleNameInList(items: string[], name: string, enabled: boolean): string[] {
  if (enabled) return items.includes(name) ? items : [...items, name]
  return items.filter(item => item !== name)
}

function uniqueToolNames(tools: string[]): string[] {
  return Array.from(new Set(tools.filter(Boolean)))
}

function createUserBeforeMessageCheckpoint(): MessageCheckpointConfig {
  return {
    beforeMessages: ['user'],
    afterMessages: [],
    modelOuterLayerOnly: true,
    mergeUnchangedCheckpoints: true,
  }
}

<<<<<<< HEAD
function hasSameItems(actual: string[], expected: string[]): boolean {
  return actual.length === expected.length && expected.every(item => actual.includes(item))
}

function hasPresetMessageCheckpoint(messageCheckpoint?: MessageCheckpointConfig): boolean {
  return Boolean(
    messageCheckpoint
    && hasSameItems(messageCheckpoint.beforeMessages, ['user'])
    && messageCheckpoint.afterMessages.length === 0
    && messageCheckpoint.modelOuterLayerOnly === true
    && messageCheckpoint.mergeUnchangedCheckpoints === true,
  )
}

export function resolveCheckpointPreset(config: CheckpointConfig): CheckpointPresetId | null {
  if (!config.enabled) return 'off'
  if (!hasPresetMessageCheckpoint(config.messageCheckpoint)) return null

  const beforeTools = config.beforeTools
  const afterTools = config.afterTools
  const mutatingTools = uniqueToolNames(MUTATING_CHECKPOINT_TOOLS)
  const dangerousTools = uniqueToolNames(DANGEROUS_CHECKPOINT_TOOLS)

  if (hasSameItems(beforeTools, mutatingTools) && hasSameItems(afterTools, mutatingTools)) {
    return 'safe'
  }
  if (hasSameItems(beforeTools, mutatingTools) && afterTools.length === 0) {
    return 'light'
  }
  if (hasSameItems(beforeTools, dangerousTools) && hasSameItems(afterTools, dangerousTools)) {
    return 'dangerous'
  }

  return null
}

=======
>>>>>>> f327a97 (merge: dev into main for v1.2.0)
export function useCheckpointSettingsConfig() {
  const chatStore = useChatStore()

  const checkpointPresets = computed(() => [
    {
      id: 'safe' as const,
      title: t('components.settings.checkpoint.sections.presets.items.safe.title'),
      description: t('components.settings.checkpoint.sections.presets.items.safe.description'),
    },
    {
      id: 'light' as const,
      title: t('components.settings.checkpoint.sections.presets.items.light.title'),
      description: t('components.settings.checkpoint.sections.presets.items.light.description'),
    },
    {
      id: 'dangerous' as const,
      title: t('components.settings.checkpoint.sections.presets.items.dangerous.title'),
      description: t('components.settings.checkpoint.sections.presets.items.dangerous.description'),
    },
    {
      id: 'off' as const,
      title: t('components.settings.checkpoint.sections.presets.items.off.title'),
      description: t('components.settings.checkpoint.sections.presets.items.off.description'),
    },
  ])

  const messageTypes = computed<CheckpointMessageType[]>(() => [
    {
      name: 'user',
      displayName: t('components.settings.checkpoint.sections.messages.types.user.name'),
      description: t('components.settings.checkpoint.sections.messages.types.user.description'),
    },
    {
      name: 'model',
      displayName: t('components.settings.checkpoint.sections.messages.types.model.name'),
      description: t('components.settings.checkpoint.sections.messages.types.model.description'),
    },
  ])

  const config = reactive<CheckpointConfig>({
    enabled: true,
    beforeTools: [],
    afterTools: [],
    messageCheckpoint: createDefaultMessageCheckpoint(),
    maxCheckpoints: -1,
    cleanupExpiredConversationsOnStartup: true,
    expiredConversationRetentionDays: 30,
  })

  const allTools = ref<ToolInfo[]>([])
  const isLoading = ref(false)
<<<<<<< HEAD
  const currentCheckpointPresetId = computed(() => resolveCheckpointPreset(config))
=======
>>>>>>> f327a97 (merge: dev into main for v1.2.0)

  function ensureMessageCheckpoint(
    overrides: Partial<MessageCheckpointConfig> = {},
  ): MessageCheckpointConfig {
    config.messageCheckpoint = {
      ...createDefaultMessageCheckpoint(),
      ...(config.messageCheckpoint ?? {}),
      ...overrides,
    }

    return config.messageCheckpoint
  }

  async function loadConfig() {
    isLoading.value = true

    try {
      const response = await sendToExtension<{ config: CheckpointConfig }>('checkpoint.getConfig', {})
      if (response?.config) {
        Object.assign(config, response.config)
        config.messageCheckpoint = normalizeMessageCheckpoint(response.config.messageCheckpoint)
      }

      const toolsResponse = await sendToExtension<{ tools: ToolInfo[] }>('tools.getTools', {})
      if (toolsResponse?.tools) {
        allTools.value = toolsResponse.tools
      }
    } catch (error) {
      console.error('Failed to load checkpoint config:', error)
    } finally {
      isLoading.value = false
    }
  }

  async function updateConfigField(field: keyof CheckpointConfig, value: any) {
    await updateConfig({ [field]: value } as Partial<CheckpointConfig>)
  }

  async function updateConfig(updates: Partial<CheckpointConfig>) {
    Object.assign(config, updates)

    try {
      await sendToExtension('checkpoint.updateConfig', {
        config: {
          enabled: config.enabled,
          beforeTools: [...config.beforeTools],
          afterTools: [...config.afterTools],
          messageCheckpoint: normalizeMessageCheckpoint(config.messageCheckpoint),
          maxCheckpoints: config.maxCheckpoints,
          cleanupExpiredConversationsOnStartup: config.cleanupExpiredConversationsOnStartup ?? true,
          expiredConversationRetentionDays: config.expiredConversationRetentionDays ?? 30,
          customIgnorePatterns: config.customIgnorePatterns ? [...config.customIgnorePatterns] : [],
        },
      })
    } catch (error) {
      console.error('Failed to save checkpoint config:', error)
    }
  }

  async function applyCheckpointPreset(presetId: CheckpointPresetId) {
    if (presetId === 'off') {
      await updateConfig({ enabled: false })
      return
    }

    const messageCheckpoint = createUserBeforeMessageCheckpoint()

    if (presetId === 'safe') {
      const tools = uniqueToolNames(MUTATING_CHECKPOINT_TOOLS)
      await updateConfig({
        enabled: true,
        beforeTools: tools,
        afterTools: tools,
        messageCheckpoint,
      })
      return
    }

    if (presetId === 'light') {
      await updateConfig({
        enabled: true,
        beforeTools: uniqueToolNames(MUTATING_CHECKPOINT_TOOLS),
        afterTools: [],
        messageCheckpoint,
      })
      return
    }

    await updateConfig({
      enabled: true,
      beforeTools: uniqueToolNames(DANGEROUS_CHECKPOINT_TOOLS),
      afterTools: uniqueToolNames(DANGEROUS_CHECKPOINT_TOOLS),
      messageCheckpoint,
    })
  }

  async function toggleMessageBefore(messageType: string, enabled: boolean) {
    const messageCheckpoint = ensureMessageCheckpoint()
    messageCheckpoint.beforeMessages = toggleNameInList(
      messageCheckpoint.beforeMessages ?? [],
      messageType,
      enabled,
    )

    await updateConfigField('messageCheckpoint', { ...messageCheckpoint })
  }

  async function toggleMessageAfter(messageType: string, enabled: boolean) {
    const messageCheckpoint = ensureMessageCheckpoint()
    messageCheckpoint.afterMessages = toggleNameInList(
      messageCheckpoint.afterMessages ?? [],
      messageType,
      enabled,
    )

    await updateConfigField('messageCheckpoint', { ...messageCheckpoint })
  }

  async function toggleModelOuterLayerOnly(enabled: boolean) {
    const messageCheckpoint = ensureMessageCheckpoint({ modelOuterLayerOnly: enabled })
    await updateConfigField('messageCheckpoint', { ...messageCheckpoint })
  }

  async function toggleMergeUnchangedCheckpoints(enabled: boolean) {
    const messageCheckpoint = ensureMessageCheckpoint({ mergeUnchangedCheckpoints: enabled })
    await updateConfigField('messageCheckpoint', { ...messageCheckpoint })
    chatStore.setMergeUnchangedCheckpoints(enabled)
  }

  async function toggleAllMessageBefore(enabled: boolean) {
    const messageCheckpoint = ensureMessageCheckpoint({
      beforeMessages: enabled ? messageTypes.value.map(message => message.name) : [],
    })
    await updateConfigField('messageCheckpoint', { ...messageCheckpoint })
  }

  async function toggleAllMessageAfter(enabled: boolean) {
    const messageCheckpoint = ensureMessageCheckpoint({
      afterMessages: enabled ? messageTypes.value.map(message => message.name) : [],
    })
    await updateConfigField('messageCheckpoint', { ...messageCheckpoint })
  }

  async function toggleToolBefore(toolName: string, enabled: boolean) {
    await updateConfigField(
      'beforeTools',
      toggleNameInList([...config.beforeTools], toolName, enabled),
    )
  }

  async function toggleToolAfter(toolName: string, enabled: boolean) {
    await updateConfigField(
      'afterTools',
      toggleNameInList([...config.afterTools], toolName, enabled),
    )
  }

  async function toggleAllBefore(enabled: boolean) {
    await updateConfigField('beforeTools', enabled ? allTools.value.map(tool => tool.name) : [])
  }

  async function toggleAllAfter(enabled: boolean) {
    await updateConfigField('afterTools', enabled ? allTools.value.map(tool => tool.name) : [])
  }

  return {
    checkpointPresets,
<<<<<<< HEAD
    currentCheckpointPresetId,
=======
>>>>>>> f327a97 (merge: dev into main for v1.2.0)
    messageTypes,
    config,
    allTools,
    isLoading,
    loadConfig,
    updateConfigField,
    applyCheckpointPreset,
    toggleMessageBefore,
    toggleMessageAfter,
    toggleModelOuterLayerOnly,
    toggleMergeUnchangedCheckpoints,
    toggleAllMessageBefore,
    toggleAllMessageAfter,
    toggleToolBefore,
    toggleToolAfter,
    toggleAllBefore,
    toggleAllAfter,
  }
}
