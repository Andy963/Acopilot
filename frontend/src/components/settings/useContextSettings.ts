import { onMounted, onUnmounted, reactive, ref, toRaw } from 'vue'
import { sendToExtension } from '@/utils/vscode'
import { useI18n } from '@/i18n'

type DiagnosticSeverity = 'error' | 'warning' | 'information' | 'hint'

interface DiagnosticsConfig {
  enabled: boolean
  includeSeverities: DiagnosticSeverity[]
  workspaceOnly: boolean
  openFilesOnly: boolean
  maxDiagnosticsPerFile: number
  maxFiles: number
}

export interface ContextAwarenessConfig {
  includeWorkspaceFiles: boolean
  maxFileDepth: number
  includeOpenTabs: boolean
  maxOpenTabs: number
  includeActiveEditor: boolean
  diagnostics?: DiagnosticsConfig
  ignorePatterns: string[]
}

const DEFAULT_DIAGNOSTICS_CONFIG: DiagnosticsConfig = {
  enabled: false,
  includeSeverities: ['error', 'warning'],
  workspaceOnly: true,
  openFilesOnly: false,
  maxDiagnosticsPerFile: 10,
  maxFiles: 20,
}

const AVAILABLE_SEVERITIES: Array<{ value: DiagnosticSeverity; label: string }> = [
  { value: 'error', label: 'Error' },
  { value: 'warning', label: 'Warning' },
  { value: 'information', label: 'Information' },
  { value: 'hint', label: 'Hint' },
]

const REFRESH_INTERVAL_MS = 2000

export function useContextSettings() {
  const { t } = useI18n()

  const config = reactive<ContextAwarenessConfig>({
    includeWorkspaceFiles: true,
    maxFileDepth: 2,
    includeOpenTabs: true,
    maxOpenTabs: 20,
    includeActiveEditor: true,
    diagnostics: { ...DEFAULT_DIAGNOSTICS_CONFIG },
    ignorePatterns: [],
  })

  const availableSeverities = AVAILABLE_SEVERITIES

  const isLoading = ref(true)
  const isSaving = ref(false)
  const saveMessage = ref('')

  const newIgnorePattern = ref('')
  const openTabs = ref<string[]>([])
  const activeEditor = ref<string | null>(null)

  let refreshIntervalId: ReturnType<typeof setInterval> | null = null

  async function loadPreview() {
    try {
      const tabsResponse = await sendToExtension<{ tabs: string[] }>('getOpenTabs', {})
      if (tabsResponse?.tabs) openTabs.value = tabsResponse.tabs

      const editorResponse = await sendToExtension<{ path: string | null }>('getActiveEditor', {})
      if (editorResponse) activeEditor.value = editorResponse.path
    } catch (error) {
      console.error('Failed to load preview data:', error)
    }
  }

  async function loadConfig() {
    isLoading.value = true
    try {
      const response = await sendToExtension<ContextAwarenessConfig>('getContextAwarenessConfig', {})
      if (response) {
        if (!response.diagnostics) response.diagnostics = { ...DEFAULT_DIAGNOSTICS_CONFIG }
        Object.assign(config, response)
      }

      await loadPreview()
    } catch (error) {
      console.error('Failed to load context awareness config:', error)
    } finally {
      isLoading.value = false
    }
  }

  async function saveConfig() {
    isSaving.value = true
    saveMessage.value = ''

    try {
      const plainConfig = { ...toRaw(config) }
      await sendToExtension('updateContextAwarenessConfig', { config: plainConfig })
      saveMessage.value = t('components.settings.contextSettings.saveSuccess')
      setTimeout(() => {
        saveMessage.value = ''
      }, 2000)
    } catch (error) {
      console.error('Failed to save context awareness config:', error)
      saveMessage.value = t('components.settings.contextSettings.saveFailed')
    } finally {
      isSaving.value = false
    }
  }

  async function updateConfig<K extends keyof ContextAwarenessConfig>(
    field: K,
    value: ContextAwarenessConfig[K],
  ) {
    config[field] = value
    await saveConfig()
  }

  async function addIgnorePattern() {
    const pattern = newIgnorePattern.value.trim()
    if (!pattern) return
    if (config.ignorePatterns.includes(pattern)) return

    config.ignorePatterns.push(pattern)
    newIgnorePattern.value = ''
    await saveConfig()
  }

  async function removeIgnorePattern(index: number) {
    config.ignorePatterns.splice(index, 1)
    await saveConfig()
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    void addIgnorePattern()
  }

  async function updateDiagnosticsConfig<K extends keyof DiagnosticsConfig>(field: K, value: DiagnosticsConfig[K]) {
    if (!config.diagnostics) config.diagnostics = { ...DEFAULT_DIAGNOSTICS_CONFIG }
    config.diagnostics[field] = value
    await saveConfig()
  }

  async function toggleSeverity(severity: DiagnosticSeverity) {
    if (!config.diagnostics) config.diagnostics = { ...DEFAULT_DIAGNOSTICS_CONFIG }

    const idx = config.diagnostics.includeSeverities.indexOf(severity)
    if (idx === -1) {
      config.diagnostics.includeSeverities.push(severity)
    } else {
      config.diagnostics.includeSeverities.splice(idx, 1)
    }

    await saveConfig()
  }

  function isSeveritySelected(severity: DiagnosticSeverity): boolean {
    return config.diagnostics?.includeSeverities?.includes(severity) ?? false
  }

  function startAutoRefresh() {
    if (refreshIntervalId) clearInterval(refreshIntervalId)
    refreshIntervalId = setInterval(() => {
      void loadPreview()
    }, REFRESH_INTERVAL_MS)
  }

  function stopAutoRefresh() {
    if (!refreshIntervalId) return
    clearInterval(refreshIntervalId)
    refreshIntervalId = null
  }

  onMounted(() => {
    void loadConfig()
    startAutoRefresh()
  })

  onUnmounted(() => {
    stopAutoRefresh()
  })

  return {
    t,
    config,
    availableSeverities,
    isLoading,
    isSaving,
    saveMessage,
    newIgnorePattern,
    openTabs,
    activeEditor,
    loadConfig,
    saveConfig,
    updateConfig,
    addIgnorePattern,
    removeIgnorePattern,
    handleKeydown,
    updateDiagnosticsConfig,
    toggleSeverity,
    isSeveritySelected,
  }
}

