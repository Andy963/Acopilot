<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from '@/i18n'
import { AVAILABLE_PROMPT_MODULES } from './types'

const { t } = useI18n()

const emit = defineEmits<{
  insertModule: [moduleId: string]
}>()

const expandedModule = ref<string | null>(null)

function toggleModule(moduleId: string) {
  expandedModule.value = expandedModule.value === moduleId ? null : moduleId
}

function formatModuleId(id: string): string {
  return `\{\{$${id}\}\}`
}
</script>

<template>
  <div class="modules-reference">
    <h5 class="reference-title">
      <i class="codicon codicon-references"></i>
      {{ t('components.settings.promptSettings.modulesReference.title') }}
    </h5>

    <div class="modules-list">
      <div
        v-for="module in AVAILABLE_PROMPT_MODULES"
        :key="module.id"
        class="module-item"
        :class="{ expanded: expandedModule === module.id }"
      >
        <div class="module-header" @click="toggleModule(module.id)">
          <div class="module-info">
            <code class="module-id">{{ formatModuleId(module.id) }}</code>
            <span class="module-name">{{ t(`components.settings.promptSettings.modules.${module.id}.name`) }}</span>
          </div>
          <button
            class="insert-btn"
            :title="t('components.settings.promptSettings.modulesReference.insertTooltip')"
            @click.stop="emit('insertModule', module.id)"
          >
            <i class="codicon codicon-add"></i>
          </button>
        </div>

        <div v-if="expandedModule === module.id" class="module-details">
          <p class="module-description">{{ t(`components.settings.promptSettings.modules.${module.id}.description`) }}</p>

          <div v-if="module.requiresConfig" class="module-requires">
            <i class="codicon codicon-info"></i>
            <span>{{ t('components.settings.promptSettings.requiresConfigLabel') }} {{ t(`components.settings.promptSettings.modules.${module.id}.requiresConfig`) }}</span>
          </div>

          <div v-if="module.example" class="module-example">
            <label>{{ t('components.settings.promptSettings.exampleOutput') }}</label>
            <pre>{{ module.example }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modules-reference {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--vscode-panel-border);
}

.reference-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 12px 0;
  font-size: 13px;
  font-weight: 500;
}

.modules-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.module-item {
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  overflow: hidden;
}

.module-item.expanded {
  border-color: var(--vscode-focusBorder);
}

.module-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.module-header:hover {
  background: var(--vscode-list-hoverBackground);
}

.module-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.module-id {
  font-size: 11px;
  padding: 2px 6px;
  background: var(--vscode-textCodeBlock-background);
  border-radius: 3px;
  color: var(--vscode-textPreformat-foreground);
}

.module-name {
  font-size: 12px;
  color: var(--vscode-foreground);
}

.insert-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  background: transparent;
  color: var(--vscode-foreground);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.insert-btn:hover:not(:disabled) {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border-color: var(--vscode-button-background);
}

.module-details {
  padding: 10px 12px;
  background: var(--vscode-sideBar-background);
  border-top: 1px solid var(--vscode-panel-border);
}

.module-description {
  margin: 0 0 8px 0;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.module-requires {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  font-size: 11px;
  color: var(--vscode-notificationsInfoIcon-foreground);
}

.module-example {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.module-example label {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}

.module-example pre {
  margin: 0;
  padding: 8px;
  font-size: 11px;
  font-family: var(--vscode-editor-font-family), monospace;
  line-height: 1.4;
  background: var(--vscode-textCodeBlock-background);
  border-radius: 4px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
