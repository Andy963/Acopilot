<script setup lang="ts">
import { CustomCheckbox } from '../common'
import { useContextSettings } from './useContextSettings'

const {
  t,
  config,
  availableSeverities,
  isLoading,
  isSaving,
  saveMessage,
  newIgnorePattern,
  openTabs,
  activeEditor,
  updateConfig,
  addIgnorePattern,
  removeIgnorePattern,
  handleKeydown,
  updateDiagnosticsConfig,
  toggleSeverity,
  isSeveritySelected,
} = useContextSettings()
</script>

<template>
  <div class="context-settings">
    <div v-if="isLoading" class="loading">
      <i class="codicon codicon-loading codicon-modifier-spin"></i>
      <span>{{ t('components.settings.contextSettings.loading') }}</span>
    </div>
    
    <div v-else class="settings-form">
      <!-- 文件树设置 -->
      <div class="form-group">
        <label class="group-label">
          <i class="codicon codicon-list-tree"></i>
          {{ t('components.settings.contextSettings.workspaceFiles.title') }}
        </label>
        <p class="field-description">{{ t('components.settings.contextSettings.workspaceFiles.description') }}</p>
        
        <div class="setting-block">
          <div class="setting-row">
            <CustomCheckbox
              :model-value="config.includeWorkspaceFiles"
              :label="t('components.settings.contextSettings.workspaceFiles.sendFileTree')"
              @update:model-value="(v: boolean) => updateConfig('includeWorkspaceFiles', v)"
            />
          </div>
          
          <div class="setting-row indented" :class="{ disabled: !config.includeWorkspaceFiles }">
            <label>{{ t('components.settings.contextSettings.workspaceFiles.maxDepth') }}</label>
            <div class="input-with-hint">
              <input
                type="number"
                :value="config.maxFileDepth"
                min="-1"
                max="100"
                :disabled="!config.includeWorkspaceFiles"
                class="number-input"
                @input="(e: any) => updateConfig('maxFileDepth', Number(e.target.value))"
              />
              <span class="hint">{{ t('components.settings.contextSettings.workspaceFiles.unlimitedHint') }}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="divider"></div>
      
      <!-- 打开的标签页设置 -->
      <div class="form-group">
        <label class="group-label">
          <i class="codicon codicon-files"></i>
          {{ t('components.settings.contextSettings.openTabs.title') }}
        </label>
        <p class="field-description">{{ t('components.settings.contextSettings.openTabs.description') }}</p>
        
        <div class="setting-block">
          <div class="setting-row">
            <CustomCheckbox
              :model-value="config.includeOpenTabs"
              :label="t('components.settings.contextSettings.openTabs.sendOpenTabs')"
              @update:model-value="(v: boolean) => updateConfig('includeOpenTabs', v)"
            />
          </div>
          
          <div class="setting-row indented" :class="{ disabled: !config.includeOpenTabs }">
            <label>{{ t('components.settings.contextSettings.openTabs.maxCount') }}</label>
            <div class="input-with-hint">
              <input
                type="number"
                :value="config.maxOpenTabs"
                min="-1"
                max="100"
                :disabled="!config.includeOpenTabs"
                class="number-input"
                @input="(e: any) => updateConfig('maxOpenTabs', Number(e.target.value))"
              />
              <span class="hint">{{ t('components.settings.contextSettings.workspaceFiles.unlimitedHint') }}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="divider"></div>
      
      <!-- 当前活动编辑器设置 -->
      <div class="form-group">
        <label class="group-label">
          <i class="codicon codicon-file-code"></i>
          {{ t('components.settings.contextSettings.activeEditor.title') }}
        </label>
        <p class="field-description">{{ t('components.settings.contextSettings.activeEditor.description') }}</p>
        
        <div class="setting-block">
          <div class="setting-row">
            <CustomCheckbox
              :model-value="config.includeActiveEditor"
              :label="t('components.settings.contextSettings.activeEditor.sendActiveEditor')"
              @update:model-value="(v: boolean) => updateConfig('includeActiveEditor', v)"
            />
          </div>
        </div>
      </div>
      
      <div class="divider"></div>
      
      <!-- 诊断信息设置 -->
      <div class="form-group">
        <label class="group-label">
          <i class="codicon codicon-warning"></i>
          {{ t('components.settings.contextSettings.diagnostics.title') }}
        </label>
        <p class="field-description">{{ t('components.settings.contextSettings.diagnostics.description') }}</p>
        
        <div class="setting-block">
          <div class="setting-row">
            <CustomCheckbox
              :model-value="config.diagnostics?.enabled ?? false"
              :label="t('components.settings.contextSettings.diagnostics.enableDiagnostics')"
              @update:model-value="(v: boolean) => updateDiagnosticsConfig('enabled', v)"
            />
          </div>
          
          <!-- 严重程度选择 -->
          <div class="setting-row indented" :class="{ disabled: !config.diagnostics?.enabled }">
            <label>{{ t('components.settings.contextSettings.diagnostics.severityTypes') }}</label>
            <div class="severity-checkboxes">
              <label
                v-for="severity in availableSeverities"
                :key="severity.value"
                class="severity-checkbox"
                :class="{
                  checked: isSeveritySelected(severity.value),
                  disabled: !config.diagnostics?.enabled
                }"
              >
                <input
                  type="checkbox"
                  :checked="isSeveritySelected(severity.value)"
                  :disabled="!config.diagnostics?.enabled"
                  @change="toggleSeverity(severity.value)"
                />
                <span class="severity-label" :class="severity.value">
                  {{ t(`components.settings.contextSettings.diagnostics.severity.${severity.value}`) }}
                </span>
              </label>
            </div>
          </div>
          
          <!-- 范围选项 -->
          <div class="setting-row indented" :class="{ disabled: !config.diagnostics?.enabled }">
            <CustomCheckbox
              :model-value="config.diagnostics?.workspaceOnly ?? true"
              :label="t('components.settings.contextSettings.diagnostics.workspaceOnly')"
              :disabled="!config.diagnostics?.enabled"
              @update:model-value="(v: boolean) => updateDiagnosticsConfig('workspaceOnly', v)"
            />
          </div>
          
          <div class="setting-row indented" :class="{ disabled: !config.diagnostics?.enabled }">
            <CustomCheckbox
              :model-value="config.diagnostics?.openFilesOnly ?? false"
              :label="t('components.settings.contextSettings.diagnostics.openFilesOnly')"
              :disabled="!config.diagnostics?.enabled"
              @update:model-value="(v: boolean) => updateDiagnosticsConfig('openFilesOnly', v)"
            />
          </div>
          
          <!-- 数量限制 -->
          <div class="setting-row indented" :class="{ disabled: !config.diagnostics?.enabled }">
            <label>{{ t('components.settings.contextSettings.diagnostics.maxPerFile') }}</label>
            <div class="input-with-hint">
              <input
                type="number"
                :value="config.diagnostics?.maxDiagnosticsPerFile ?? 10"
                min="-1"
                max="100"
                :disabled="!config.diagnostics?.enabled"
                class="number-input"
                @input="(e: any) => updateDiagnosticsConfig('maxDiagnosticsPerFile', Number(e.target.value))"
              />
              <span class="hint">{{ t('components.settings.contextSettings.workspaceFiles.unlimitedHint') }}</span>
            </div>
          </div>
          
          <div class="setting-row indented" :class="{ disabled: !config.diagnostics?.enabled }">
            <label>{{ t('components.settings.contextSettings.diagnostics.maxFiles') }}</label>
            <div class="input-with-hint">
              <input
                type="number"
                :value="config.diagnostics?.maxFiles ?? 20"
                min="-1"
                max="100"
                :disabled="!config.diagnostics?.enabled"
                class="number-input"
                @input="(e: any) => updateDiagnosticsConfig('maxFiles', Number(e.target.value))"
              />
              <span class="hint">{{ t('components.settings.contextSettings.workspaceFiles.unlimitedHint') }}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="divider"></div>
      
      <!-- 忽略模式设置 -->
      <div class="form-group">
        <label class="group-label">
          <i class="codicon codicon-exclude"></i>
          {{ t('components.settings.contextSettings.ignorePatterns.title') }}
        </label>
        <p class="field-description">{{ t('components.settings.contextSettings.ignorePatterns.description') }}</p>
        
        <div class="setting-block">
          <div class="ignore-patterns">
            <!-- 现有模式列表 -->
            <div class="pattern-list" v-if="config.ignorePatterns.length > 0">
              <div
                v-for="(pattern, index) in config.ignorePatterns"
                :key="index"
                class="pattern-item"
              >
                <code>{{ pattern }}</code>
                <button class="remove-btn" @click="removeIgnorePattern(index)" :title="t('components.settings.contextSettings.ignorePatterns.removeTooltip')">
                  <i class="codicon codicon-close"></i>
                </button>
              </div>
            </div>
            
            <p v-else class="empty-hint">{{ t('components.settings.contextSettings.ignorePatterns.emptyHint') }}</p>
            
            <!-- 添加新模式 -->
            <div class="add-pattern">
              <input
                type="text"
                v-model="newIgnorePattern"
                :placeholder="t('components.settings.contextSettings.ignorePatterns.inputPlaceholder')"
                class="pattern-input"
                @keydown="handleKeydown"
              />
              <button class="add-btn" @click="addIgnorePattern" :disabled="!newIgnorePattern.trim()">
                <i class="codicon codicon-add"></i>
                {{ t('components.settings.contextSettings.ignorePatterns.addButton') }}
              </button>
            </div>
            
            <!-- 通配符说明 -->
            <div class="pattern-help">
              <p><strong>{{ t('components.settings.contextSettings.ignorePatterns.helpTitle') }}</strong></p>
              <ul>
                <li><code>*</code> - {{ t('components.settings.contextSettings.ignorePatterns.helpItems.wildcard') }}</li>
                <li><code>**</code> - {{ t('components.settings.contextSettings.ignorePatterns.helpItems.recursive') }}</li>
                <li>{{ t('components.settings.contextSettings.ignorePatterns.helpItems.examples') }}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      
      <div class="divider"></div>
      
      <!-- 预览区域 -->
      <div class="form-group">
        <div class="preview-header">
          <label class="group-label">
            <i class="codicon codicon-eye"></i>
            {{ t('components.settings.contextSettings.preview.title') }}
            <span class="auto-refresh-badge">
              <i class="codicon codicon-sync codicon-modifier-spin"></i>
              {{ t('components.settings.contextSettings.preview.autoRefreshBadge') }}
            </span>
          </label>
        </div>
        <p class="field-description">{{ t('components.settings.contextSettings.preview.description') }}</p>
        
        <div class="preview-block">
          <!-- 活动编辑器预览 -->
          <div class="preview-section" v-if="config.includeActiveEditor">
            <div class="preview-label">{{ t('components.settings.contextSettings.preview.activeEditorLabel') }}</div>
            <div class="preview-content">
              <code v-if="activeEditor">{{ activeEditor }}</code>
              <span v-else class="empty">{{ t('components.settings.contextSettings.preview.noValue') }}</span>
            </div>
          </div>
          
          <!-- 打开标签页预览 -->
          <div class="preview-section" v-if="config.includeOpenTabs">
            <div class="preview-label">{{ t('components.settings.contextSettings.preview.openTabsLabel', { count: openTabs.length }) }}</div>
            <div class="preview-content">
              <div v-if="openTabs.length > 0" class="tabs-list">
                <code v-for="(tab, index) in openTabs.slice(0, config.maxOpenTabs === -1 ? undefined : config.maxOpenTabs)" :key="index">
                  {{ tab }}
                </code>
                <span v-if="config.maxOpenTabs !== -1 && openTabs.length > config.maxOpenTabs" class="truncated">
                  {{ t('components.settings.contextSettings.preview.moreItems', { count: openTabs.length - config.maxOpenTabs }) }}
                </span>
              </div>
              <span v-else class="empty">{{ t('components.settings.contextSettings.preview.noValue') }}</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 保存状态 -->
      <div class="save-status" v-if="isSaving || saveMessage">
        <i v-if="isSaving" class="codicon codicon-loading codicon-modifier-spin"></i>
        <span v-if="saveMessage" :class="{ success: saveMessage === t('components.settings.contextSettings.saveSuccess') }">{{ saveMessage }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped src="./ContextSettings.css"></style>
