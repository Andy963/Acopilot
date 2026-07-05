<script setup lang="ts">
import { CustomCheckbox, CustomSelect } from '../../../common'
import { useExecuteCommandToolConfig } from './useExecuteCommandToolConfig'

const props = defineProps<{
  toolName: string
}>()

const {
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
} = useExecuteCommandToolConfig(props.toolName)
</script>

<template>
  <div class="execute-command-config">
    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-state">
      <i class="codicon codicon-loading codicon-modifier-spin"></i>
      <span>{{ t('components.settings.toolSettings.common.loadingConfig') }}</span>
    </div>
    
    <!-- 错误状态 -->
    <div v-else-if="error" class="error-state">
      <i class="codicon codicon-error"></i>
      <span>{{ error }}</span>
      <button class="retry-btn" @click="loadConfig">{{ t('components.settings.toolSettings.common.retry') }}</button>
    </div>
    
    <!-- 配置内容 -->
    <div v-else-if="config" class="config-content">
      <!-- Shell 环境配置 -->
      <div class="config-section">
        <div class="section-header">
          <i class="codicon codicon-terminal"></i>
          <span>{{ t('components.settings.toolSettings.terminal.executeCommand.shellEnv') }}</span>
          <span v-if="isSaving" class="saving-indicator">
            <i class="codicon codicon-loading codicon-modifier-spin"></i>
          </span>
        </div>
        
        <div class="shell-list">
          <div
            v-for="shell in config.shells"
            :key="shell.type"
            class="shell-item"
            :class="{
              disabled: !shell.enabled,
              'is-default': config.defaultShell === shell.type,
              'unavailable': shell.available === false
            }"
          >
            <div class="shell-main">
              <div class="shell-info">
                <i :class="['shell-icon', 'codicon', getShellIcon(shell.type)]"></i>
                <span class="shell-name">{{ shell.displayName }}</span>
                <span v-if="config.defaultShell === shell.type" class="default-badge">{{ t('components.settings.toolSettings.terminal.executeCommand.defaultBadge') }}</span>
                <!-- 可用性状态标识 -->
                <span v-if="shell.available === true" class="status-badge available" :title="t('components.settings.toolSettings.terminal.executeCommand.available')">
                  <i class="codicon codicon-check"></i>
                </span>
                <span v-else-if="shell.available === false" class="status-badge unavailable" :title="shell.unavailableReason || t('components.settings.toolSettings.terminal.executeCommand.unavailable')">
                  <i class="codicon codicon-close"></i>
                </span>
              </div>
              
              <div class="shell-actions">
                <!-- 设为默认按钮 -->
                <button
                  v-if="shell.enabled && config.defaultShell !== shell.type"
                  class="set-default-btn"
                  :title="t('components.settings.toolSettings.terminal.executeCommand.setDefaultTooltip')"
                  @click="setDefaultShell(shell.type)"
                >
                  <i class="codicon codicon-star-empty"></i>
                </button>
                
                <!-- 启用/禁用开关 -->
                <CustomCheckbox
                  :modelValue="shell.enabled"
                  @update:modelValue="(val: boolean) => toggleShell(shell.type, val)"
                />
              </div>
            </div>
            
            <!-- 路径配置（始终显示，方便用户配置） -->
            <div class="shell-path">
              <label class="path-label">
                <span>{{ t('components.settings.toolSettings.terminal.executeCommand.executablePath') }}</span>
                <input
                  type="text"
                  class="path-input"
                  :class="{ 'path-error': shell.available === false }"
                  :value="shell.path || ''"
                  :placeholder="t('components.settings.toolSettings.terminal.executeCommand.executablePathPlaceholder')"
                  @input="(e) => updateShellPath(shell.type, (e.target as HTMLInputElement).value)"
                />
              </label>
              <!-- 显示不可用原因 -->
              <div v-if="shell.available === false && shell.unavailableReason" class="path-error-hint">
                <i class="codicon codicon-warning"></i>
                <span>{{ shell.unavailableReason }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 超时配置 -->
      <div class="config-section">
        <div class="section-header">
          <i class="codicon codicon-clock"></i>
          <span>{{ t('components.settings.toolSettings.terminal.executeCommand.execTimeout') }}</span>
        </div>
        
        <div class="timeout-config">
          <CustomSelect
            class="timeout-select"
            :model-value="String(config.defaultTimeout)"
            :options="timeoutOptions"
            @update:model-value="(val: string) => updateTimeout(Number(val))"
          />
          <span class="timeout-hint">{{ t('components.settings.toolSettings.terminal.executeCommand.timeoutHint') }}</span>
        </div>
      </div>
      
      <!-- 最大输出行数配置 -->
      <div class="config-section">
        <div class="section-header">
          <i class="codicon codicon-list-ordered"></i>
          <span>{{ t('components.settings.toolSettings.terminal.executeCommand.maxOutputLines') }}</span>
        </div>
        
        <div class="output-lines-config">
          <CustomSelect
            class="output-lines-select"
            :model-value="String(config.maxOutputLines ?? 50)"
            :options="maxOutputLinesOptions"
            @update:model-value="(val: string) => updateMaxOutputLines(Number(val))"
          />
          <span class="output-lines-hint">{{ t('components.settings.toolSettings.terminal.executeCommand.maxOutputLinesHint') }}</span>
        </div>
      </div>

      <!-- 命令风险策略 -->
      <div class="config-section">
        <div class="section-header">
          <i class="codicon codicon-shield"></i>
          <span>{{ t('components.settings.toolSettings.terminal.executeCommand.risk.title') }}</span>
        </div>

        <div class="risk-config">
          <CustomCheckbox
            :model-value="config.riskPolicy?.enabled ?? true"
            :label="t('components.settings.toolSettings.terminal.executeCommand.risk.enabled')"
            @update:model-value="updateRiskEnabled"
          />

          <div class="risk-row" :class="{ disabled: !(config.riskPolicy?.enabled ?? true) }">
            <label class="risk-label">{{ t('components.settings.toolSettings.terminal.executeCommand.risk.autoExecuteUpTo.label') }}</label>
            <CustomSelect
              :model-value="config.riskPolicy?.autoExecuteUpTo ?? 'low'"
              :options="riskAutoExecuteOptions"
              :disabled="!(config.riskPolicy?.enabled ?? true)"
              @update:model-value="updateAutoExecuteUpTo"
            />
            <div class="risk-hint">{{ t('components.settings.toolSettings.terminal.executeCommand.risk.autoExecuteUpTo.hint') }}</div>
          </div>

          <div class="risk-row" :class="{ disabled: !(config.riskPolicy?.enabled ?? true) }">
            <label class="risk-label">{{ t('components.settings.toolSettings.terminal.executeCommand.risk.confirmOn') }}</label>
            <div class="risk-checkboxes">
              <CustomCheckbox
                :model-value="config.riskPolicy?.confirmOn?.destructive ?? true"
                :label="t('components.settings.toolSettings.terminal.executeCommand.risk.categories.destructive')"
                :disabled="!(config.riskPolicy?.enabled ?? true)"
                @update:model-value="(v: boolean) => updateConfirmOn('destructive', v)"
              />
              <CustomCheckbox
                :model-value="config.riskPolicy?.confirmOn?.gitHistory ?? true"
                :label="t('components.settings.toolSettings.terminal.executeCommand.risk.categories.gitHistory')"
                :disabled="!(config.riskPolicy?.enabled ?? true)"
                @update:model-value="(v: boolean) => updateConfirmOn('gitHistory', v)"
              />
              <CustomCheckbox
                :model-value="config.riskPolicy?.confirmOn?.privilege ?? true"
                :label="t('components.settings.toolSettings.terminal.executeCommand.risk.categories.privilege')"
                :disabled="!(config.riskPolicy?.enabled ?? true)"
                @update:model-value="(v: boolean) => updateConfirmOn('privilege', v)"
              />
              <CustomCheckbox
                :model-value="config.riskPolicy?.confirmOn?.network ?? true"
                :label="t('components.settings.toolSettings.terminal.executeCommand.risk.categories.network')"
                :disabled="!(config.riskPolicy?.enabled ?? true)"
                @update:model-value="(v: boolean) => updateConfirmOn('network', v)"
              />
            </div>
          </div>

          <div class="risk-row" :class="{ disabled: !(config.riskPolicy?.enabled ?? true) }">
            <label class="risk-label">{{ t('components.settings.toolSettings.terminal.executeCommand.risk.allowPatterns') }}</label>
            <textarea
              class="risk-textarea"
              :disabled="!(config.riskPolicy?.enabled ?? true)"
              :value="patternsToText(config.riskPolicy?.allowPatterns)"
              @input="(e: any) => updateAllowPatterns(e.target.value)"
            ></textarea>
            <div class="risk-hint">{{ t('components.settings.toolSettings.terminal.executeCommand.risk.allowPatternsHint') }}</div>
          </div>

          <div class="risk-row" :class="{ disabled: !(config.riskPolicy?.enabled ?? true) }">
            <label class="risk-label">{{ t('components.settings.toolSettings.terminal.executeCommand.risk.denyPatterns') }}</label>
            <textarea
              class="risk-textarea"
              :disabled="!(config.riskPolicy?.enabled ?? true)"
              :value="patternsToText(config.riskPolicy?.denyPatterns)"
              @input="(e: any) => updateDenyPatterns(e.target.value)"
            ></textarea>
            <div class="risk-hint">{{ t('components.settings.toolSettings.terminal.executeCommand.risk.denyPatternsHint') }}</div>
          </div>
        </div>
      </div>

      <!-- 改动后校验预设 -->
      <div class="config-section">
        <div class="section-header">
          <i class="codicon codicon-checklist"></i>
          <span>改动后校验</span>
        </div>

        <div class="validation-config">
          <CustomCheckbox
            :model-value="config.postEditValidation?.enabled ?? true"
            label="启用改动后校验提示"
            @update:model-value="updatePostEditValidationEnabled"
          />

          <div class="validation-presets" :class="{ disabled: !(config.postEditValidation?.enabled ?? true) }">
            <div
              v-for="p in (config.postEditValidation?.presets || [])"
              :key="p.id"
              class="validation-preset"
            >
              <CustomCheckbox
                :model-value="p.enabled ?? true"
                label="启用"
                :disabled="!(config.postEditValidation?.enabled ?? true)"
                @update:model-value="(v: boolean) => updateValidationPresetEnabled(p.id, v)"
              />

              <CustomSelect
                class="validation-kind"
                :model-value="p.kind || 'custom'"
                :options="validationKindOptions"
                :disabled="!(config.postEditValidation?.enabled ?? true)"
                @update:model-value="(val: string) => { p.kind = val as any; saveConfig() }"
              />

              <input
                v-model="p.label"
                class="validation-input"
                :disabled="!(config.postEditValidation?.enabled ?? true)"
                placeholder="名称（如 build/test/lint）"
                @blur="saveConfig"
              />

              <input
                v-model="p.command"
                class="validation-input validation-command"
                :disabled="!(config.postEditValidation?.enabled ?? true)"
                placeholder="命令（如 pnpm test / npm run lint）"
                @blur="saveConfig"
              />

              <button
                class="validation-remove"
                :disabled="!(config.postEditValidation?.enabled ?? true)"
                title="删除预设"
                @click="removeValidationPreset(p.id)"
              >
                <i class="codicon codicon-trash"></i>
              </button>
            </div>

            <button
              class="validation-add"
              :disabled="!(config.postEditValidation?.enabled ?? true)"
              @click="addValidationPreset"
            >
              <i class="codicon codicon-add"></i>
              添加预设
            </button>
          </div>

          <div class="validation-tip">
            提示：当文件修改类工具执行完成后，聊天页会展示校验入口；点击后将以 <code>execute_command</code> 工具消息写回对话。
          </div>
        </div>
      </div>
      
      <!-- 提示信息 -->
      <div class="config-tips">
        <i class="codicon codicon-info"></i>
        <div class="tips-content">
          <p>{{ t('components.settings.toolSettings.terminal.executeCommand.tips.onlyEnabledUsed') }}</p>
          <p>{{ t('components.settings.toolSettings.terminal.executeCommand.tips.statusMeaning') }}</p>
          <p>{{ t('components.settings.toolSettings.terminal.executeCommand.tips.windowsRecommend') }}</p>
          <p>{{ t('components.settings.toolSettings.terminal.executeCommand.tips.gitBashRequire') }}</p>
          <p>{{ t('components.settings.toolSettings.terminal.executeCommand.tips.wslRequire') }}</p>
          <p>{{ t('components.settings.toolSettings.terminal.executeCommand.tips.confirmSettings') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="./execute_command.css"></style>
