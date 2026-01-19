<script setup lang="ts">
/**
 * UnifiedModelSelector - 统一模型选择器
 *
 * 将所有渠道的模型合并到一个下拉中展示，选择后返回唯一 key。
 */

import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { CustomScrollbar } from '../common'
import { useI18n } from '../../i18n'

const { t } = useI18n()

export interface UnifiedModelOption {
  key: string
  modelId: string
  modelName: string
  providerLabel: string
  channelName: string
}

const props = withDefaults(defineProps<{
  modelValue: string
  options: UnifiedModelOption[]
  placeholder?: string
  disabled?: boolean
  dropUp?: boolean
}>(), {
  options: () => [],
  disabled: false,
  dropUp: true
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const isOpen = ref(false)
const searchQuery = ref('')
const highlightedIndex = ref(-1)
const containerRef = ref<HTMLElement>()
const inputRef = ref<HTMLInputElement>()

const selectedOption = computed(() => props.options.find(o => o.key === props.modelValue))

const filteredOptions = computed(() => {
  if (!searchQuery.value) return props.options
  const query = searchQuery.value.toLowerCase()
  return props.options.filter(o =>
    o.modelId.toLowerCase().includes(query) ||
    o.modelName.toLowerCase().includes(query) ||
    o.providerLabel.toLowerCase().includes(query) ||
    o.channelName.toLowerCase().includes(query)
  )
})

function open() {
  if (props.disabled) return
  isOpen.value = true
  searchQuery.value = ''
  highlightedIndex.value = Math.max(0, filteredOptions.value.findIndex(o => o.key === props.modelValue))
  setTimeout(() => inputRef.value?.focus(), 10)
}

function close() {
  isOpen.value = false
  searchQuery.value = ''
  highlightedIndex.value = -1
}

function toggle() {
  if (isOpen.value) close()
  else open()
}

function select(option: UnifiedModelOption) {
  emit('update:modelValue', option.key)
  close()
}

function handleKeydown(event: KeyboardEvent) {
  if (!isOpen.value) {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault()
      open()
    }
    return
  }

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      highlightedIndex.value = Math.min(highlightedIndex.value + 1, filteredOptions.value.length - 1)
      break
    case 'ArrowUp':
      event.preventDefault()
      highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0)
      break
    case 'Enter':
      event.preventDefault()
      if (highlightedIndex.value >= 0 && highlightedIndex.value < filteredOptions.value.length) {
        select(filteredOptions.value[highlightedIndex.value])
      }
      break
    case 'Escape':
      event.preventDefault()
      close()
      break
  }
}

function handleClickOutside(event: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    close()
  }
}

watch(searchQuery, () => {
  highlightedIndex.value = 0
})

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div
    ref="containerRef"
    :class="['unified-model-selector', { open: isOpen, disabled, 'drop-up': dropUp }]"
    @keydown="handleKeydown"
  >
    <button
      type="button"
      class="selector-trigger"
      :disabled="disabled"
      @click="toggle"
    >
      <span v-if="selectedOption" class="selected-value">
        <span class="selected-primary">{{ selectedOption.modelName }}</span>
        <span
          class="selected-secondary"
          :title="`${selectedOption.channelName} · ${selectedOption.providerLabel}`"
        >
          via {{ selectedOption.channelName }}
        </span>
      </span>
      <span v-else class="placeholder">{{ placeholder || t('components.input.modelSelector.placeholder') }}</span>
      <span :class="['select-arrow', isOpen ? 'arrow-up' : 'arrow-down']">▼</span>
    </button>

    <Transition name="dropdown">
      <div v-if="isOpen" class="selector-dropdown">
        <div class="search-wrapper">
          <input
            ref="inputRef"
            v-model="searchQuery"
            type="text"
            class="search-input"
            :placeholder="t('components.input.modelSelector.searchPlaceholder')"
            @click.stop
          />
        </div>

        <CustomScrollbar :max-height="240" :width="5" :offset="1">
          <div class="options-list">
            <template v-if="filteredOptions.length > 0">
              <div
                v-for="(option, index) in filteredOptions"
                :key="option.key"
                :class="[
                  'option-item',
                  { selected: option.key === modelValue, highlighted: index === highlightedIndex }
                ]"
                @click="select(option)"
                @mouseenter="highlightedIndex = index"
              >
                <div class="option-content">
                  <span class="option-primary">{{ option.modelName }}</span>
                  <span class="option-secondary">
                    via {{ option.channelName }}<span class="secondary-sep">·</span>{{ option.providerLabel }}
                  </span>
                </div>
                <span v-if="option.key === modelValue" class="check-icon">✓</span>
              </div>
            </template>

            <div v-else class="empty-state">
              <span>{{ t('components.input.modelSelector.noMatch') }}</span>
            </div>
          </div>
        </CustomScrollbar>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.unified-model-selector {
  position: relative;
  width: 100%;
}

.unified-model-selector.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.selector-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 4px 8px;
  background: transparent;
  color: var(--vscode-descriptionForeground);
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.15s, color 0.15s;
  min-width: 0;
}

.selector-trigger:hover:not(:disabled) {
  background: var(--vscode-toolbar-hoverBackground);
  color: var(--vscode-foreground);
}

.unified-model-selector.open .selector-trigger {
  background: var(--vscode-toolbar-activeBackground);
  color: var(--vscode-foreground);
}

.selected-value {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.selected-primary {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: inherit;
}

.selected-secondary {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  opacity: 0.8;
}

.placeholder {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.select-arrow {
  flex-shrink: 0;
  font-size: 8px;
  margin-left: 6px;
  transition: transform 0.15s;
}

.select-arrow.arrow-up {
  transform: rotate(180deg);
}

.selector-dropdown {
  position: absolute;
  bottom: 100%;
  right: 0;
  width: 240px;
  max-width: 90vw;
  min-width: 0;
  margin-bottom: 4px;
  background: var(--vscode-dropdown-background);
  border: 1px solid var(--vscode-dropdown-border);
  border-radius: 6px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
  z-index: 10000;
  overflow: visible;
}

.unified-model-selector:not(.drop-up) .selector-dropdown {
  top: 100%;
  bottom: auto;
  margin-top: 4px;
  margin-bottom: 0;
}

.search-wrapper {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  border-bottom: 1px solid var(--vscode-dropdown-border);
  min-width: 0;
  overflow: hidden;
}

.search-input {
  flex: 1;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
  background: var(--vscode-input-background);
  border: 1px solid var(--vscode-input-border);
  border-radius: 4px;
  padding: 4px 8px;
  color: var(--vscode-input-foreground);
  font-size: 12px;
  outline: none;
}

.search-input::placeholder {
  color: var(--vscode-input-placeholderForeground);
}

.options-list {
  padding: 4px 0;
}

.option-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  cursor: pointer;
  transition: background-color 0.1s;
  gap: 8px;
}

.option-item:hover,
.option-item.highlighted {
  background: var(--vscode-list-hoverBackground);
}

.option-item.selected {
  background: var(--vscode-list-activeSelectionBackground);
  color: var(--vscode-list-activeSelectionForeground);
}

.option-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.option-primary {
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.option-secondary {
  font-size: 10px;
  color: var(--vscode-descriptionForeground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.option-item.selected .option-secondary {
  color: var(--vscode-list-activeSelectionForeground);
  opacity: 0.75;
}

.secondary-sep {
  padding: 0 4px;
  opacity: 0.8;
}

.check-icon {
  flex-shrink: 0;
  font-size: 12px;
}

.empty-state {
  padding: 12px 8px;
  text-align: center;
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>
