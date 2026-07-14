<script setup lang="ts">
import { CustomCheckbox } from '../common'
import SummarizeSettings from './SummarizeSettings.vue'
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
  previewStats,
  diagnosticsPresets,
  activeEditorCost,
  openTabsCost,
  workspaceFilesCost,
  diagnosticsCost,
  totalEstimatedCost,
  formatCost,
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
          <span class="cost-badge">{{ formatCost(workspaceFilesCost) }}</span>
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
          <span class="cost-badge">{{ formatCost(openTabsCost) }}</span>
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
          <span class="cost-badge">{{ formatCost(activeEditorCost) }}</span>
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
          <span class="cost-badge">{{ formatCost(diagnosticsCost) }}</span>
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

          <div class="diagnostics-presets">
            <button
              v-for="preset in diagnosticsPresets"
              :key="preset.id"
              class="preset-btn"
              @click="applyDiagnosticsPreset(preset.id)"
            >
              <i :class="['codicon', preset.icon]"></i>
              {{ t(`components.settings.contextSettings.diagnostics.presets.${preset.id}`) }}
            </button>
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

            <div class="ignore-validation" v-if="previewStats">
              <div class="preview-meta-row">
                <span>{{ t('components.settings.contextSettings.ignorePatterns.matchedSummary', { matched: previewStats.ignorePatterns.matchedFiles, scanned: previewStats.ignorePatterns.scannedFiles }) }}</span>
              </div>
              <div v-if="previewStats.ignorePatterns.samples.length > 0" class="tabs-list ignore-files-list">
                <code v-for="sample in previewStats.ignorePatterns.samples" :key="sample">{{ sample }}</code>
              </div>
              <div v-if="previewStats.ignorePatterns.byPattern.length > 0" class="pattern-matches">
                <div
                  v-for="entry in previewStats.ignorePatterns.byPattern"
                  :key="entry.pattern"
                  class="pattern-match-row"
                >
                  <code>{{ entry.pattern }}</code>
                  <span>{{ t('components.settings.contextSettings.ignorePatterns.patternMatchCount', { count: entry.count }) }}</span>
                </div>
              </div>
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
            <span class="cost-badge primary">{{ formatCost(totalEstimatedCost) }}</span>
            <span class="auto-refresh-badge">
              <i class="codicon codicon-sync codicon-modifier-spin"></i>
              {{ t('components.settings.contextSettings.preview.autoRefreshBadge') }}
            </span>
          </label>
          <div class="preview-actions">
            <button class="action-btn" @click="loadPreview(true)">
              <i class="codicon codicon-refresh"></i>
              {{ t('common.refresh') }}
            </button>
            <button class="action-btn primary" @click="openCurrentContextInspector">
              <i class="codicon codicon-open-preview"></i>
              {{ t('components.settings.contextSettings.preview.openInspector') }}
            </button>
          </div>
        </div>
        <p class="field-description">{{ t('components.settings.contextSettings.preview.description') }}</p>
        
        <div class="preview-block">
          <!-- 文件树预览 -->
          <div class="preview-section" v-if="config.includeWorkspaceFiles">
            <div class="preview-label">
              {{ t('components.settings.contextSettings.preview.workspaceFilesLabel', { count: previewStats?.workspaceFiles.lineCount ?? 0 }) }}
              <span class="inline-cost">{{ formatCost(workspaceFilesCost) }}</span>
            </div>
            <pre v-if="previewStats?.workspaceFiles.preview" class="preview-pre">{{ previewStats.workspaceFiles.preview }}</pre>
            <span v-else class="empty">{{ t('components.settings.contextSettings.preview.noValue') }}</span>
          </div>

          <!-- 活动编辑器预览 -->
          <div class="preview-section" v-if="config.includeActiveEditor">
            <div class="preview-label">
              {{ t('components.settings.contextSettings.preview.activeEditorLabel') }}
              <span class="inline-cost">{{ formatCost(activeEditorCost) }}</span>
            </div>
            <div class="preview-content">
              <code v-if="activeEditor">{{ activeEditor }}</code>
              <span v-else class="empty">{{ t('components.settings.contextSettings.preview.noValue') }}</span>
            </div>
          </div>
          
          <!-- 打开标签页预览 -->
          <div class="preview-section" v-if="config.includeOpenTabs">
            <div class="preview-label">
              {{ t('components.settings.contextSettings.preview.openTabsLabel', { count: openTabs.length }) }}
              <span class="inline-cost">{{ formatCost(openTabsCost) }}</span>
            </div>
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

          <!-- 诊断预览 -->
          <div class="preview-section" v-if="config.diagnostics?.enabled">
            <div class="preview-label">
              {{ t('components.settings.contextSettings.preview.diagnosticsLabel', { files: previewStats?.diagnostics.files ?? 0, count: previewStats?.diagnostics.items ?? 0 }) }}
              <span class="inline-cost">{{ formatCost(diagnosticsCost) }}</span>
            </div>
            <pre v-if="previewStats?.diagnostics.preview" class="preview-pre">{{ previewStats.diagnostics.preview }}</pre>
            <span v-else class="empty">{{ t('components.settings.contextSettings.preview.noValue') }}</span>
          </div>

          <!-- Ignore pattern 命中预览 -->
          <div class="preview-section">
            <div class="preview-label">
              {{ t('components.settings.contextSettings.preview.ignoreMatchesLabel', { count: previewStats?.ignorePatterns.matchedFiles ?? 0 }) }}
            </div>
            <div class="preview-content">
              <div v-if="previewStats?.ignorePatterns.samples.length" class="tabs-list ignore-files-list">
                <code v-for="sample in previewStats.ignorePatterns.samples" :key="sample">{{ sample }}</code>
              </div>
              <span v-else class="empty">{{ t('components.settings.contextSettings.preview.noValue') }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="divider"></div>

      <div class="form-group context-summarize-section">
        <label class="group-label">
          <i class="codicon codicon-fold"></i>
          {{ t('components.settings.settingsPanel.sections.summarize.title') }}
        </label>
        <p class="field-description">
          {{ t('components.settings.settingsPanel.sections.summarize.description') }}
        </p>

        <SummarizeSettings />
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
