import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useSettingsStore, type SettingsTab } from '@/stores/settingsStore'
import { sendToExtension } from '@/utils/vscode'
import { normalizeSupportedLanguage, useI18n, SUPPORTED_LANGUAGES } from '@/i18n'
import type { SupportedLanguage } from '@/i18n/types'
import type { SelectOption } from '../common'

interface TabItem {
  id: SettingsTab
  label: string
  icon: string
}

const appVersion = __APP_VERSION__
const repositoryUrl = __APP_REPOSITORY__

const developerUrl = (() => {
  try {
    if (repositoryUrl && repositoryUrl.includes('github.com')) {
      const url = new URL(repositoryUrl)
      const parts = url.pathname.split('/').filter(Boolean)
      if (parts.length >= 1) return `${url.origin}/${parts[0]}`
    }
  } catch {
    // ignore
  }

  return 'https://github.com/Lianues'
})()

export function useSettingsPanel() {
  const settingsStore = useSettingsStore()
  const { t, setLanguage } = useI18n()

  const languageOptions = computed<SelectOption[]>(() =>
    SUPPORTED_LANGUAGES.map(lang => ({
      value: lang.value,
      label: lang.label,
      description:
        lang.value === 'auto'
          ? t('components.settings.settingsPanel.language.autoDescription')
          : lang.nativeLabel,
    })),
  )

  const tabs = computed<TabItem[]>(() => [
    { id: 'channel', label: t('components.settings.tabs.channel'), icon: 'codicon-server' },
    { id: 'tools', label: t('components.settings.tabs.tools'), icon: 'codicon-tools' },
    { id: 'checkpoint', label: t('components.settings.tabs.checkpoint'), icon: 'codicon-history' },
    { id: 'imageGen', label: t('components.settings.tabs.imageGen'), icon: 'codicon-symbol-color' },
    { id: 'context', label: t('components.settings.tabs.context'), icon: 'codicon-symbol-namespace' },
    { id: 'prompt', label: t('components.settings.tabs.prompt'), icon: 'codicon-note' },
    { id: 'general', label: t('components.settings.tabs.general'), icon: 'codicon-settings-gear' },
  ])

  const proxySettings = reactive({
    enabled: false,
    url: '',
  })

  const languageSetting = ref<SupportedLanguage>('auto')
  const isSaving = ref(false)
  const saveMessage = ref('')

  const storageSettings = reactive({
    currentPath: '',
    defaultPath: '',
    customPath: '',
    isCustom: false,
  })

  const isValidatingPath = ref(false)
  const pathValidationResult = ref<{ valid: boolean; message?: string } | null>(null)
  const isMigrating = ref(false)
  const showMigrateDialog = ref(false)
  const storageMessage = ref('')
  const storageMessageType = ref<'success' | 'error'>('success')
  const needsReload = ref(false)

  async function loadSettings() {
    try {
      const response = await sendToExtension<any>('getSettings', {})

      if (response?.settings?.proxy) {
        proxySettings.enabled = response.settings.proxy.enabled || false
        proxySettings.url = response.settings.proxy.url || ''
      }

      if (response?.settings?.ui?.language) {
        const nextLanguage = normalizeSupportedLanguage(response.settings.ui.language)
        languageSetting.value = nextLanguage
        setLanguage(nextLanguage)
      }

      await loadStorageConfig()
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  async function loadStorageConfig() {
    try {
      const response = await sendToExtension<any>('storagePath.getConfig', {})
      if (!response) return

      storageSettings.currentPath = response.effectivePath || ''
      storageSettings.defaultPath = response.defaultPath || ''
      storageSettings.customPath = response.config?.customPath || ''
      storageSettings.isCustom = Boolean(response.config?.customPath)
    } catch (error) {
      console.error('Failed to load storage config:', error)
    }
  }

  async function validateStoragePath(path: string) {
    if (!path.trim()) {
      pathValidationResult.value = null
      return
    }

    isValidatingPath.value = true
    pathValidationResult.value = null

    try {
      const response = await sendToExtension<any>('storagePath.validate', { path: path.trim() })
      pathValidationResult.value = {
        valid: response?.valid ?? false,
        message: response?.error,
      }
    } catch (error: any) {
      pathValidationResult.value = {
        valid: false,
        message: error?.message || 'Validation failed',
      }
    } finally {
      isValidatingPath.value = false
    }
  }

  let validateDebounceTimer: ReturnType<typeof setTimeout> | null = null
  function debouncedValidatePath(path: string) {
    if (validateDebounceTimer) clearTimeout(validateDebounceTimer)
    validateDebounceTimer = setTimeout(() => {
      void validateStoragePath(path)
    }, 500)
  }

  watch(
    () => storageSettings.customPath,
    (newPath) => {
      debouncedValidatePath(newPath)
    },
  )

  async function resetStoragePath() {
    isMigrating.value = true
    needsReload.value = false

    try {
      const response = await sendToExtension<any>('storagePath.reset', {})
      if (response?.success) {
        storageSettings.customPath = ''
        pathValidationResult.value = null

        storageMessage.value = t('components.settings.storageSettings.notifications.migrationSuccess')
        storageMessageType.value = 'success'
        needsReload.value = true

        await loadStorageConfig()
      } else {
        storageMessage.value = response?.error || 'Failed to reset storage path'
        storageMessageType.value = 'error'
      }
    } catch (error: any) {
      storageMessage.value = error?.message || 'Failed to reset storage path'
      storageMessageType.value = 'error'
    } finally {
      isMigrating.value = false
    }

    if (!needsReload.value) {
      setTimeout(() => {
        storageMessage.value = ''
      }, 5000)
    }
  }

  function confirmMigrate() {
    showMigrateDialog.value = true
  }

  async function executeMigration() {
    showMigrateDialog.value = false
    isMigrating.value = true
    needsReload.value = false

    try {
      const response = await sendToExtension<any>('storagePath.migrate', {
        path: storageSettings.customPath.trim(),
      })

      if (response?.success) {
        storageMessage.value = t('components.settings.storageSettings.notifications.migrationSuccess')
        storageMessageType.value = 'success'
        needsReload.value = true
        await loadStorageConfig()
      } else {
        const errorMsg = response?.error || 'Migration failed'
        storageMessage.value = t('components.settings.storageSettings.notifications.migrationFailed').replace(
          '{error}',
          errorMsg,
        )
        storageMessageType.value = 'error'
      }
    } catch (error: any) {
      storageMessage.value = t('components.settings.storageSettings.notifications.migrationFailed').replace(
        '{error}',
        error?.message || 'Unknown error',
      )
      storageMessageType.value = 'error'
    } finally {
      isMigrating.value = false
    }

    if (!needsReload.value) {
      setTimeout(() => {
        storageMessage.value = ''
      }, 5000)
    }
  }

  async function applyStoragePath() {
    const newPath = storageSettings.customPath.trim()
    if (newPath && !pathValidationResult.value?.valid) return

    if (newPath) {
      confirmMigrate()
      return
    }

    await resetStoragePath()
  }

  async function reloadWindow() {
    try {
      await sendToExtension('reloadWindow', {})
    } catch (error) {
      console.error('Failed to reload window:', error)
    }
  }

  async function saveProxySettings() {
    isSaving.value = true
    saveMessage.value = ''

    try {
      await sendToExtension('updateProxySettings', {
        proxySettings: {
          enabled: proxySettings.enabled,
          url: proxySettings.url.trim() || undefined,
        },
      })

      saveMessage.value = t('components.settings.settingsPanel.proxy.saveSuccess')
      setTimeout(() => {
        saveMessage.value = ''
      }, 2000)
    } catch (error) {
      console.error('Failed to save proxy settings:', error)
      saveMessage.value = t('components.settings.settingsPanel.proxy.saveFailed')
    } finally {
      isSaving.value = false
    }
  }

  function isValidProxyUrl(url: string): boolean {
    if (!url.trim()) return true
    try {
      const parsed = new URL(url)
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      return false
    }
  }

  async function updateLanguage(lang: string) {
    const nextLanguage = normalizeSupportedLanguage(lang)
    languageSetting.value = nextLanguage
    setLanguage(nextLanguage)

    try {
      await sendToExtension('updateUISettings', {
        ui: { language: nextLanguage },
      })
    } catch (error) {
      console.error('Failed to save language setting:', error)
    }
  }

  onMounted(() => {
    void loadSettings()
  })

  return {
    settingsStore,
    t,
    setLanguage,
    appVersion,
    repositoryUrl,
    developerUrl,
    tabs,
    proxySettings,
    languageSetting,
    languageOptions,
    updateLanguage,
    isSaving,
    saveMessage,
    saveProxySettings,
    isValidProxyUrl,
    storageSettings,
    pathValidationResult,
    isValidatingPath,
    isMigrating,
    showMigrateDialog,
    confirmMigrate,
    executeMigration,
    storageMessage,
    storageMessageType,
    needsReload,
    applyStoragePath,
    resetStoragePath,
    reloadWindow,
  }
}
