<script setup lang="ts">
/**
 * SettingsGroup - Settings accordion/panel
 *
 * Unified collapsible group for settings pages (scheme C).
 */

import { computed, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  title: string
  icon?: string
  description?: string
  badge?: string | number
  modelValue?: boolean
  defaultExpanded?: boolean
  storageKey?: string
  disabled?: boolean
}>(), {
  icon: '',
  description: '',
  badge: '',
  defaultExpanded: true,
  disabled: false
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const isControlled = computed(() => props.modelValue !== undefined)
const internalExpanded = ref<boolean>(props.defaultExpanded)

const expanded = computed<boolean>({
  get() {
    return isControlled.value ? (props.modelValue as boolean) : internalExpanded.value
  },
  set(value: boolean) {
    if (props.disabled) return
    if (isControlled.value) emit('update:modelValue', value)
    else internalExpanded.value = value
  }
})

function toggle() {
  expanded.value = !expanded.value
}

onMounted(() => {
  if (!props.storageKey) return
  try {
    const raw = localStorage.getItem(props.storageKey)
    if (raw === null) return
    expanded.value = raw === 'true'
  } catch {
    // ignore storage errors
  }
})

watch(expanded, (value) => {
  if (!props.storageKey) return
  try {
    localStorage.setItem(props.storageKey, String(value))
  } catch {
    // ignore storage errors
  }
})
</script>

<template>
  <div class="settings-group" :class="{ expanded, disabled }">
    <div class="group-header" @click="toggle">
      <div class="header-left">
        <i v-if="icon" :class="['codicon', icon]"></i>
        <div class="header-text">
          <div class="title-row">
            <span class="group-title">{{ title }}</span>
            <span v-if="badge !== ''" class="group-badge">{{ badge }}</span>
          </div>
          <div v-if="description" class="group-desc">{{ description }}</div>
        </div>
      </div>

      <div class="header-right" @click.stop>
        <slot name="actions" />
        <i :class="['codicon', expanded ? 'codicon-chevron-down' : 'codicon-chevron-right', 'chevron']"></i>
      </div>
    </div>

    <Transition name="group">
      <div v-if="expanded" class="group-content">
        <slot />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.settings-group {
  border: 1px solid var(--lc-settings-border, var(--vscode-panel-border));
  border-radius: var(--lc-settings-radius-lg, 8px);
  background: var(--lc-settings-surface, var(--vscode-editor-background));
  overflow: hidden;
}

.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.15s;
}

.settings-group:not(.disabled) .group-header:hover {
  background: var(--lc-settings-surface-hover, var(--vscode-list-hoverBackground));
}

.settings-group.disabled {
  opacity: 0.55;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.header-left .codicon {
  font-size: 14px;
  color: var(--vscode-foreground);
  flex-shrink: 0;
}

.header-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.group-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--vscode-foreground);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-desc {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-badge {
  flex-shrink: 0;
  padding: 2px 8px;
  background: var(--vscode-badge-background);
  color: var(--vscode-badge-foreground);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}

.header-right {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.chevron {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.group-content {
  padding: 10px 12px 12px;
  border-top: 1px solid var(--lc-settings-border, var(--vscode-panel-border));
}

.group-enter-active,
.group-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.group-enter-from,
.group-leave-to {
  opacity: 0;
  transform: translateY(-2px);
}
</style>

