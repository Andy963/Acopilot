<script setup lang="ts">
import { computed } from 'vue'
import { IconButton } from '../common'
import { useChatStore } from '../../stores'
import { useI18n } from '../../i18n'
import type { ContextInjectionOverrides } from '../../types'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const chatStore = useChatStore()

type ContextOverrideKey = keyof ContextInjectionOverrides

const messageContextOverridesCount = computed(() => Object.keys(chatStore.messageContextOverrides || {}).length)
const hasMessageContextOverrides = computed(() => messageContextOverridesCount.value > 0)

const messageContextOverrideItems = computed((): Array<{ key: ContextOverrideKey; label: string }> => [
  { key: 'includePinnedPrompt', label: t('components.input.messageContextOverrides.items.pinnedPrompt') },
  { key: 'includePinnedFiles', label: t('components.input.messageContextOverrides.items.pinnedFiles') },
  { key: 'includeWorkspaceFiles', label: t('components.input.messageContextOverrides.items.workspaceFiles') },
  { key: 'includeOpenTabs', label: t('components.input.messageContextOverrides.items.openTabs') },
  { key: 'includeActiveEditor', label: t('components.input.messageContextOverrides.items.activeEditor') },
  { key: 'includeDiagnostics', label: t('components.input.messageContextOverrides.items.diagnostics') },
  { key: 'includeTools', label: t('components.input.messageContextOverrides.items.tools') }
])

function getMessageContextOverrideValue(key: ContextOverrideKey): boolean | undefined {
  const overrides = chatStore.messageContextOverrides
  const v = overrides ? (overrides as any)[key] : undefined
  return typeof v === 'boolean' ? v : undefined
}

function setMessageContextOverride(key: ContextOverrideKey, value: boolean | undefined) {
  chatStore.setMessageContextOverride(key, value)
}

function clearMessageContextOverrides() {
  chatStore.clearMessageContextOverrides()
}

function emitClose() {
  emit('close')
}
</script>

<template>
  <div v-if="props.visible" class="context-overrides-panel">
    <div class="context-overrides-header">
      <span class="context-overrides-title">
        <i class="codicon codicon-filter"></i>
        {{ t('components.input.messageContextOverrides.title') }}
      </span>
      <div class="context-overrides-header-actions">
        <button
          class="context-overrides-reset"
          :disabled="!hasMessageContextOverrides"
          @click="clearMessageContextOverrides"
        >
          {{ t('components.input.messageContextOverrides.reset') }}
        </button>
        <IconButton
          icon="codicon-close"
          size="small"
          @click="emitClose"
        />
      </div>
    </div>
    <div class="context-overrides-description">
      {{ t('components.input.messageContextOverrides.description') }}
    </div>
    <div class="context-overrides-content">
      <div v-for="item in messageContextOverrideItems" :key="item.key" class="context-overrides-row">
        <span class="context-overrides-label">{{ item.label }}</span>
        <div class="context-overrides-segment">
          <button
            class="segment-btn"
            :class="{ active: getMessageContextOverrideValue(item.key) === undefined }"
            @click="setMessageContextOverride(item.key, undefined)"
          >
            {{ t('components.input.messageContextOverrides.inherit') }}
          </button>
          <button
            class="segment-btn"
            :class="{ active: getMessageContextOverrideValue(item.key) === true }"
            @click="setMessageContextOverride(item.key, true)"
          >
            {{ t('components.input.messageContextOverrides.on') }}
          </button>
          <button
            class="segment-btn"
            :class="{ active: getMessageContextOverrideValue(item.key) === false }"
            @click="setMessageContextOverride(item.key, false)"
          >
            {{ t('components.input.messageContextOverrides.off') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.context-overrides-panel {
  position: absolute;
  bottom: 100%;
  right: 8px;
  width: min(360px, calc(100% - 16px));
  margin-bottom: 8px;
  background: var(--vscode-editorWidget-background);
  border: 1px solid var(--vscode-editorWidget-border);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 110;
  max-height: 360px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.context-overrides-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-bottom: 1px solid var(--vscode-panel-border);
}

.context-overrides-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
}

.context-overrides-header-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.context-overrides-reset {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid var(--vscode-panel-border);
  background: transparent;
  color: var(--vscode-foreground);
  cursor: pointer;
}

.context-overrides-reset:hover:not(:disabled) {
  background: var(--vscode-toolbar-hoverBackground);
}

.context-overrides-reset:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.context-overrides-description {
  padding: 6px 10px;
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  border-bottom: 1px solid var(--vscode-panel-border);
}

.context-overrides-content {
  padding: 10px;
  overflow-y: auto;
}

.context-overrides-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 0;
}

.context-overrides-label {
  font-size: 12px;
  color: var(--vscode-foreground);
  flex: 1;
  min-width: 0;
}

.context-overrides-segment {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 999px;
  overflow: hidden;
  flex-shrink: 0;
}

.segment-btn {
  border: none;
  background: transparent;
  color: var(--vscode-foreground);
  font-size: 11px;
  padding: 4px 8px;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.segment-btn:hover {
  background: var(--vscode-toolbar-hoverBackground);
}

.segment-btn.active {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}
</style>
