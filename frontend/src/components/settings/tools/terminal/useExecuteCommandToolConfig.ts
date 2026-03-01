import { computed, onMounted, ref } from 'vue'
import { sendToExtension } from '@/utils/vscode'
import { t } from '@/i18n'
import type { SelectOption } from '../../../common'

interface ShellConfig {
  type: string
  enabled: boolean
  path?: string
  displayName: string
  available?: boolean
  unavailableReason?: string
}

interface ExecuteCommandConfig {
  defaultShell: string
  shells: ShellConfig[]
  defaultTimeout: number
  maxOutputLines: number
  postEditValidation?: {
    enabled: boolean
    presets: Array<{
      id: string
      label: string
      command: string
      cwd?: string
      shell?: string
      timeout?: number
      kind?: 'build' | 'test' | 'lint' | 'custom'
      enabled?: boolean
    }>
  }
  riskPolicy?: {
    enabled: boolean
    autoExecuteUpTo: 'low' | 'medium' | 'high' | 'critical'
    confirmOn: {
      destructive: boolean
      gitHistory: boolean
      privilege: boolean
      network: boolean
    }
    allowPatterns: string[]
    denyPatterns: string[]
  }
}

export function useExecuteCommandToolConfig(_toolName: string) {
  const config = ref<ExecuteCommandConfig | null>(null)
  const isLoading = ref(false)
  const isSaving = ref(false)
  const error = ref<string | null>(null)

  const timeoutOptions = computed<SelectOption[]>(() => [
    { value: '30000', label: t('components.settings.toolSettings.terminal.executeCommand.timeout30s') },
    { value: '60000', label: t('components.settings.toolSettings.terminal.executeCommand.timeout1m') },
    { value: '120000', label: t('components.settings.toolSettings.terminal.executeCommand.timeout2m') },
    { value: '300000', label: t('components.settings.toolSettings.terminal.executeCommand.timeout5m') },
    { value: '600000', label: t('components.settings.toolSettings.terminal.executeCommand.timeout10m') },
    { value: '0', label: t('components.settings.toolSettings.terminal.executeCommand.timeoutUnlimited') },
  ])

  const maxOutputLinesOptions = computed<SelectOption[]>(() => [
    { value: '20', label: '20' },
    { value: '50', label: '50' },
    { value: '100', label: '100' },
    { value: '200', label: '200' },
    { value: '500', label: '500' },
    { value: '-1', label: t('components.settings.toolSettings.terminal.executeCommand.unlimitedLines') },
  ])

  const riskAutoExecuteOptions = computed<SelectOption[]>(() => [
    { value: 'low', label: t('components.settings.toolSettings.terminal.executeCommand.risk.autoExecuteUpTo.low') },
    { value: 'medium', label: t('components.settings.toolSettings.terminal.executeCommand.risk.autoExecuteUpTo.medium') },
  ])

  const validationKindOptions = computed<SelectOption[]>(() => [
    { value: 'build', label: 'build' },
    { value: 'test', label: 'test' },
    { value: 'lint', label: 'lint' },
    { value: 'custom', label: 'custom' },
  ])

  function ensureRiskPolicy() {
    if (!config.value) return
    if (!config.value.riskPolicy) {
      config.value.riskPolicy = {
        enabled: true,
        autoExecuteUpTo: 'low',
        confirmOn: { destructive: true, gitHistory: true, privilege: true, network: true },
        allowPatterns: [],
        denyPatterns: [],
      }
    }
  }

  function ensurePostEditValidation() {
    if (!config.value) return
    if (!config.value.postEditValidation) {
      config.value.postEditValidation = { enabled: true, presets: [] }
      return
    }
    if (config.value.postEditValidation.enabled === undefined) config.value.postEditValidation.enabled = true
    if (!Array.isArray(config.value.postEditValidation.presets)) config.value.postEditValidation.presets = []
  }

  async function loadConfig() {
    isLoading.value = true
    error.value = null
    try {
      const response = await sendToExtension<{ config: ExecuteCommandConfig }>('tools.getExecuteCommandConfig', {})
      if (response?.config) {
        config.value = response.config
        ensureRiskPolicy()
        ensurePostEditValidation()
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : t('components.settings.toolSettings.common.error')
      console.error('Failed to load execute_command config:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function saveConfig() {
    if (!config.value) return
    ensureRiskPolicy()
    ensurePostEditValidation()

    isSaving.value = true
    error.value = null

    try {
      const plainConfig = JSON.parse(JSON.stringify(config.value))
      await sendToExtension('tools.updateExecuteCommandConfig', { config: plainConfig })
    } catch (err) {
      error.value = err instanceof Error ? err.message : t('components.settings.toolSettings.common.error')
      console.error('Failed to save execute_command config:', err)
    } finally {
      isSaving.value = false
    }
  }

  async function toggleShell(shellType: string, enabled: boolean) {
    if (!config.value) return
    const shell = config.value.shells.find(s => s.type === shellType)
    if (!shell) return
    shell.enabled = enabled
    await saveConfig()
  }

  async function updateShellPath(shellType: string, path: string) {
    if (!config.value) return
    const shell = config.value.shells.find(s => s.type === shellType)
    if (!shell) return
    shell.path = path || undefined
    await saveConfig()
    await loadConfig()
  }

  async function setDefaultShell(shellType: string) {
    if (!config.value) return
    config.value.defaultShell = shellType
    await saveConfig()
  }

  async function updateTimeout(timeout: number) {
    if (!config.value) return
    config.value.defaultTimeout = timeout
    await saveConfig()
  }

  async function updateMaxOutputLines(lines: number) {
    if (!config.value) return
    config.value.maxOutputLines = lines
    await saveConfig()
  }

  function updateRiskEnabled(enabled: boolean) {
    if (!config.value) return
    ensureRiskPolicy()
    if (config.value.riskPolicy) config.value.riskPolicy.enabled = enabled
    void saveConfig()
  }

  function updateAutoExecuteUpTo(value: string) {
    if (!config.value) return
    ensureRiskPolicy()
    if (config.value.riskPolicy) config.value.riskPolicy.autoExecuteUpTo = value as any
    void saveConfig()
  }

  function updateConfirmOn(key: 'destructive' | 'gitHistory' | 'privilege' | 'network', value: boolean) {
    if (!config.value) return
    ensureRiskPolicy()
    if (config.value.riskPolicy) config.value.riskPolicy.confirmOn[key] = value
    void saveConfig()
  }

  function parsePatterns(text: string): string[] {
    return (text || '')
      .split(/\\r?\\n/)
      .map(s => s.trim())
      .filter(Boolean)
  }

  function patternsToText(patterns: string[] | undefined): string {
    return (patterns || []).join('\\n')
  }

  function updateAllowPatterns(text: string) {
    if (!config.value) return
    ensureRiskPolicy()
    if (config.value.riskPolicy) config.value.riskPolicy.allowPatterns = parsePatterns(text)
    void saveConfig()
  }

  function updateDenyPatterns(text: string) {
    if (!config.value) return
    ensureRiskPolicy()
    if (config.value.riskPolicy) config.value.riskPolicy.denyPatterns = parsePatterns(text)
    void saveConfig()
  }

  function updatePostEditValidationEnabled(enabled: boolean) {
    if (!config.value) return
    ensurePostEditValidation()
    if (config.value.postEditValidation) config.value.postEditValidation.enabled = enabled
    void saveConfig()
  }

  function addValidationPreset() {
    if (!config.value) return
    ensurePostEditValidation()
    const id = `preset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    config.value.postEditValidation!.presets.push({ id, label: '', command: '', kind: 'custom', enabled: true })
    void saveConfig()
  }

  function removeValidationPreset(id: string) {
    if (!config.value?.postEditValidation) return
    config.value.postEditValidation.presets = config.value.postEditValidation.presets.filter(p => p.id !== id)
    void saveConfig()
  }

  function updateValidationPresetEnabled(id: string, enabled: boolean) {
    if (!config.value?.postEditValidation) return
    const preset = config.value.postEditValidation.presets.find(p => p.id === id)
    if (!preset) return
    preset.enabled = enabled
    void saveConfig()
  }

  function getShellIcon(type: string): string {
    const icons: Record<string, string> = {
      powershell: 'codicon-terminal-powershell',
      cmd: 'codicon-terminal-cmd',
      bash: 'codicon-terminal-bash',
      zsh: 'codicon-terminal-bash',
      sh: 'codicon-terminal',
      gitbash: 'codicon-terminal-bash',
      wsl: 'codicon-terminal-linux',
    }
    return icons[type] || 'codicon-terminal'
  }

  onMounted(() => {
    void loadConfig()
  })

  return {
    t,
    config,
    isLoading,
    isSaving,
    error,
    timeoutOptions,
    maxOutputLinesOptions,
    riskAutoExecuteOptions,
    validationKindOptions,
    loadConfig,
    saveConfig,
    toggleShell,
    updateShellPath,
    setDefaultShell,
    updateTimeout,
    updateMaxOutputLines,
    updateRiskEnabled,
    updateAutoExecuteUpTo,
    updateConfirmOn,
    patternsToText,
    updateAllowPatterns,
    updateDenyPatterns,
    updatePostEditValidationEnabled,
    addValidationPreset,
    removeValidationPreset,
    updateValidationPresetEnabled,
    getShellIcon,
  }
}

