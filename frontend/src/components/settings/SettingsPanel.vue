<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { useSettingsStore, type SettingsTab } from '@/stores/settingsStore'
import ChannelSettings from './ChannelSettings.vue'
import ToolsSettings from './ToolsSettings.vue'
import McpSettings from './McpSettings.vue'
import CheckpointSettings from './CheckpointSettings.vue'
import SummarizeSettings from './SummarizeSettings.vue'
import GenerateImageSettings from './GenerateImageSettings.vue'
import DependencySettings from './DependencySettings.vue'
import ContextSettings from './ContextSettings.vue'
import PromptSettings from './PromptSettings.vue'
import TokenCountSettings from './TokenCountSettings.vue'
import { CustomScrollbar, CustomCheckbox, CustomSelect, Modal, type SelectOption } from '../common'
import { sendToExtension } from '@/utils/vscode'
import { useI18n, SUPPORTED_LANGUAGES } from '@/i18n'

const settingsStore = useSettingsStore()
const { t, setLanguage } = useI18n()

// 应用信息
const appVersion = __APP_VERSION__
const repositoryUrl = __APP_REPOSITORY__
// 开发者链接：如果 repositoryUrl 包含 github.com，尝试提取用户部分作为开发者链接，否则使用默认值
const developerUrl = (() => {
  try {
    if (repositoryUrl && repositoryUrl.includes('github.com')) {
      const url = new URL(repositoryUrl)
      const pathParts = url.pathname.split('/').filter(p => p)
      if (pathParts.length >= 1) {
        return `${url.origin}/${pathParts[0]}`
      }
    }
  } catch (e) {
    // ignore
  }
  return 'https://github.com/Lianues' // Fallback
})()

interface TabItem {
  id: SettingsTab
  label: string
  icon: string
}

// 语言选项（使用 computed 以便语言切换时自动更新）
const languageOptions = computed<SelectOption[]>(() => SUPPORTED_LANGUAGES.map(lang => ({
  value: lang.value,
  label: lang.label,
  description: lang.value === 'auto' ? t('components.settings.settingsPanel.language.autoDescription') : lang.nativeLabel
})))

// 页签列表（使用 computed 以便语言切换时自动更新）
const tabs = computed<TabItem[]>(() => [
  { id: 'channel', label: t('components.settings.tabs.channel'), icon: 'codicon-server' },
  { id: 'tools', label: t('components.settings.tabs.tools'), icon: 'codicon-tools' },
  { id: 'mcp', label: t('components.settings.tabs.mcp'), icon: 'codicon-plug' },
  { id: 'checkpoint', label: t('components.settings.tabs.checkpoint'), icon: 'codicon-history' },
  { id: 'summarize', label: t('components.settings.tabs.summarize'), icon: 'codicon-fold' },
  { id: 'imageGen', label: t('components.settings.tabs.imageGen'), icon: 'codicon-symbol-color' },
  { id: 'dependencies', label: t('components.settings.tabs.dependencies'), icon: 'codicon-package' },
  { id: 'context', label: t('components.settings.tabs.context'), icon: 'codicon-symbol-namespace' },
  { id: 'prompt', label: t('components.settings.tabs.prompt'), icon: 'codicon-note' },
  { id: 'tokenCount', label: t('components.settings.tabs.tokenCount'), icon: 'codicon-symbol-numeric' },
  { id: 'general', label: t('components.settings.tabs.general'), icon: 'codicon-settings-gear' },
])

// 代理设置
const proxySettings = reactive({
  enabled: false,
  url: ''
})

// 语言设置
const languageSetting = ref<string>('auto')

// 是否正在保存
const isSaving = ref(false)
// 保存状态消息
const saveMessage = ref('')

// 存储路径设置
const storageSettings = reactive({
  currentPath: '',
  defaultPath: '',
  customPath: '',
  isCustom: false
})
const isValidatingPath = ref(false)
const pathValidationResult = ref<{ valid: boolean; message?: string } | null>(null)
const isMigrating = ref(false)
const showMigrateDialog = ref(false)
const storageMessage = ref('')
const storageMessageType = ref<'success' | 'error'>('success')
const needsReload = ref(false) // 迁移完成后需要重新加载

// 加载设置
async function loadSettings() {
  try {
    const response = await sendToExtension<any>('getSettings', {})
    if (response?.settings?.proxy) {
      proxySettings.enabled = response.settings.proxy.enabled || false
      proxySettings.url = response.settings.proxy.url || ''
    }
    // 加载语言设置
    if (response?.settings?.ui?.language) {
      languageSetting.value = response.settings.ui.language
      setLanguage(response.settings.ui.language)
    }
    
    // 加载存储路径配置
    await loadStorageConfig()
  } catch (error) {
    console.error('Failed to load settings:', error)
  }
}

// 加载存储路径配置
async function loadStorageConfig() {
  try {
    const response = await sendToExtension<any>('storagePath.getConfig', {})
    if (response) {
      storageSettings.currentPath = response.effectivePath || ''
      storageSettings.defaultPath = response.defaultPath || ''
      storageSettings.customPath = response.config?.customPath || ''
      storageSettings.isCustom = !!response.config?.customPath
    }
  } catch (error) {
    console.error('Failed to load storage config:', error)
  }
}

// 验证路径
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
      message: response?.error
    }
  } catch (error: any) {
    pathValidationResult.value = {
      valid: false,
      message: error?.message || 'Validation failed'
    }
  } finally {
    isValidatingPath.value = false
  }
}

// 防抖验证
let validateDebounceTimer: ReturnType<typeof setTimeout> | null = null
function debouncedValidatePath(path: string) {
  if (validateDebounceTimer) {
    clearTimeout(validateDebounceTimer)
  }
  validateDebounceTimer = setTimeout(() => {
    validateStoragePath(path)
  }, 500)
}

// 监听自定义路径变化
watch(() => storageSettings.customPath, (newPath) => {
  debouncedValidatePath(newPath)
})

// 应用存储路径（不迁移数据，只是更改配置）
async function applyStoragePath() {
  const newPath = storageSettings.customPath.trim()
  
  if (newPath && !pathValidationResult.value?.valid) {
    return
  }
  
  // 使用迁移接口来应用新路径（迁移到新路径）
  if (newPath) {
    confirmMigrate()
  } else {
    // 重置为默认路径
    await resetStoragePath()
  }
}

// 重置为默认路径
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
      needsReload.value = true  // 重置也需要重新加载窗口才能生效
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
  
  // 只有非成功消息才自动消失
  if (!needsReload.value) {
    setTimeout(() => {
      storageMessage.value = ''
    }, 5000)
  }
}

// 打开迁移确认对话框
function confirmMigrate() {
  showMigrateDialog.value = true
}

// 执行数据迁移
async function executeMigration() {
  showMigrateDialog.value = false
  isMigrating.value = true
  needsReload.value = false
  
  try {
    const response = await sendToExtension<any>('storagePath.migrate', {
      path: storageSettings.customPath.trim()
    })
    
    if (response?.success) {
      storageMessage.value = t('components.settings.storageSettings.notifications.migrationSuccess')
      storageMessageType.value = 'success'
      needsReload.value = true  // 迁移成功，需要重新加载
      await loadStorageConfig()
    } else {
      const errorMsg = response?.error || 'Migration failed'
      storageMessage.value = t('components.settings.storageSettings.notifications.migrationFailed').replace('{error}', errorMsg)
      storageMessageType.value = 'error'
    }
  } catch (error: any) {
    storageMessage.value = t('components.settings.storageSettings.notifications.migrationFailed').replace('{error}', error?.message || 'Unknown error')
    storageMessageType.value = 'error'
  } finally {
    isMigrating.value = false
  }
  
  // 只有非成功消息才自动消失
  if (!needsReload.value) {
    setTimeout(() => {
      storageMessage.value = ''
    }, 5000)
  }
}

// 重新加载窗口
async function reloadWindow() {
  try {
    await sendToExtension('reloadWindow', {})
  } catch (error) {
    console.error('Failed to reload window:', error)
  }
}

// 保存代理设置
async function saveProxySettings() {
  isSaving.value = true
  saveMessage.value = ''
  
  try {
    await sendToExtension('updateProxySettings', {
      proxySettings: {
        enabled: proxySettings.enabled,
        url: proxySettings.url.trim() || undefined
      }
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

// 验证代理 URL 格式
function isValidProxyUrl(url: string): boolean {
  if (!url.trim()) return true // 空值允许
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

// 更新语言设置
async function updateLanguage(lang: string) {
  languageSetting.value = lang
  setLanguage(lang as any)
  
  try {
    await sendToExtension('updateUISettings', {
      ui: { language: lang }
    })
  } catch (error) {
    console.error('Failed to save language setting:', error)
  }
}

// 初始化
onMounted(() => {
  loadSettings()
})
</script>

<template>
  <div class="settings-panel">
    <div class="settings-header">
      <h3>{{ t('components.settings.settingsPanel.title') }}</h3>
      <button class="settings-close-btn" :title="t('components.settings.settingsPanel.backToChat')" @click="settingsStore.showChat">
        <i class="codicon codicon-close"></i>
      </button>
    </div>
    
    <div class="settings-content">
      <!-- 左侧页签（仅图标，悬浮显示文字在右侧） -->
      <div class="settings-sidebar">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="['settings-tab', { active: settingsStore.activeTab === tab.id }]"
          :data-tooltip="tab.label"
          @click="settingsStore.setActiveTab(tab.id)"
        >
          <i :class="['codicon', tab.icon]"></i>
        </button>
      </div>
      
      <!-- 右侧内容 -->
      <CustomScrollbar class="settings-main-scrollbar">
        <div class="settings-main">
          <!-- 渠道设置 -->
          <div v-if="settingsStore.activeTab === 'channel'" class="settings-section">
            <h4>{{ t('components.settings.settingsPanel.sections.channel.title') }}</h4>
            <p class="settings-description">{{ t('components.settings.settingsPanel.sections.channel.description') }}</p>
            
            <ChannelSettings />
          </div>
          
          <!-- 工具设置 -->
          <div v-if="settingsStore.activeTab === 'tools'" class="settings-section">
            <h4>{{ t('components.settings.settingsPanel.sections.tools.title') }}</h4>
            <p class="settings-description">{{ t('components.settings.settingsPanel.sections.tools.description') }}</p>
            
            <ToolsSettings />
          </div>
          
          <!-- MCP 设置 -->
          <div v-if="settingsStore.activeTab === 'mcp'" class="settings-section">
            <h4>{{ t('components.settings.settingsPanel.sections.mcp.title') }}</h4>
            <p class="settings-description">{{ t('components.settings.settingsPanel.sections.mcp.description') }}</p>
            
            <McpSettings />
          </div>
          
          <!-- 存档点设置 -->
          <div v-if="settingsStore.activeTab === 'checkpoint'" class="settings-section">
            <h4>{{ t('components.settings.settingsPanel.sections.checkpoint.title') }}</h4>
            <p class="settings-description">{{ t('components.settings.settingsPanel.sections.checkpoint.description') }}</p>
            
            <CheckpointSettings />
          </div>
          
          <!-- 总结设置 -->
          <div v-if="settingsStore.activeTab === 'summarize'" class="settings-section">
            <h4>{{ t('components.settings.settingsPanel.sections.summarize.title') }}</h4>
            <p class="settings-description">{{ t('components.settings.settingsPanel.sections.summarize.description') }}</p>
            
            <SummarizeSettings />
          </div>
          
          <!-- 图像生成设置 -->
          <div v-if="settingsStore.activeTab === 'imageGen'" class="settings-section">
            <h4>{{ t('components.settings.settingsPanel.sections.imageGen.title') }}</h4>
            <p class="settings-description">{{ t('components.settings.settingsPanel.sections.imageGen.description') }}</p>
            
            <GenerateImageSettings />
          </div>
          
          <!-- 扩展依赖设置 -->
          <div v-if="settingsStore.activeTab === 'dependencies'" class="settings-section">
            <DependencySettings />
          </div>
          
          <!-- 上下文感知设置 -->
          <div v-if="settingsStore.activeTab === 'context'" class="settings-section">
            <h4>{{ t('components.settings.settingsPanel.sections.context.title') }}</h4>
            <p class="settings-description">{{ t('components.settings.settingsPanel.sections.context.description') }}</p>
            
            <ContextSettings />
          </div>
          
          <!-- 提示词设置 -->
          <div v-if="settingsStore.activeTab === 'prompt'" class="settings-section">
            <h4>{{ t('components.settings.settingsPanel.sections.prompt.title') }}</h4>
            <p class="settings-description">{{ t('components.settings.settingsPanel.sections.prompt.description') }}</p>
            
            <PromptSettings />
          </div>
          
          <!-- Token 计数设置 -->
          <div v-if="settingsStore.activeTab === 'tokenCount'" class="settings-section">
            <h4>{{ t('components.settings.settingsPanel.sections.tokenCount.title') }}</h4>
            <p class="settings-description">{{ t('components.settings.settingsPanel.sections.tokenCount.description') }}</p>
            
            <TokenCountSettings />
          </div>
          
          <!-- 通用设置 -->
          <div v-if="settingsStore.activeTab === 'general'" class="settings-section">
            <h4>{{ t('components.settings.settingsPanel.sections.general.title') }}</h4>
            <p class="settings-description">{{ t('components.settings.settingsPanel.sections.general.description') }}</p>
            
            <div class="settings-form">
              <!-- 代理设置 -->
              <div class="form-group">
                <label class="group-label">
                  <i class="codicon codicon-globe"></i>
                  {{ t('components.settings.settingsPanel.proxy.title') }}
                </label>
                <p class="field-description">{{ t('components.settings.settingsPanel.proxy.description') }}</p>
                
                <div class="proxy-settings">
                  <div class="proxy-enable">
                    <CustomCheckbox
                      v-model="proxySettings.enabled"
                      :label="t('components.settings.settingsPanel.proxy.enable')"
                    />
                  </div>
                  
                  <div class="proxy-url-group" :class="{ disabled: !proxySettings.enabled }">
                    <label>{{ t('components.settings.settingsPanel.proxy.url') }}</label>
                    <input
                      type="text"
                      v-model="proxySettings.url"
                      :placeholder="t('components.settings.settingsPanel.proxy.urlPlaceholder')"
                      :disabled="!proxySettings.enabled"
                      class="proxy-url-input"
                      :class="{ invalid: proxySettings.url && !isValidProxyUrl(proxySettings.url) }"
                    />
                    <p v-if="proxySettings.url && !isValidProxyUrl(proxySettings.url)" class="error-hint">
                      {{ t('components.settings.settingsPanel.proxy.urlError') }}
                    </p>
                  </div>
                  
                  <div class="proxy-actions">
                    <button
                      class="save-btn"
                      @click="saveProxySettings"
                      :disabled="isSaving || (!!proxySettings.url && !isValidProxyUrl(proxySettings.url))"
                    >
                      <i v-if="isSaving" class="codicon codicon-loading codicon-modifier-spin"></i>
                      <span v-else>{{ t('components.settings.settingsPanel.proxy.save') }}</span>
                    </button>
                    <span v-if="saveMessage" class="save-message" :class="{ success: saveMessage === t('components.settings.settingsPanel.proxy.saveSuccess') }">
                      {{ saveMessage }}
                    </span>
                  </div>
                </div>
              </div>
              
              <div class="divider"></div>
              
              <!-- 语言设置 -->
              <div class="form-group">
                <label class="group-label">
                  <i class="codicon codicon-globe"></i>
                  {{ t('components.settings.settingsPanel.language.title') }}
                </label>
                <p class="field-description">{{ t('components.settings.settingsPanel.language.description') }}</p>
                
                <div class="language-settings">
                  <CustomSelect
                    :model-value="languageSetting"
                    :options="languageOptions"
                    :placeholder="t('components.settings.settingsPanel.language.placeholder')"
                    @update:model-value="updateLanguage"
                  />
                </div>
              </div>
              
              <div class="divider"></div>
              
              <!-- 存储路径设置 -->
              <div class="form-group">
                <label class="group-label">
                  <i class="codicon codicon-folder"></i>
                  {{ t('components.settings.storageSettings.title') }}
                </label>
                <p class="field-description">{{ t('components.settings.storageSettings.description') }}</p>
                
                <div class="storage-settings">
                  <!-- 当前路径显示 -->
                  <div class="storage-current-path">
                    <label>{{ t('components.settings.storageSettings.currentPath') }}</label>
                    <div class="path-display">
                      <span class="path-text" :title="storageSettings.currentPath">{{ storageSettings.currentPath || '-' }}</span>
                      <span v-if="storageSettings.isCustom" class="path-badge custom">{{ t('common.custom') }}</span>
                      <span v-else class="path-badge default">{{ t('common.default') }}</span>
                    </div>
                  </div>
                  
                  <!-- 自定义路径输入 -->
                  <div class="storage-custom-path">
                    <label>{{ t('components.settings.storageSettings.customPath') }}</label>
                    <div class="path-input-group">
                      <input
                        type="text"
                        v-model="storageSettings.customPath"
                        :placeholder="t('components.settings.storageSettings.customPathPlaceholder')"
                        class="path-input"
                        :class="{
                          valid: pathValidationResult?.valid === true,
                          invalid: pathValidationResult?.valid === false
                        }"
                      />
                      <span v-if="isValidatingPath" class="validation-indicator">
                        <i class="codicon codicon-loading codicon-modifier-spin"></i>
                      </span>
                      <span v-else-if="pathValidationResult?.valid === true" class="validation-indicator valid">
                        <i class="codicon codicon-check"></i>
                      </span>
                      <span v-else-if="pathValidationResult?.valid === false" class="validation-indicator invalid">
                        <i class="codicon codicon-error"></i>
                      </span>
                    </div>
                    <p class="field-hint">{{ t('components.settings.storageSettings.customPathHint') }}</p>
                    <p v-if="pathValidationResult?.valid === false && pathValidationResult?.message" class="error-hint">
                      {{ pathValidationResult.message }}
                    </p>
                  </div>
                  
                  <!-- 操作按钮 -->
                  <div class="storage-actions">
                    <button
                      class="action-btn primary"
                      @click="applyStoragePath"
                      :disabled="storageSettings.customPath.trim() !== '' && (!pathValidationResult?.valid || isValidatingPath)"
                    >
                      <i class="codicon codicon-check"></i>
                      {{ t('components.settings.storageSettings.apply') }}
                    </button>
                    <button
                      class="action-btn"
                      @click="resetStoragePath"
                      :disabled="!storageSettings.isCustom"
                    >
                      <i class="codicon codicon-discard"></i>
                      {{ t('components.settings.storageSettings.reset') }}
                    </button>
                    <button
                      class="action-btn"
                      @click="confirmMigrate"
                      :disabled="!storageSettings.customPath.trim() || !pathValidationResult?.valid || isMigrating"
                      :title="t('components.settings.storageSettings.migrateHint')"
                    >
                      <i v-if="isMigrating" class="codicon codicon-loading codicon-modifier-spin"></i>
                      <i v-else class="codicon codicon-sync"></i>
                      {{ isMigrating ? t('components.settings.storageSettings.migrating') : t('components.settings.storageSettings.migrate') }}
                    </button>
                  </div>
                  
                  <!-- 状态消息 -->
                  <div v-if="storageMessage" class="storage-message" :class="storageMessageType">
                    <i :class="['codicon', storageMessageType === 'success' ? 'codicon-check' : 'codicon-error']"></i>
                    {{ storageMessage }}
                    <!-- 重新加载按钮 -->
                    <button
                      v-if="needsReload"
                      class="reload-btn"
                      @click="reloadWindow"
                    >
                      <i class="codicon codicon-refresh"></i>
                      {{ t('components.settings.storageSettings.reloadWindow') }}
                    </button>
                  </div>
                </div>
              </div>
              
              <div class="divider"></div>
              
              <!-- 应用信息 -->
              <div class="form-group">
                <label class="group-label">
                  <i class="codicon codicon-info"></i>
                  {{ t('components.settings.settingsPanel.appInfo.title') }}
                </label>
                <div class="info-text">
                  <p>{{ t('components.settings.settingsPanel.appInfo.name') }}</p>
                  <p class="version">{{ t('components.settings.settingsPanel.appInfo.version', { version: appVersion }) }}</p>
                  <div class="github-links">
                    <a :href="repositoryUrl" target="_blank" class="github-link">
                      <svg class="github-icon" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                      </svg>
                      {{ t('components.settings.settingsPanel.appInfo.repository') }}
                    </a>
                    <a :href="developerUrl" target="_blank" class="github-link">
                      <svg class="github-icon" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                      </svg>
                      {{ t('components.settings.settingsPanel.appInfo.developer') }}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CustomScrollbar>
    </div>
    
    <!-- 迁移确认对话框 -->
    <Modal
      v-model="showMigrateDialog"
      :title="t('components.settings.storageSettings.dialog.migrateTitle')"
    >
      <div class="migrate-dialog-content">
        <p>{{ t('components.settings.storageSettings.dialog.migrateMessage') }}</p>
        <p class="migrate-warning">
          <i class="codicon codicon-warning"></i>
          {{ t('components.settings.storageSettings.dialog.migrateWarning') }}
        </p>
      </div>
      <template #footer>
        <button class="dialog-btn" @click="showMigrateDialog = false">
          {{ t('components.settings.storageSettings.dialog.cancel') }}
        </button>
        <button class="dialog-btn primary" @click="executeMigration">
          {{ t('components.settings.storageSettings.dialog.confirm') }}
        </button>
      </template>
    </Modal>
  </div>
</template>

<style scoped src="./SettingsPanel.css"></style>
