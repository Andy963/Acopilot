<script setup lang="ts">
/**
 * DependencyWarning - 可复用的依赖警告组件
 *
 * 用于在工具面板或设置页面中显示依赖缺失警告
 *
 * @example
 * ```vue
 * <DependencyWarning
 *   :dependencies="['sharp']"
 *   message="此功能需要安装 sharp 库"
 * />
 * ```
 */

import { useSettingsStore } from '../../stores/settingsStore'
import { t } from '../../i18n'

defineProps<{
  /** 缺失的依赖列表 */
  dependencies: string[]
  /** 自定义警告消息（可选） */
  message?: string
  /** 是否显示为紧凑模式（无边框背景） */
  compact?: boolean
  /** Whether to show an inline install action */
  showInstallAction?: boolean
  /** Whether the dependency install action is running */
  installing?: boolean
  /** Copyable failure log */
  failureLog?: string
}>()

const emit = defineEmits<{
  install: []
  copyFailureLog: []
}>()

const settingsStore = useSettingsStore()

function goToDependencySettings() {
  settingsStore.showSettings('tools')
}
</script>

<template>
  <div :class="['dependency-warning', { compact }]">
    <div class="warning-content">
      <span class="codicon codicon-warning warning-icon"></span>
      <span v-if="message" class="warning-text">{{ message }}</span>
      <span v-else class="warning-text">
        {{ t('components.common.dependencyWarning.defaultMessage') }}
        <span class="dep-list">{{ dependencies.join(', ') }}</span>
        <span class="separator">·</span>
        <a class="dep-link" @click="goToDependencySettings">{{ t('components.common.dependencyWarning.linkText') }}</a>
      </span>
    </div>
    <div v-if="showInstallAction || failureLog" class="warning-actions">
      <button
        v-if="showInstallAction"
        class="warning-action install"
        :disabled="installing || dependencies.length === 0"
        @click.stop="emit('install')"
      >
        <i v-if="installing" class="codicon codicon-loading codicon-modifier-spin"></i>
        <i v-else class="codicon codicon-cloud-download"></i>
        {{ installing ? t('components.common.dependencyWarning.installing') : t('components.common.dependencyWarning.installMissing') }}
      </button>
      <button
        v-if="failureLog"
        class="warning-action secondary"
        @click.stop="emit('copyFailureLog')"
      >
        <i class="codicon codicon-copy"></i>
        {{ t('components.common.dependencyWarning.copyFailureLog') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.dependency-warning {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  background: color-mix(in srgb, var(--vscode-inputValidation-warningBackground), transparent 85%);
  border: 1px solid color-mix(in srgb, var(--vscode-inputValidation-warningBorder), transparent 60%);
  border-left: 4px solid var(--vscode-charts-orange);
  border-radius: 6px;
  margin: 8px 0;
}

.dependency-warning.compact {
  padding: 4px 8px;
  background: transparent;
  border: none;
  border-left: 3px solid var(--vscode-charts-orange);
  margin: 4px 0;
}

.warning-content {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--vscode-inputValidation-warningForeground);
  min-width: 0;
}

.warning-icon {
  color: var(--vscode-charts-orange);
  font-size: 14px;
  flex-shrink: 0;
}

.warning-text {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  line-height: 1.5;
}

.dep-list {
  font-weight: 600;
  font-family: var(--vscode-editor-font-family);
  margin: 0 2px;
}

.separator {
  margin: 0 4px;
  opacity: 0.6;
}

.dep-link {
  color: var(--vscode-textLink-foreground);
  cursor: pointer;
  text-decoration: none;
}

.dep-link:hover {
  color: var(--vscode-textLink-activeForeground);
  text-decoration: underline;
}

.warning-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.warning-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
}

.warning-action.install {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.warning-action.install:hover:not(:disabled) {
  background: var(--vscode-button-hoverBackground);
}

.warning-action.secondary {
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
}

.warning-action.secondary:hover {
  background: var(--vscode-button-secondaryHoverBackground);
}

.warning-action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.codicon-modifier-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>