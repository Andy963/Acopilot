import { computed, onMounted, reactive, ref } from 'vue'
import { sendToExtension } from '@/utils/vscode'
import { useI18n } from '@/i18n'
import type {
  CreateMcpServerInput,
  McpServerConfig,
  McpServerInfo,
  McpServerStatus,
  McpTransportConfig,
} from '@/types'

type ViewMode = 'list' | 'edit'

export function useMcpSettings() {
  const { t } = useI18n()

  const servers = ref<McpServerInfo[]>([])
  const isLoading = ref(false)

  const viewMode = ref<ViewMode>('list')
  const editingServer = ref<McpServerConfig | null>(null)
  const isCreating = ref(false)

  const formData = reactive<{
    customId: string
    name: string
    description: string
    transportType: 'stdio' | 'sse' | 'streamable-http'
    command: string
    args: string
    env: string
    url: string
    headers: string
    enabled: boolean
    autoConnect: boolean
    timeout: number
    cleanSchema: boolean
  }>({
    customId: '',
    name: '',
    description: '',
    transportType: 'stdio',
    command: '',
    args: '',
    env: '',
    url: '',
    headers: '',
    enabled: true,
    autoConnect: false,
    timeout: 30000,
    cleanSchema: true,
  })

  const idValidation = reactive<{ checking: boolean; valid: boolean | null; error: string }>({
    checking: false,
    valid: null,
    error: '',
  })

  let idCheckTimer: ReturnType<typeof setTimeout> | null = null

  const isSaving = ref(false)
  const saveError = ref('')

  const showDeleteConfirm = ref(false)
  const deleteTargetServer = ref<McpServerInfo | null>(null)

  const connectingServers = ref<Set<string>>(new Set())

  const hasServers = computed(() => servers.value.length > 0)

  function statusColor(status: McpServerStatus): string {
    switch (status) {
      case 'connected':
        return 'var(--vscode-terminal-ansiGreen)'
      case 'connecting':
        return 'var(--vscode-terminal-ansiYellow)'
      case 'error':
        return 'var(--vscode-terminal-ansiRed)'
      default:
        return 'var(--vscode-descriptionForeground)'
    }
  }

  function statusText(status: McpServerStatus): string {
    switch (status) {
      case 'connected':
        return t('components.settings.mcpSettings.status.connected')
      case 'connecting':
        return t('components.settings.mcpSettings.status.connecting')
      case 'error':
        return t('components.settings.mcpSettings.status.error')
      default:
        return t('components.settings.mcpSettings.status.disconnected')
    }
  }

  async function loadServers(triggerAutoConnect = false) {
    isLoading.value = true
    try {
      const response = await sendToExtension<{ success: boolean; servers?: McpServerInfo[]; error?: any }>(
        'getMcpServers',
        {},
      )
      if (response?.success && response.servers) {
        servers.value = response.servers
        if (triggerAutoConnect) autoConnectServers()
      }
    } catch (error) {
      console.error('Failed to load MCP servers:', error)
    } finally {
      isLoading.value = false
    }
  }

  function autoConnectServers() {
    const serversToConnect = servers.value.filter(
      s => s.config.enabled && s.config.autoConnect && s.status === 'disconnected',
    )
    for (const server of serversToConnect) void tryAutoConnect(server)
  }

  async function tryAutoConnect(server: McpServerInfo) {
    const serverId = server.config.id
    if (connectingServers.value.has(serverId)) return

    connectingServers.value.add(serverId)
    try {
      await sendToExtension('connectMcpServer', { serverId })
      await loadServers()
    } catch (error) {
      console.error(`Auto-connect ${serverId} failed:`, error)
    } finally {
      connectingServers.value.delete(serverId)
    }
  }

  function resetForm() {
    formData.customId = ''
    formData.name = ''
    formData.description = ''
    formData.transportType = 'stdio'
    formData.command = ''
    formData.args = ''
    formData.env = ''
    formData.url = ''
    formData.headers = ''
    formData.enabled = true
    formData.autoConnect = false
    formData.timeout = 30000
    formData.cleanSchema = true

    saveError.value = ''
    idValidation.checking = false
    idValidation.valid = null
    idValidation.error = ''
  }

  function loadFormFromConfig(config: McpServerConfig) {
    formData.name = config.name
    formData.description = config.description || ''
    formData.enabled = config.enabled
    formData.autoConnect = config.autoConnect
    formData.timeout = config.timeout || 30000
    formData.cleanSchema = config.cleanSchema !== false

    const transport = config.transport
    formData.transportType = transport.type

    if (transport.type === 'stdio') {
      formData.command = transport.command
      formData.args = transport.args?.join(' ') || ''
      formData.env = transport.env ? JSON.stringify(transport.env, null, 2) : ''
    } else {
      formData.url = transport.url
      formData.headers = transport.headers ? JSON.stringify(transport.headers, null, 2) : ''
    }
  }

  function startCreate() {
    isCreating.value = true
    editingServer.value = null
    resetForm()
    viewMode.value = 'edit'
  }

  function startEdit(server: McpServerInfo) {
    isCreating.value = false
    editingServer.value = server.config
    loadFormFromConfig(server.config)
    viewMode.value = 'edit'
  }

  function cancelEdit() {
    viewMode.value = 'list'
    editingServer.value = null
    isCreating.value = false
    resetForm()
  }

  async function checkIdAvailability(id: string) {
    if (!id.trim()) {
      idValidation.valid = null
      idValidation.error = ''
      return
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      idValidation.valid = false
      idValidation.error = t('components.settings.mcpSettings.form.serverIdError')
      return
    }

    idValidation.checking = true
    try {
      const response = await sendToExtension<{ success: boolean; valid?: boolean; error?: string }>(
        'validateMcpServerId',
        { id: id.trim(), excludeId: editingServer.value?.id },
      )
      if (response?.success) {
        idValidation.valid = response.valid ?? true
        idValidation.error = response.error || ''
      } else {
        idValidation.valid = null
        idValidation.error = ''
      }
    } catch (error) {
      console.error('Failed to validate server id:', error)
      idValidation.valid = null
      idValidation.error = ''
    } finally {
      idValidation.checking = false
    }
  }

  function scheduleIdCheck() {
    if (idCheckTimer) clearTimeout(idCheckTimer)
    idCheckTimer = setTimeout(() => {
      void checkIdAvailability(formData.customId)
    }, 400)
  }

  function onIdInput() {
    scheduleIdCheck()
  }

  function parseJsonObject(value: string, fieldName: string): Record<string, string> | undefined {
    const raw = value.trim()
    if (!raw) return undefined
    try {
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Expected a JSON object')
      }
      const out: Record<string, string> = {}
      for (const [k, v] of Object.entries(parsed)) out[String(k)] = String(v)
      return out
    } catch (error: any) {
      throw new Error(`${fieldName}: ${error?.message || 'Invalid JSON'}`)
    }
  }

  function buildTransportConfig(): McpTransportConfig {
    if (formData.transportType === 'stdio') {
      return {
        type: 'stdio',
        command: formData.command.trim(),
        args: formData.args.trim() ? formData.args.trim().split(/\\s+/) : [],
        env: parseJsonObject(formData.env, 'env'),
      }
    }

    return {
      type: formData.transportType,
      url: formData.url.trim(),
      headers: parseJsonObject(formData.headers, 'headers'),
    }
  }

  function validateForm(): string | null {
    if (isCreating.value) {
      if (!formData.customId.trim()) return t('components.settings.mcpSettings.validation.idRequired')
      if (idValidation.valid === false) return idValidation.error || t('components.settings.mcpSettings.validation.invalidId')
    }

    if (!formData.name.trim()) return t('components.settings.mcpSettings.validation.nameRequired')

    if (formData.transportType === 'stdio') {
      if (!formData.command.trim()) return t('components.settings.mcpSettings.validation.commandRequired')
    } else {
      if (!formData.url.trim()) return t('components.settings.mcpSettings.validation.urlRequired')
    }

    if (formData.timeout <= 0) return t('components.settings.mcpSettings.validation.timeoutInvalid')

    return null
  }

  async function saveServer() {
    const validationError = validateForm()
    if (validationError) {
      saveError.value = validationError
      return
    }

    isSaving.value = true
    saveError.value = ''

    try {
      const transport = buildTransportConfig()

      if (isCreating.value) {
        const input: CreateMcpServerInput = {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          transport,
          enabled: formData.enabled,
          autoConnect: formData.autoConnect,
          timeout: formData.timeout,
          cleanSchema: formData.cleanSchema,
        }

        const response = await sendToExtension<{ success: boolean; error?: any }>('createMcpServer', {
          input,
          customId: formData.customId.trim(),
        })
        if (!response?.success) {
          throw new Error(response?.error?.message || t('components.settings.mcpSettings.validation.createFailed'))
        }
      } else if (editingServer.value) {
        const updates = {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          transport,
          enabled: formData.enabled,
          autoConnect: formData.autoConnect,
          timeout: formData.timeout,
          cleanSchema: formData.cleanSchema,
        }

        const response = await sendToExtension<{ success: boolean; error?: any }>('updateMcpServer', {
          serverId: editingServer.value.id,
          updates,
        })
        if (!response?.success) {
          throw new Error(response?.error?.message || t('components.settings.mcpSettings.validation.updateFailed'))
        }
      }

      viewMode.value = 'list'
      await loadServers()
    } catch (error: any) {
      saveError.value = error.message || 'Save failed'
    } finally {
      isSaving.value = false
    }
  }

  function showDeleteDialog(server: McpServerInfo) {
    deleteTargetServer.value = server
    showDeleteConfirm.value = true
  }

  async function confirmDeleteServer() {
    if (!deleteTargetServer.value) return
    try {
      const response = await sendToExtension<{ success: boolean; error?: any }>('deleteMcpServer', {
        serverId: deleteTargetServer.value.config.id,
      })
      if (response?.success) await loadServers()
    } catch (error) {
      console.error('Failed to delete server:', error)
    }
  }

  function getDisplayStatus(server: McpServerInfo): McpServerStatus {
    if (connectingServers.value.has(server.config.id)) return 'connecting'
    return server.status
  }

  async function toggleConnection(server: McpServerInfo) {
    const serverId = server.config.id
    try {
      if (server.status === 'connected') {
        await sendToExtension('disconnectMcpServer', { serverId })
      } else {
        connectingServers.value.add(serverId)
        await sendToExtension('connectMcpServer', { serverId })
      }
      await loadServers()
    } catch (error) {
      console.error('Failed to toggle connection:', error)
    } finally {
      connectingServers.value.delete(serverId)
    }
  }

  async function toggleEnabled(server: McpServerInfo) {
    const serverId = server.config.id
    const newEnabled = !server.config.enabled

    try {
      await sendToExtension('setMcpServerEnabled', { serverId, enabled: newEnabled })
      await loadServers()

      if (newEnabled && server.config.autoConnect) {
        const updated = servers.value.find(s => s.config.id === serverId)
        if (updated && updated.status === 'disconnected') void tryAutoConnect(updated)
      }
    } catch (error) {
      console.error('Failed to toggle enabled:', error)
    }
  }

  async function openConfigFile() {
    try {
      await sendToExtension('openMcpConfigFile', {})
    } catch (error) {
      console.error('Failed to open config file:', error)
    }
  }

  onMounted(() => {
    void loadServers(true)
  })

  return {
    t,
    servers,
    isLoading,
    viewMode,
    editingServer,
    isCreating,
    formData,
    idValidation,
    isSaving,
    saveError,
    showDeleteConfirm,
    deleteTargetServer,
    connectingServers,
    hasServers,
    statusColor,
    statusText,
    loadServers,
    startCreate,
    startEdit,
    cancelEdit,
    scheduleIdCheck,
    onIdInput,
    saveServer,
    showDeleteDialog,
    confirmDeleteServer,
    getDisplayStatus,
    toggleConnection,
    toggleEnabled,
    openConfigFile,
  }
}
