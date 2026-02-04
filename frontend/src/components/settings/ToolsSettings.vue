<script setup lang="ts">
import { ConfirmDialog, CustomCheckbox, DependencyWarning } from '../common'
import SettingsGroup from './common/SettingsGroup.vue'
import ListFilesConfig from './tools/files/list_files.vue'
import ApplyDiffConfig from './tools/files/apply_diff.vue'
import ExecuteCommandConfig from './tools/terminal/execute_command.vue'
import FindFilesConfig from './tools/search/find_files.vue'
import SearchInFilesConfig from './tools/search/search_in_files.vue'
import GenerateImageConfig from './tools/media/generate_image.vue'
import RemoveBackgroundConfig from './tools/media/remove_background.vue'
import CropImageConfig from './tools/media/crop_image.vue'
import ResizeImageConfig from './tools/media/resize_image.vue'
import RotateImageConfig from './tools/media/rotate_image.vue'
import LocateConfig from './tools/lsp/locate.vue'
import { useToolsSettings } from './useToolsSettings'

const {
  t,
  maxToolIterations,
  isLoadingMaxIterations,
  isSavingMaxIterations,
  handleMaxIterationsChange,
  dependencyStatus,
  hasConfigPanel,
  getMissingDependencies,
  areAllDependenciesInstalled,
  expandedTools,
  toggleConfigPanel,
  isConfigExpanded,
  tools,
  isLoading,
  savingTools,
  savingAutoExecTools,
  orderedCategories,
  isMcpTool,
  isDangerousTool,
  isAutoExec,
  loadTools,
  toggleTool,
  toggleAutoExec,
  enableAll,
  disableAll,
  confirmEnableDangerousAutoExecDialogVisible,
  enableAllAutoExec,
  confirmEnableAllAutoExec,
  disableAllAutoExec,
  getToolDisplayName,
  getCategoryDisplayName,
  getCategoryIcon,
  getCategoryEnabledCount,
  getCategoryEnabledTotal,
  getCategoryAutoExecCount,
} = useToolsSettings()
</script>

<template>
  <div class="tools-settings">
    <!-- 全局配置 -->
    <div class="global-config">
      <div class="config-item">
        <div class="config-label">
          <span class="label-text">{{ t('components.settings.toolsSettings.maxIterations.label') }}</span>
          <span class="label-hint">{{ t('components.settings.toolsSettings.maxIterations.hint') }}</span>
        </div>
        <div class="config-control">
          <input type="number" class="iterations-input" :value="maxToolIterations" min="-1"
            :disabled="isLoadingMaxIterations || isSavingMaxIterations" @input="handleMaxIterationsChange" />
          <span class="unit">{{ t('components.settings.toolsSettings.maxIterations.unit') }}</span>
          <i v-if="isSavingMaxIterations" class="codicon codicon-loading codicon-modifier-spin saving-indicator"></i>
        </div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="tools-actions">
      <button class="action-btn" @click="loadTools" :disabled="isLoading">
        <i class="codicon" :class="isLoading ? 'codicon-loading codicon-modifier-spin' : 'codicon-refresh'"></i>
        {{ t('components.settings.toolsSettings.actions.refresh') }}
      </button>
      <button class="action-btn" @click="enableAll">
        <i class="codicon codicon-check-all"></i>
        {{ t('components.settings.toolsSettings.actions.enableAll') }}
      </button>
      <button class="action-btn" @click="disableAll">
        <i class="codicon codicon-close-all"></i>
        {{ t('components.settings.toolsSettings.actions.disableAll') }}
      </button>
      <div class="action-divider"></div>
      <button class="action-btn" @click="enableAllAutoExec" :disabled="isLoading">
        <i class="codicon codicon-check-all"></i>
        {{ t('components.settings.autoExec.actions.enableAll') }}
      </button>
      <button class="action-btn" @click="disableAllAutoExec" :disabled="isLoading">
        <i class="codicon codicon-shield"></i>
        {{ t('components.settings.autoExec.actions.disableAll') }}
      </button>
    </div>

    <!-- MCP 提示 -->
    <div class="mcp-note">
      <i class="codicon codicon-plug"></i>
      <span>{{ t('components.settings.toolsSettings.mcpNote') }}</span>
    </div>

    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-state">
      <i class="codicon codicon-loading codicon-modifier-spin"></i>
      <span>{{ t('components.settings.toolsSettings.loading') }}</span>
    </div>

    <!-- 空状态 -->
    <div v-else-if="tools.length === 0" class="empty-state">
      <i class="codicon codicon-tools"></i>
      <span>{{ t('components.settings.toolsSettings.empty') }}</span>
    </div>

    <!-- 工具列表 -->
    <div v-else class="tools-list">
      <SettingsGroup v-for="entry in orderedCategories" :key="entry.category" :title="getCategoryDisplayName(entry.category)"
        :icon="getCategoryIcon(entry.category)"
        :badge="`${t('components.settings.toolsSettings.badges.enabled')} ${getCategoryEnabledCount(entry.tools)}/${getCategoryEnabledTotal(entry.tools)} · ${t('components.settings.toolsSettings.badges.autoExec')} ${getCategoryAutoExecCount(entry.tools)}/${entry.tools.length}`"
        :storage-key="`acopilot.settings.tools.category.${entry.category}`" :default-expanded="true">
        <template #actions>
          <div class="group-columns" @click.stop>
            <span class="col-header">{{ t('components.settings.toolsSettings.columns.enabled') }}</span>
            <span class="col-divider"></span>
            <span class="col-header"><i class="codicon codicon-shield"></i> {{ t('components.settings.toolsSettings.columns.auto') }}</span>
            <span class="col-header">{{ t('components.settings.toolsSettings.columns.config') }}</span>
          </div>
        </template>
        <div class="category-rows">
          <div v-for="tool in entry.tools" :key="tool.name" class="tool-wrapper">
            <div class="tool-item tool-grid"
              :class="{ 'tool-disabled': hasToolDependencies(tool.name) && !areAllDependenciesInstalled(tool.name) }">
              <div class="tool-info">
                <div class="tool-name-row">
                  <span class="tool-name">{{ getToolDisplayName(tool.name) }}</span>
                  <span v-if="isDangerousTool(tool.name)" class="danger-badge">
                    <i class="codicon codicon-warning"></i>
                    {{ t('components.settings.autoExec.badges.dangerous') }}
                  </span>
                  <span v-if="isMcpTool(tool)" class="mcp-badge">
                    <i class="codicon codicon-plug"></i>
                    {{ tool.serverName }}
                  </span>
                  <!-- 依赖缺失标记 -->
                  <!-- <span v-if="hasToolDependencies(tool.name) && !areAllDependenciesInstalled(tool.name)"
                    class="dependency-badge" :title="t('components.settings.toolsSettings.dependency.requiredTooltip')">
                    <i class="codicon codicon-warning"></i>
                    {{ t('components.settings.toolsSettings.dependency.required') }}
                  </span> -->
                </div>
                <div class="tool-description" :title="tool.description">{{ tool.description }}</div>
              </div>

              <!-- 启用列 -->
              <div class="tool-toggle" :class="{
                saving: savingTools.has(tool.name),
                disabled: isMcpTool(tool) || (hasToolDependencies(tool.name) && !areAllDependenciesInstalled(tool.name))
              }"
                :title="isMcpTool(tool) ? t('components.settings.toolsSettings.mcpDisableTooltip') : (hasToolDependencies(tool.name) && !areAllDependenciesInstalled(tool.name) ? t('components.settings.toolsSettings.dependency.disabledTooltip') : '')">
                <CustomCheckbox :modelValue="tool.enabled"
                  :disabled="isMcpTool(tool) || savingTools.has(tool.name) || (hasToolDependencies(tool.name) && !areAllDependenciesInstalled(tool.name))"
                  @update:modelValue="(val: boolean) => toggleTool(tool.name, val)" />
              </div>

              <span class="col-divider"></span>

              <!-- 执行列 -->
              <div class="exec-cell" :class="{
                disabled: (!isMcpTool(tool) && !tool.enabled) || (hasToolDependencies(tool.name) && !areAllDependenciesInstalled(tool.name))
              }">
                <div class="exec-toggle">
                  <i class="codicon exec-icon" :class="isAutoExec(tool.name) ? 'codicon-arrow-up' : 'codicon-comment-discussion'"></i>
                  <CustomCheckbox :modelValue="isAutoExec(tool.name)"
                    :disabled="savingAutoExecTools.has(tool.name) || ((!isMcpTool(tool) && !tool.enabled) || (hasToolDependencies(tool.name) && !areAllDependenciesInstalled(tool.name)))"
                    @update:modelValue="(val: boolean) => requestToggleAutoExec(tool.name, val)" />
                </div>
                <span class="exec-badge" :class="{ auto: isAutoExec(tool.name), confirm: !isAutoExec(tool.name) }">
                  {{ isAutoExec(tool.name) ? t('components.settings.toolsSettings.exec.autoEnabled') : t('components.settings.autoExec.status.needConfirm') }}
                </span>
              </div>

              <!-- 配置列 -->
              <button v-if="hasConfigPanel(tool.name)" class="config-btn"
                :class="{ active: isConfigExpanded(tool.name) }" @click.stop="toggleConfigPanel(tool.name)"
                :disabled="(!isMcpTool(tool) && !tool.enabled) || (hasToolDependencies(tool.name) && !areAllDependenciesInstalled(tool.name))"
                :title="t('components.settings.toolsSettings.config.tooltip')">
                <i class="codicon"
                  :class="isConfigExpanded(tool.name) ? 'codicon-chevron-up' : 'codicon-settings-gear'"></i>
              </button>
              <span v-else class="config-placeholder"></span>
            </div>

            <!-- 依赖缺失提示 -->
            <DependencyWarning v-if="hasToolDependencies(tool.name) && !areAllDependenciesInstalled(tool.name)"
              :dependencies="getMissingDependencies(tool.name)" class="tool-dependency-warning" />

            <!-- 配置面板 -->
            <ListFilesConfig v-if="tool.name === 'list_files' && isConfigExpanded(tool.name)" :tool-name="tool.name" />
            <ApplyDiffConfig v-if="tool.name === 'apply_diff' && isConfigExpanded(tool.name)" :tool-name="tool.name" />
            <ExecuteCommandConfig v-if="tool.name === 'execute_command' && isConfigExpanded(tool.name)"
              :tool-name="tool.name" />
            <FindFilesConfig v-if="tool.name === 'find_files' && isConfigExpanded(tool.name)" />
            <SearchInFilesConfig v-if="tool.name === 'search_in_files' && isConfigExpanded(tool.name)" />
            <LocateConfig v-if="tool.name === 'locate' && isConfigExpanded(tool.name)" />
            <GenerateImageConfig v-if="tool.name === 'generate_image' && isConfigExpanded(tool.name)" />
            <RemoveBackgroundConfig v-if="tool.name === 'remove_background' && isConfigExpanded(tool.name)" />
            <CropImageConfig v-if="tool.name === 'crop_image' && isConfigExpanded(tool.name)" />
            <ResizeImageConfig v-if="tool.name === 'resize_image' && isConfigExpanded(tool.name)" />
            <RotateImageConfig v-if="tool.name === 'rotate_image' && isConfigExpanded(tool.name)" />
          </div>
        </div>
      </SettingsGroup>
    </div>

    <!-- 危险工具开启自动执行二次确认 -->
    <ConfirmDialog
      v-model="confirmDangerDialogVisible"
      :title="t('components.settings.toolsSettings.dangerConfirm.title')"
      :message="t('components.settings.toolsSettings.dangerConfirm.message', { tool: confirmDangerDialogToolName })"
      :confirm-text="t('components.settings.toolsSettings.dangerConfirm.confirm')"
      :cancel-text="t('components.settings.toolsSettings.dangerConfirm.cancel')"
      :is-danger="true"
      @confirm="toggleAutoExec(confirmDangerDialogToolName, confirmDangerDialogNextValue)"
    />

    <!-- 批量开启自动执行（危险工具）确认 -->
    <ConfirmDialog
      v-model="confirmEnableDangerousAutoExecDialogVisible"
      :title="t('components.settings.toolsSettings.enableAllDangerous.title')"
      :message="t('components.settings.toolsSettings.enableAllDangerous.message')"
      :confirm-text="t('components.settings.toolsSettings.enableAllDangerous.confirm')"
      :cancel-text="t('components.settings.toolsSettings.enableAllDangerous.cancel')"
      :is-danger="true"
      @confirm="confirmEnableAllAutoExec(true)"
      @cancel="confirmEnableAllAutoExec(false)"
    />
  </div>
</template>

<style scoped src="./ToolsSettings.css"></style>
