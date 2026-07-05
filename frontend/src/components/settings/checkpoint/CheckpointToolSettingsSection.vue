<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/i18n'
import { CustomCheckbox } from '@/components/common'
import type { ToolInfo } from './types'

const { t } = useI18n()

const props = defineProps<{
  enabled: boolean
  tools: ToolInfo[]
  beforeTools: string[]
  afterTools: string[]
}>()

const emit = defineEmits<{
  toggleAllBefore: [enabled: boolean]
  toggleAllAfter: [enabled: boolean]
  toggleBefore: [payload: { toolName: string; enabled: boolean }]
  toggleAfter: [payload: { toolName: string; enabled: boolean }]
}>()

const isAllBeforeSelected = computed(() =>
  props.tools.length > 0 && props.tools.every(tool => props.beforeTools.includes(tool.name))
)

const isAllAfterSelected = computed(() =>
  props.tools.length > 0 && props.tools.every(tool => props.afterTools.includes(tool.name))
)

function isToolInBefore(toolName: string): boolean {
  return props.beforeTools.includes(toolName)
}

function isToolInAfter(toolName: string): boolean {
  return props.afterTools.includes(toolName)
}

function getToolDisplayName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
}
</script>

<template>
  <div class="setting-group" :class="{ disabled: !enabled }">
    <h4 class="group-title">
      <i class="codicon codicon-file-code"></i>
      {{ t('components.settings.checkpoint.sections.tools.title') }}
    </h4>
    <p class="setting-description">
      {{ t('components.settings.checkpoint.sections.tools.description') }}
    </p>

    <div class="tools-table">
      <div class="table-header">
        <div class="col-tool">{{ t('components.settings.checkpoint.sections.tools.title') }}</div>
        <div class="col-before">
          <CustomCheckbox
            :modelValue="isAllBeforeSelected"
            :label="t('components.settings.checkpoint.sections.tools.beforeLabel')"
            :disabled="!enabled"
            @update:modelValue="emit('toggleAllBefore', $event)"
          />
        </div>
        <div class="col-after">
          <CustomCheckbox
            :modelValue="isAllAfterSelected"
            :label="t('components.settings.checkpoint.sections.tools.afterLabel')"
            :disabled="!enabled"
            @update:modelValue="emit('toggleAllAfter', $event)"
          />
        </div>
      </div>

      <div
        v-for="tool in tools"
        :key="tool.name"
        class="table-row"
      >
        <div class="col-tool">
          <span class="tool-name">{{ getToolDisplayName(tool.name) }}</span>
          <span class="tool-desc">{{ tool.description }}</span>
        </div>
        <div class="col-before">
          <CustomCheckbox
            :modelValue="isToolInBefore(tool.name)"
            :disabled="!enabled"
            @update:modelValue="emit('toggleBefore', { toolName: tool.name, enabled: $event })"
          />
        </div>
        <div class="col-after">
          <CustomCheckbox
            :modelValue="isToolInAfter(tool.name)"
            :disabled="!enabled"
            @update:modelValue="emit('toggleAfter', { toolName: tool.name, enabled: $event })"
          />
        </div>
      </div>

      <div v-if="tools.length === 0" class="empty-state">
        <span>{{ t('components.settings.checkpoint.sections.tools.empty') }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.setting-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: opacity 0.2s;
}

.setting-group.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.group-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 13px;
  font-weight: 500;
}

.group-title .codicon {
  font-size: 14px;
  color: var(--vscode-foreground);
}

.setting-description {
  margin: 0;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.tools-table {
  display: flex;
  flex-direction: column;
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
  overflow: hidden;
  margin-top: 8px;
}

.table-header {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  background: var(--vscode-sideBarSectionHeader-background);
  border-bottom: 1px solid var(--vscode-panel-border);
  font-size: 12px;
  font-weight: 500;
}

.table-row {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid var(--vscode-panel-border);
}

.table-row:last-child {
  border-bottom: none;
}

.table-row:hover {
  background: var(--vscode-list-hoverBackground);
}

.col-tool {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.col-before,
.col-after {
  width: 80px;
  flex-shrink: 0;
  display: flex;
  justify-content: center;
}

.tool-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--vscode-foreground);
}

.tool-desc {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: var(--vscode-descriptionForeground);
  font-size: 13px;
}
</style>
