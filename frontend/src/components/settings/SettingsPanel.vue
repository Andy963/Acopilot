<script setup lang="ts">
import ChannelSettings from './ChannelSettings.vue'
import ToolsSettings from './ToolsSettings.vue'
import McpSettings from './McpSettings.vue'
import CheckpointSettings from './CheckpointSettings.vue'
import SummarizeSettings from './SummarizeSettings.vue'
import GenerateImageSettings from './GenerateImageSettings.vue'
import DependencySettings from './DependencySettings.vue'
import ContextSettings from './ContextSettings.vue'
import PromptSettings from './PromptSettings.vue'
import { CustomCheckbox, CustomScrollbar, CustomSelect, Modal } from '../common'
import { useSettingsPanel } from './useSettingsPanel'

const {
  settingsStore,
  t,
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
  executeMigration,
  storageMessage,
  storageMessageType,
  needsReload,
  applyStoragePath,
  resetStoragePath,
  confirmMigrate,
  reloadWindow,
} = useSettingsPanel()
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

<style scoped src="./SettingsPanel.part1.css"></style>
<style scoped src="./SettingsPanel.part2.css"></style>
