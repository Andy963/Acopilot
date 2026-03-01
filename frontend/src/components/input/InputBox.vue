<script setup lang="ts">
/**
 * InputBox - 文本输入框
 * 扁平化设计，支持多行输入、自动高度、快捷键
 * 自定义悬浮滚动条
 */

import { ref, watch, nextTick, onMounted, onBeforeUnmount, computed } from 'vue'
import { sendToExtension } from '../../utils/vscode'
import { useI18n } from '../../i18n'
import { DEFAULT_MAX_ROWS, DEFAULT_MIN_ROWS, computeTextareaHeight } from './textareaAutoResize'
import { createInputBoxFileDrop } from './inputBoxFileDrop'

const { t } = useI18n()

const props = defineProps<{
  value: string
  disabled?: boolean
  placeholder?: string
  maxLength?: number
  minRows?: number
  maxRows?: number
  variant?: 'standalone' | 'embedded'
  historyNavigationActive?: boolean
}>()

const emit = defineEmits<{
  'update:value': [value: string]
  send: []
  'composition-start': []
  'composition-end': []
  paste: [files: File[]]
  'file-path-drop': [paths: string[]]
  'trigger-at-picker': [query: string, triggerPosition: number]
  'close-at-picker': []
  'at-query-change': [query: string]
  'at-picker-keydown': [key: string]  // 专门用于文件选择器的键盘事件
  'history-keydown': [key: 'ArrowUp' | 'ArrowDown']
}>()

const textareaRef = ref<HTMLTextAreaElement>()
const currentRows = ref(props.minRows || DEFAULT_MIN_ROWS)
const lastSetHeight = ref('')
const isManuallyResized = ref(false)

// 调整高度时的检测状态
const cachedLineHeight = ref(0)
const cachedVerticalPadding = ref(0)
const cachedVerticalBorder = ref(0)
const cachedIsBorderBox = ref(true)
const lastScrollHeight = ref(0)

// 拖拽状态
const isDragOver = ref(false)

const { handleDrop } = createInputBoxFileDrop({
  textareaRef,
  getValue: () => props.value,
  updateValue: (value) => emit('update:value', value),
  onPathsDropped: (paths) => emit('file-path-drop', paths),
  setDragOver: (value) => {
    isDragOver.value = value
  },
  sendToExtension
})

// 滚动条状态
const thumbHeight = ref(0)
const thumbTop = ref(0)
const showScrollbar = ref(false)
let isDragging = false
let startY = 0
let startScrollTop = 0

// 调整高度
function adjustHeight() {
  if (!textareaRef.value) return
  
  const textarea = textareaRef.value

  // 检测手动调整
  if (lastSetHeight.value && textarea.style.height !== lastSetHeight.value) {
    isManuallyResized.value = true
  }
  if (isManuallyResized.value) return

  const minRows = props.minRows || DEFAULT_MIN_ROWS  // Default: 3 rows
  const maxRows = props.maxRows || DEFAULT_MAX_ROWS
  
  // 获取并缓存行高，避免频繁读取 DOM
  if (!cachedLineHeight.value) {
    const styles = getComputedStyle(textarea)
    cachedLineHeight.value = parseFloat(styles.lineHeight) || 20
    cachedVerticalPadding.value = (parseFloat(styles.paddingTop) || 0) + (parseFloat(styles.paddingBottom) || 0)
    cachedVerticalBorder.value = (parseFloat(styles.borderTopWidth) || 0) + (parseFloat(styles.borderBottomWidth) || 0)
    cachedIsBorderBox.value = styles.boxSizing === 'border-box'
  }
  
  const lineHeight = cachedLineHeight.value
  const verticalPadding = cachedVerticalPadding.value
  const verticalBorder = cachedVerticalBorder.value
  const isBorderBox = cachedIsBorderBox.value
  
  // 核心优化：增加高度变化检测
  // 在固定高度模式下，scrollHeight 代表内容真实高度（即使被 height 限制）
  // 如果它没变，说明行数没变，不需要重设 height='auto'（这会强制重排）
  const scrollHeightBefore = textarea.scrollHeight
  if (scrollHeightBefore === lastScrollHeight.value && lastScrollHeight.value !== 0) {
    return
  }

  // 重置高度以获取正确的 scrollHeight
  const oldHeight = textarea.style.height
  textarea.style.height = 'auto'
  
  // 获取实际内容高度
  const contentHeightRaw = Math.max(0, textarea.scrollHeight - verticalPadding)
  const minContentHeight = minRows * lineHeight
  // `scrollHeight` is an integer and can slightly overshoot the theoretical `minRows * lineHeight`
  // for border-box + fractional line-height, which would incorrectly bump 3 -> 4 rows on first input.
  const overshootTolerancePx = Math.max(1, Math.ceil(lineHeight * 0.25))
  const contentHeight = contentHeightRaw <= minContentHeight + overshootTolerancePx ? minContentHeight : contentHeightRaw

  const { rows, heightPx } = computeTextareaHeight({
    contentHeight,
    lineHeight,
    minRows,
    maxRows
  })

  const totalHeightPx = isBorderBox ? heightPx + verticalPadding + verticalBorder : heightPx
  const finalHeight = `${totalHeightPx}px`
  
  // 只有当高度真正改变时才更新 DOM
  if (oldHeight !== finalHeight) {
    textarea.style.height = finalHeight
    lastSetHeight.value = finalHeight
    currentRows.value = rows
  } else {
    // 如果没变，恢复原状
    textarea.style.height = oldHeight
  }
  
  // 记录本次的内容高度，用于下次对比
  lastScrollHeight.value = textarea.scrollHeight
  
  // 更新滚动条
  nextTick(() => updateScrollbar())
}

// 更新滚动条状态
function updateScrollbar() {
  if (!textareaRef.value) return
  
  const textarea = textareaRef.value
  const scrollHeight = textarea.scrollHeight
  const clientHeight = textarea.clientHeight
  const scrollTop = textarea.scrollTop
  
  // 判断是否需要显示滚动条
  showScrollbar.value = scrollHeight > clientHeight
  
  if (!showScrollbar.value) return
  
  // 计算滑块高度（最小24px）
  const ratio = clientHeight / Math.max(1, scrollHeight)
  thumbHeight.value = Math.max(24, clientHeight * ratio)
  
  // 计算滑块位置
  const maxScrollTop = Math.max(1, scrollHeight - clientHeight)
  const maxThumbTop = Math.max(1, clientHeight - thumbHeight.value)
  thumbTop.value = (scrollTop / maxScrollTop) * maxThumbTop
}

// 滚动事件处理
function handleScroll() {
  updateScrollbar()
}

// 鼠标按下滑块
function handleThumbMouseDown(e: MouseEvent) {
  if (!textareaRef.value) return
  
  isDragging = true
  startY = e.clientY
  startScrollTop = textareaRef.value.scrollTop
  
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
  
  e.preventDefault()
}

// 鼠标移动
function handleMouseMove(e: MouseEvent) {
  if (!isDragging || !textareaRef.value) return
  
  const textarea = textareaRef.value
  const deltaY = e.clientY - startY
  const scrollHeight = textarea.scrollHeight
  const clientHeight = textarea.clientHeight
  const maxScrollTop = scrollHeight - clientHeight
  const maxThumbTop = clientHeight - thumbHeight.value
  
  // 计算新的滚动位置
  const scrollDelta = (deltaY / maxThumbTop) * maxScrollTop
  textarea.scrollTop = startScrollTop + scrollDelta
}

// 鼠标释放
function handleMouseUp() {
  isDragging = false
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
}

// 监听值变化
watch(() => props.value, () => {
  nextTick(() => adjustHeight())
})

// @ 触发状态
const atTriggerPosition = ref<number | null>(null)

// 处理输入
function handleInput(e: Event) {
  const target = e.target as HTMLTextAreaElement
  const value = target.value
  const cursorPos = target.selectionStart
  
  // 检测 @ 触发
  if (atTriggerPosition.value !== null) {
    // 已经在 @ 模式中，更新查询
    const query = value.substring(atTriggerPosition.value + 1, cursorPos)
    
    // 检查是否应该关闭（遇到空格或删除了 @）
    if (cursorPos <= atTriggerPosition.value || query.includes(' ') || query.includes('\n')) {
      atTriggerPosition.value = null
      emit('close-at-picker')
    } else {
      emit('at-query-change', query)
    }
  } else {
    // 检测是否刚输入了 @
    const charBefore = value[cursorPos - 2] || ''
    const currentChar = value[cursorPos - 1]
    
    if (currentChar === '@' && (charBefore === '' || charBefore === ' ' || charBefore === '\n')) {
      atTriggerPosition.value = cursorPos - 1
      emit('trigger-at-picker', '', cursorPos - 1)
    }
  }
  
  emit('update:value', value)
}

// 处理按键
function handleKeydown(e: KeyboardEvent) {
  // 如果在 @ 模式中，某些按键需要传递给父组件处理
  if (atTriggerPosition.value !== null) {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      // 导航按键传递给父组件
      e.preventDefault()
      emit('at-picker-keydown', e.key)
      return
    }
    if (e.key === 'Tab' || e.key === 'Enter') {
      // Tab 或 Enter 选择当前文件
      e.preventDefault()
      emit('at-picker-keydown', 'Enter')
      return
    }
    if (e.key === 'Escape') {
      // 关闭面板
      e.preventDefault()
      atTriggerPosition.value = null
      emit('close-at-picker')
      return
    }
  }

  // 输入历史导航（类似 shell history）
  if (
    (e.key === 'ArrowUp' || e.key === 'ArrowDown') &&
    (props.historyNavigationActive || props.value.trim().length === 0)
  ) {
    e.preventDefault()
    emit('history-keydown', e.key as 'ArrowUp' | 'ArrowDown')
    return
  }
  
  // Enter 发送（Shift+Enter 换行）
  if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
    e.preventDefault()
    emit('send')
  }
  
  // Ctrl+Enter 也可以发送
  if (e.key === 'Enter' && e.ctrlKey) {
    e.preventDefault()
    emit('send')
  }
}

// 处理输入法
function handleCompositionStart() {
  emit('composition-start')
}

function handleCompositionEnd() {
  emit('composition-end')
}

// 处理粘贴事件
function handlePaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return
  
  const files: File[] = []
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    // 处理文件类型（图片、文件等）
    if (item.kind === 'file') {
      const file = item.getAsFile()
      if (file) {
        files.push(file)
      }
    }
  }
  
  // 如果有文件，触发 paste 事件
  if (files.length > 0) {
    e.preventDefault()  // 阻止默认粘贴行为
    emit('paste', files)
  }
  // 如果是纯文本，让浏览器默认处理
}

// 处理拖拽进入
function handleDragEnter(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  isDragOver.value = true
}

// 处理拖拽离开
function handleDragLeave(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  // 检查是否真的离开了元素
  const rect = textareaRef.value?.getBoundingClientRect()
  if (rect) {
    const x = e.clientX
    const y = e.clientY
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      isDragOver.value = false
    }
  }
}

// 处理拖拽悬停
function handleDragOver(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  // 设置 dropEffect 告诉浏览器这是一个复制操作
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'copy'
  }
  isDragOver.value = true
}

// 聚焦
function focus() {
  textareaRef.value?.focus()
}

// 滑块样式
const thumbStyle = computed(() => ({
  height: `${thumbHeight.value}px`,
  top: `${thumbTop.value}px`
}))

// 挂载
onMounted(() => {
  nextTick(() => {
    adjustHeight()
  })
})

// 卸载
onBeforeUnmount(() => {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
})

// 关闭 @ 面板
function closeAtPicker() {
  atTriggerPosition.value = null
}

// 插入选中的文件路径（替换 @ 和查询文本）
function insertFilePath(path: string) {
  if (!textareaRef.value || atTriggerPosition.value === null) return
  
  const textarea = textareaRef.value
  const value = props.value
  const triggerPos = atTriggerPosition.value
  const cursorPos = textarea.selectionStart
  
  // 构建新值：@ 之前的内容 + @path + 空格 + 原光标之后的内容
  const beforeAt = value.substring(0, triggerPos)
  const afterCursor = value.substring(cursorPos)
  const insertText = `@${path} `
  
  const newValue = beforeAt + insertText + afterCursor
  emit('update:value', newValue)
  
  // 关闭面板
  atTriggerPosition.value = null
  emit('close-at-picker')
  
  // 设置光标位置到插入内容之后
  nextTick(() => {
    if (textareaRef.value) {
      const newCursorPos = triggerPos + insertText.length
      textareaRef.value.setSelectionRange(newCursorPos, newCursorPos)
      textareaRef.value.focus()
    }
  })
}

// 获取当前触发位置
function getAtTriggerPosition(): number | null {
  return atTriggerPosition.value
}

// 暴露方法
defineExpose({
  focus,
  closeAtPicker,
  insertFilePath,
  getAtTriggerPosition
})
</script>

<template>
  <div class="input-box" :class="{ 'drag-over': isDragOver, embedded: props.variant === 'embedded' }">
    <textarea
      ref="textareaRef"
      :rows="props.minRows || DEFAULT_MIN_ROWS"
      :value="value"
      :disabled="disabled"
      :placeholder="placeholder || t('components.input.placeholderHint')"
      :maxlength="maxLength"
      class="input-textarea"
      @input="handleInput"
      @keydown="handleKeydown"
      @scroll="handleScroll"
      @compositionstart="handleCompositionStart"
      @compositionend="handleCompositionEnd"
      @paste="handlePaste"
      @dragenter="handleDragEnter"
      @dragleave="handleDragLeave"
      @dragover="handleDragOver"
      @drop="handleDrop"
    />
    
    <!-- 自定义滚动条 -->
    <div
      v-show="showScrollbar"
      class="scroll-track"
    >
      <div
        class="scroll-thumb"
        :style="thumbStyle"
        @mousedown="handleThumbMouseDown"
      />
    </div>
    
    <!-- 字符计数 -->
    <div v-if="maxLength" class="char-count">
      {{ value.length }} / {{ maxLength }}
    </div>
  </div>
</template>

<style scoped src="./InputBox.css"></style>
