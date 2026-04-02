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

export function useCheckpointSettingsConfig() {
  const chatStore = useChatStore()

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
    cleanupExpiredConversationsOnStartup: false,
    expiredConversationRetentionDays: 30,
  })

  const allTools = ref<ToolInfo[]>([])
  const isLoading = ref(false)

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
    ;(config as any)[field] = value

    try {
      await sendToExtension('checkpoint.updateConfig', {
        config: {
          enabled: config.enabled,
          beforeTools: [...config.beforeTools],
          afterTools: [...config.afterTools],
          messageCheckpoint: normalizeMessageCheckpoint(config.messageCheckpoint),
          maxCheckpoints: config.maxCheckpoints,
          cleanupExpiredConversationsOnStartup: config.cleanupExpiredConversationsOnStartup ?? false,
          expiredConversationRetentionDays: config.expiredConversationRetentionDays ?? 30,
          customIgnorePatterns: config.customIgnorePatterns ? [...config.customIgnorePatterns] : [],
        },
      })
    } catch (error) {
      console.error('Failed to save checkpoint config:', error)
    }
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
    messageTypes,
    config,
    allTools,
    isLoading,
    loadConfig,
    updateConfigField,
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
