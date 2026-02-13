<script setup lang="ts">
/**
 * SendButton - 发送按钮
 * 使用纸飞机图标，扁平化设计
 * loading 状态下显示停止图标，点击可取消请求
 */

import { computed } from 'vue'
import { useI18n } from '../../i18n'

const { t } = useI18n()

const props = defineProps<{
  disabled?: boolean
  loading?: boolean
}>()

const emit = defineEmits<{
  click: []
  cancel: []
}>()

// 按钮状态计算
const buttonState = computed(() => {
  if (props.loading) {
    return {
      title: t('components.input.stopGenerating'),
      icon: 'codicon codicon-primitive-square stop-icon',
      isDisabled: false
    }
  }
  return {
    title: t('components.input.send'),
    icon: 'codicon codicon-send send-icon',
    isDisabled: props.disabled
  }
})

// 处理点击
function handleClick() {
  if (props.loading) {
    emit('cancel')
  } else {
    emit('click')
  }
}
</script>

<template>
  <button
    class="send-button"
    :disabled="buttonState.isDisabled"
    :title="buttonState.title"
    :aria-label="buttonState.title"
    @click="handleClick"
  >
    <i :class="buttonState.icon"></i>
  </button>
</template>

<style scoped>
.send-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  color: var(--vscode-foreground);
  border: none;
  border-radius: var(--radius-sm, 2px);
  cursor: pointer;
  transition: background-color var(--transition-fast, 0.1s), opacity var(--transition-fast, 0.1s);
  flex-shrink: 0;
}

.send-button:hover:not(:disabled) {
  background: var(--vscode-toolbar-hoverBackground);
}

.send-button:active:not(:disabled) {
  background: var(--vscode-toolbar-activeBackground);
}

.send-button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.send-icon {
  font-size: 16px;
  position: relative;
  top: 1px;
}

.stop-icon {
  font-size: 25px;
}
</style>
