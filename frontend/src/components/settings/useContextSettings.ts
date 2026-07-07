import { computed, onMounted, onUnmounted, reactive, ref, toRaw } from 'vue'
import { sendToExtension } from '@/utils/vscode'
import { useI18n } from '@/i18n'
import { useChatStore, useSettingsStore } from '@/stores'

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

interface ContextSettingsPreview {
  workspaceFiles: {
    preview: string
    charCount: number
    estimatedTokens: number
    truncated: boolean
    lineCount: number
  }
  diagnostics: {
    files: number
    items: number
    preview: string
    charCount: number
    estimatedTokens: number
    truncated: boolean
  }
  ignorePatterns: {
    scannedFiles: number
    matchedFiles: number
    samples: string[]
    byPattern: Array<{
      pattern: string
      count: number
      samples: string[]
    }>
  }
}

type DiagnosticsPresetId = 'errorsOnly' | 'openFilesFirst' | 'workspace'

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
  const chatStore = useChatStore()
  const settingsStore = useSettingsStore()

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
  const previewStats = ref<ContextSettingsPreview | null>(null)

  let refreshIntervalId: ReturnType<typeof setInterval> | null = null

  const diagnosticsPresets: Array<{ id: DiagnosticsPresetId; icon: string }> = [
    { id: 'errorsOnly', icon: 'codicon-error' },
    { id: 'openFilesFirst', icon: 'codicon-files' },
    { id: 'workspace', icon: 'codicon-root-folder' },
  ]

  function estimateTokensFromChars(chars: number): number {
    if (!Number.isFinite(chars) || chars <= 0) return 0
    return Math.max(1, Math.ceil(chars / 4))
  }

  const activeEditorCost = computed(() => {
    const chars = activeEditor.value ? `Currently active file: ${activeEditor.value}`.length : 0
    return { chars, tokens: estimateTokensFromChars(chars) }
  })

  const openTabsCost = computed(() => {
    const maxTabs = config.maxOpenTabs === -1 ? openTabs.value.length : config.maxOpenTabs
    const tabs = openTabs.value.slice(0, Math.max(0, maxTabs))
    const chars = tabs.length > 0
      ? `Currently open files in editor:\n${tabs.map(tab => `  - ${tab}`).join('\n')}`.length
      : 0
    return { chars, tokens: estimateTokensFromChars(chars) }
  })

  const workspaceFilesCost = computed(() => ({
    chars: previewStats.value?.workspaceFiles.charCount ?? 0,
    tokens: previewStats.value?.workspaceFiles.estimatedTokens ?? 0,
  }))

  const diagnosticsCost = computed(() => ({
    chars: previewStats.value?.diagnostics.charCount ?? 0,
    tokens: previewStats.value?.diagnostics.estimatedTokens ?? 0,
  }))

  const totalEstimatedCost = computed(() => {
    const chars =
      (config.includeWorkspaceFiles ? workspaceFilesCost.value.chars : 0) +
      (config.includeOpenTabs ? openTabsCost.value.chars : 0) +
      (config.includeActiveEditor ? activeEditorCost.value.chars : 0) +
      (config.diagnostics?.enabled ? diagnosticsCost.value.chars : 0)

    return { chars, tokens: estimateTokensFromChars(chars) }
  })

  function formatCost(cost: { chars: number; tokens: number }): string {
    return t('components.settings.contextSettings.cost.badge', {
      tokens: cost.tokens,
      chars: cost.chars,
    })
  }

  async function loadPreview(includeStats = false) {
    try {
      const tabsResponse = await sendToExtension<{ tabs: string[] }>('getOpenTabs', {})
      if (tabsResponse?.tabs) openTabs.value = tabsResponse.tabs

      const editorResponse = await sendToExtension<{ path: string | null }>('getActiveEditor', {})
      if (editorResponse) activeEditor.value = editorResponse.path

      if (includeStats) {
        const statsResponse = await sendToExtension<ContextSettingsPreview>('getContextSettingsPreview', {})
        if (statsResponse) previewStats.value = statsResponse
      }
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

      await loadPreview(true)
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
    await loadPreview(true)
  }

  async function addIgnorePattern() {
    const pattern = newIgnorePattern.value.trim()
    if (!pattern) return
    if (config.ignorePatterns.includes(pattern)) return

    config.ignorePatterns.push(pattern)
    newIgnorePattern.value = ''
    await saveConfig()
    await loadPreview(true)
  }

  async function removeIgnorePattern(index: number) {
    config.ignorePatterns.splice(index, 1)
    await saveConfig()
    await loadPreview(true)
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
    await loadPreview(true)
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
    await loadPreview(true)
  }

  function isSeveritySelected(severity: DiagnosticSeverity): boolean {
    return config.diagnostics?.includeSeverities?.includes(severity) ?? false
  }

  async function applyDiagnosticsPreset(preset: DiagnosticsPresetId) {
    if (!config.diagnostics) config.diagnostics = { ...DEFAULT_DIAGNOSTICS_CONFIG }

    if (preset === 'errorsOnly') {
      Object.assign(config.diagnostics, {
        enabled: true,
        includeSeverities: ['error'],
        workspaceOnly: true,
        openFilesOnly: false,
        maxDiagnosticsPerFile: 20,
        maxFiles: 50,
      })
    } else if (preset === 'openFilesFirst') {
      Object.assign(config.diagnostics, {
        enabled: true,
        includeSeverities: ['error', 'warning'],
        workspaceOnly: true,
        openFilesOnly: true,
        maxDiagnosticsPerFile: 10,
        maxFiles: 20,
      })
    } else {
      Object.assign(config.diagnostics, {
        enabled: true,
        includeSeverities: ['error', 'warning', 'information'],
        workspaceOnly: true,
        openFilesOnly: false,
        maxDiagnosticsPerFile: 10,
        maxFiles: 50,
      })
    }

    await saveConfig()
    await loadPreview(true)
  }

  async function openCurrentContextInspector() {
    settingsStore.showChat()
    await chatStore.openContextInspectorPreview()
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
    previewStats,
    diagnosticsPresets,
    activeEditorCost,
    openTabsCost,
    workspaceFilesCost,
    diagnosticsCost,
    totalEstimatedCost,
    formatCost,
    loadConfig,
    saveConfig,
    loadPreview,
    updateConfig,
    addIgnorePattern,
    removeIgnorePattern,
    handleKeydown,
    updateDiagnosticsConfig,
    toggleSeverity,
    isSeveritySelected,
    applyDiagnosticsPreset,
    openCurrentContextInspector,
  }
}

