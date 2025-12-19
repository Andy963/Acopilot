<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useSettingsStore, type SettingsTab } from '@/stores/settingsStore'
import ChannelSettings from './ChannelSettings.vue'
import ToolsSettings from './ToolsSettings.vue'
import AutoExecSettings from './AutoExecSettings.vue'
import McpSettings from './McpSettings.vue'
import CheckpointSettings from './CheckpointSettings.vue'
import SummarizeSettings from './SummarizeSettings.vue'
import GenerateImageSettings from './GenerateImageSettings.vue'
import DependencySettings from './DependencySettings.vue'
import ContextSettings from './ContextSettings.vue'
import PromptSettings from './PromptSettings.vue'
import { CustomScrollbar, CustomCheckbox, CustomSelect, type SelectOption } from '../common'
import { sendToExtension } from '@/utils/vscode'
import { useI18n, SUPPORTED_LANGUAGES } from '@/i18n'

const settingsStore = useSettingsStore()
const { t, setLanguage } = useI18n()

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
  { id: 'autoExec', label: t('components.settings.tabs.autoExec'), icon: 'codicon-shield' },
  { id: 'mcp', label: t('components.settings.tabs.mcp'), icon: 'codicon-plug' },
  { id: 'checkpoint', label: t('components.settings.tabs.checkpoint'), icon: 'codicon-history' },
  { id: 'summarize', label: t('components.settings.tabs.summarize'), icon: 'codicon-fold' },
  { id: 'imageGen', label: t('components.settings.tabs.imageGen'), icon: 'codicon-symbol-color' },
  { id: 'dependencies', label: t('components.settings.tabs.dependencies'), icon: 'codicon-package' },
  { id: 'context', label: t('components.settings.tabs.context'), icon: 'codicon-symbol-namespace' },
  { id: 'prompt', label: t('components.settings.tabs.prompt'), icon: 'codicon-note' },
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
  } catch (error) {
    console.error('Failed to load settings:', error)
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
          
          <!-- 自动执行设置 -->
          <div v-if="settingsStore.activeTab === 'autoExec'" class="settings-section">
            <h4>{{ t('components.settings.settingsPanel.sections.autoExec.title') }}</h4>
            <p class="settings-description">{{ t('components.settings.settingsPanel.sections.autoExec.description') }}</p>
            
            <AutoExecSettings />
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
              
              <!-- 应用信息 -->
              <div class="form-group">
                <label class="group-label">
                  <i class="codicon codicon-info"></i>
                  {{ t('components.settings.settingsPanel.appInfo.title') }}
                </label>
                <div class="info-text">
                  <p>{{ t('components.settings.settingsPanel.appInfo.name') }}</p>
                  <p class="version">{{ t('components.settings.settingsPanel.appInfo.version') }}</p>
                  <div class="github-links">
                    <a href="https://github.com/Lianues/Lim-Code" target="_blank" class="github-link">
                      <svg class="github-icon" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                      </svg>
                      {{ t('components.settings.settingsPanel.appInfo.repository') }}
                    </a>
                    <a href="https://github.com/Lianues" target="_blank" class="github-link">
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
  </div>
</template>

<style scoped>
.settings-panel {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--vscode-sideBar-background);
  z-index: 100;
  display: flex;
  flex-direction: column;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--vscode-panel-border);
}

.settings-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
}

.settings-close-btn {
  background: transparent;
  border: none;
  color: var(--vscode-foreground);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.settings-close-btn:hover {
  background: var(--vscode-toolbar-hoverBackground);
}

.settings-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* 左侧页签（仅图标） */
.settings-sidebar {
  width: 48px;
  border-right: 1px solid var(--vscode-panel-border);
  padding: 8px 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.settings-tab {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--vscode-foreground);
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.settings-tab:hover {
  background: var(--vscode-list-hoverBackground);
}

/* 自定义 tooltip 显示在右侧 */
.settings-tab::after {
  content: attr(data-tooltip);
  position: absolute;
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
  margin-left: 8px;
  padding: 4px 8px;
  background: var(--vscode-editorWidget-background);
  color: var(--vscode-foreground);
  border: 1px solid var(--vscode-editorWidget-border);
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.15s, visibility 0.15s;
  pointer-events: none;
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.settings-tab:hover::after {
  opacity: 1;
  visibility: visible;
}

.settings-tab.active {
  background: var(--vscode-list-activeSelectionBackground);
  color: var(--vscode-list-activeSelectionForeground);
}

.settings-tab .codicon {
  font-size: 18px;
}

/* 右侧内容 - 滚动条容器 */
.settings-main-scrollbar {
  flex: 1;
  min-height: 0;
}

.settings-main {
  padding: 16px;
}

.settings-section h4 {
  margin: 0 0 4px 0;
  font-size: 14px;
  font-weight: 500;
}

.settings-description {
  margin: 0 0 16px 0;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

/* 表单样式 */
.settings-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 12px;
  font-weight: 500;
}

.info-text {
  padding: 8px 12px;
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
}

.info-text p {
  margin: 0;
  font-size: 13px;
}

.info-text .version {
  margin-top: 4px;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.github-links {
  display: flex;
  gap: 16px;
  margin-top: 10px;
}

.github-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--vscode-textLink-foreground);
  text-decoration: none;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background-color 0.15s;
}

.github-link:hover {
  background: var(--vscode-list-hoverBackground);
  text-decoration: underline;
}

.github-icon {
  width: 16px;
  height: 16px;
}

/* 代理设置样式 */
.group-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
}

.group-label .codicon {
  font-size: 14px;
  color: var(--vscode-foreground);
}

.field-description {
  margin: 4px 0 12px 0;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.proxy-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
}

.proxy-enable {
  display: flex;
  align-items: center;
}

.proxy-url-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: opacity 0.2s;
}

.proxy-url-group.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.proxy-url-group label {
  font-size: 12px;
  color: var(--vscode-foreground);
}

.proxy-url-input {
  width: 100%;
  padding: 6px 10px;
  font-size: 13px;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border);
  border-radius: 4px;
  outline: none;
  transition: border-color 0.15s;
}

.proxy-url-input:focus {
  border-color: var(--vscode-focusBorder);
}

.proxy-url-input:disabled {
  background: var(--vscode-input-background);
  opacity: 0.6;
}

.proxy-url-input.invalid {
  border-color: var(--vscode-inputValidation-errorBorder);
}

.error-hint {
  margin: 0;
  font-size: 11px;
  color: var(--vscode-errorForeground);
}

.proxy-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
}

.save-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 60px;
  padding: 6px 12px;
  font-size: 12px;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.save-btn:hover:not(:disabled) {
  background: var(--vscode-button-hoverBackground);
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.save-message {
  font-size: 12px;
  color: var(--vscode-errorForeground);
}

.save-message.success {
  color: var(--vscode-terminal-ansiGreen);
}

.divider {
  height: 1px;
  background: var(--vscode-panel-border);
  margin: 8px 0;
}

/* 语言设置 */
.language-settings {
  max-width: 240px;
}

/* Loading 动画 */
.codicon-modifier-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>