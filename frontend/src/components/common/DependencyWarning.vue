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
}>()

const settingsStore = useSettingsStore()

function goToDependencySettings() {
  settingsStore.showSettings('dependencies')
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
  </div>
</template>

<style scoped>
.dependency-warning {
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
</style>