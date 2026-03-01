<script setup lang="ts">
/**
 * rotate_image 工具的内容面板
 *
 * 显示：
 * - 依赖状态检查（sharp）
 * - 旋转任务信息（角度、路径、格式）
 * - 处理进度
 * - 旋转结果图片
 * - 保存按钮
 * - 终止按钮
 */

import { computed, ref } from 'vue'
import { sendToExtension } from '../../../utils/vscode'
import { useChatStore } from '../../../stores/chatStore'
import { useDependency } from '../../../composables/useDependency'
import { useI18n } from '../../../composables/useI18n'
import { DependencyWarning } from '../../common'

interface MultimodalData {
  mimeType: string
  data: string
  name?: string
}

interface RotateTask {
  image_path: string
  output_path: string
  angle: number
  format?: string
}

interface ResultData {
  message?: string
  toolId?: string
  totalTasks?: number
  successCount?: number
  failedCount?: number
  cancelledCount?: number
  paths?: string[]
  originalDimensions?: { width: number; height: number }
  rotatedDimensions?: { width: number; height: number }
  angle?: number
  success?: boolean
  cancelled?: boolean
  error?: string
}

const props = defineProps<{
  args: Record<string, unknown>
  result?: Record<string, unknown>
  error?: string
  status?: 'pending' | 'running' | 'success' | 'error'
  toolId?: string
}>()

// 保存状态
const saving = ref(false)
const saveSuccess = ref(false)
const saveError = ref('')

// 终止状态
const cancelling = ref(false)

// Chat store
const chatStore = useChatStore()

// 使用依赖检查 composable
const {
  allInstalled: sharpInstalled,
  loading: checkingDependency,
  missingDependencies
} = useDependency({
  dependencies: ['sharp'],
  autoCheck: true
})

// 国际化
const { t } = useI18n()

// 获取任务信息
const images = computed(() => props.args.images as RotateTask[] | undefined)
const singleImagePath = computed(() => props.args.image_path as string | undefined)
const singleOutputPath = computed(() => props.args.output_path as string | undefined)
const singleAngle = computed(() => props.args.angle as number | undefined)
const singleFormat = computed(() => props.args.format as string | undefined)

// 判断模式
const isBatchMode = computed(() => images.value && Array.isArray(images.value) && images.value.length > 0)

// 获取任务列表
const taskList = computed<RotateTask[]>(() => {
  if (isBatchMode.value) {
    return images.value || []
  }
  if (singleImagePath.value && singleOutputPath.value && singleAngle.value !== undefined) {
    return [{
      image_path: singleImagePath.value,
      output_path: singleOutputPath.value,
      angle: singleAngle.value,
      format: singleFormat.value
    }]
  }
  return []
})

// 获取结果数据
const resultData = computed<ResultData>(() => {
  if (!props.result) return {}
  const data = props.result.data as ResultData | undefined
  return data || props.result as ResultData
})

// 获取多模态数据（旋转后的图片）
const multimodalData = computed<MultimodalData[]>(() => {
  const result = props.result as { multimodal?: MultimodalData[] } | undefined
  return result?.multimodal || []
})

// 是否失败
const isFailed = computed(() => {
  if (props.result && 'success' in props.result && props.result.success === false) {
    return true
  }
  return false
})

// 获取错误信息
const errorMessage = computed(() => {
  if (props.error) return props.error
  if (props.result && 'error' in props.result && typeof props.result.error === 'string') {
    return props.result.error
  }
  if (resultData.value.error) return resultData.value.error
  return ''
})

// 是否被取消
const isCancelled = computed(() => {
  if (resultData.value.cancelled) return true
  if (isFailed.value && errorMessage.value?.includes('终止')) return true
  return false
})

// 是否正在运行
const isRunning = computed(() => {
  if (props.error) return false
  if (isFailed.value) return false
  if (isCancelled.value) return false
  if (props.status === 'running' || props.status === 'pending') return true
  return false
})

// 工具是否可用（依赖已安装）
const isToolAvailable = computed(() => sharpInstalled.value)

// 状态标签
const statusLabel = computed(() => {
  if (!isToolAvailable.value && !checkingDependency.value) return t('components.tools.media.rotateImagePanel.status.needDependency')
  if (isCancelled.value) return t('components.tools.media.rotateImagePanel.status.cancelled')
  if (isFailed.value || props.error) return t('components.tools.media.rotateImagePanel.status.failed')
  if (props.status === 'success') return t('components.tools.media.rotateImagePanel.status.success')
  if (props.status === 'error') return t('components.tools.media.rotateImagePanel.status.error')
  if (isRunning.value) return t('components.tools.media.rotateImagePanel.status.processing')
  return t('components.tools.media.rotateImagePanel.status.waiting')
})

// 状态类名
const statusClass = computed(() => {
  if (!isToolAvailable.value && !checkingDependency.value) return 'disabled'
  if (isCancelled.value) return 'cancelled'
  if (isFailed.value || props.error || props.status === 'error') return 'error'
  if (props.status === 'success') return 'success'
  if (isRunning.value) return 'running'
  return 'pending'
})

// 保存图片到指定路径
async function saveImage(imageData: MultimodalData, path: string) {
  saving.value = true
  saveSuccess.value = false
  saveError.value = ''
  
  try {
    const result = await sendToExtension('saveImageToPath', {
      data: imageData.data,
      mimeType: imageData.mimeType,
      path: path
    }) as { success: boolean; error?: string }
    
    if (result.success) {
      saveSuccess.value = true
      setTimeout(() => {
        saveSuccess.value = false
      }, 2000)
    } else {
      saveError.value = result.error || '保存失败'
    }
  } catch (err: any) {
    saveError.value = err.message || '保存失败'
  } finally {
    saving.value = false
  }
}

// 在 VSCode 中打开图片
async function openImageInVSCode(path: string) {
  try {
    await sendToExtension('openWorkspaceFile', { path })
  } catch (err) {
    console.error('打开文件失败:', err)
  }
}

// 截断文本
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

// 格式化角度
function formatAngle(angle: number): string {
  const direction = angle >= 0 ? t('components.tools.media.rotateImagePanel.angleFormat.counterclockwise') : t('components.tools.media.rotateImagePanel.angleFormat.clockwise')
  return `${Math.abs(angle)}° ${direction}`
}

// 获取有效的 toolId
const effectiveToolId = computed(() => {
  return resultData.value.toolId || props.toolId
})

// 终止旋转
async function handleCancel() {
  if (cancelling.value) return
  
  const toolId = effectiveToolId.value
  cancelling.value = true
  
  try {
    if (toolId) {
      const result = await sendToExtension('task.cancel', { taskId: toolId }) as {
        success: boolean
        error?: string
      }
      
      if (!result.success) {
        console.warn('取消旋转失败:', result.error)
        await chatStore.cancelStream()
      }
    } else {
      await chatStore.cancelStream()
    }
  } catch (err) {
    console.error('取消旋转失败:', err)
    try {
      await chatStore.cancelStream()
    } catch {
      // 忽略
    }
  } finally {
    cancelling.value = false
  }
}

// 获取图片路径
function getImagePath(index: number): string | undefined {
  if (resultData.value.paths && resultData.value.paths[index]) {
    return resultData.value.paths[index]
  }
  return undefined
}
</script>

<template>
  <div class="rotate-panel">
    <!-- 头部信息 -->
    <div class="panel-header">
      <div class="header-info">
        <span class="codicon codicon-sync tool-icon"></span>
        <span class="title">{{ t('components.tools.media.rotateImagePanel.title') }}</span>
        <span :class="['status-badge', statusClass]">{{ statusLabel }}</span>
      </div>
      <div class="header-actions">
        <button
          v-if="isRunning"
          class="action-btn cancel-btn"
          :disabled="cancelling"
          :title="t('components.tools.media.rotateImagePanel.cancelRotate')"
          @click="handleCancel"
        >
          <span class="codicon codicon-debug-stop"></span>
          <span class="btn-text">{{ t('components.tools.media.rotateImagePanel.cancel') }}</span>
        </button>
      </div>
    </div>
    
    <!-- 依赖未安装警告 -->
    <div v-if="checkingDependency" class="dependency-check">
      <span class="spinner"></span>
      <span>{{ t('components.tools.media.rotateImagePanel.checkingDependency') }}</span>
    </div>
    
    <DependencyWarning
      v-else-if="!sharpInstalled"
      :dependencies="missingDependencies"
      :message="t('components.tools.media.rotateImagePanel.dependencyMessage')"
    />
    
    <!-- 任务信息 -->
    <div class="tasks-section">
      <div class="section-header">
        <span class="codicon codicon-list-unordered"></span>
        <span class="section-title">{{ isBatchMode ? t('components.tools.media.rotateImagePanel.batchRotate', { count: taskList.length }) : t('components.tools.media.rotateImagePanel.rotateTask') }}</span>
      </div>
      
      <div class="task-list">
        <div
          v-for="(task, index) in taskList"
          :key="index"
          class="task-item"
        >
          <div class="task-header">
            <span v-if="isBatchMode" class="task-index">{{ index + 1 }}</span>
            <span class="task-paths">{{ truncateText(task.image_path, 25) }}</span>
          </div>
          <div class="task-meta">
            <span class="meta-item angle">
              <span class="codicon codicon-sync"></span>
              <span class="meta-value">{{ formatAngle(task.angle) }}</span>
            </span>
            <span v-if="task.format" class="meta-item">
              <span class="codicon codicon-file-media"></span>
              <span class="meta-value">{{ task.format.toUpperCase() }}</span>
            </span>
            <span class="meta-item">
              <span class="codicon codicon-arrow-right"></span>
              <span class="meta-value">{{ truncateText(task.output_path, 20) }}</span>
            </span>
          </div>
        </div>
      </div>
      
      <!-- 提示说明 -->
      <div class="angle-hint">
        <span class="codicon codicon-info"></span>
        <span>{{ t('components.tools.media.rotateImagePanel.angleHint') }}</span>
      </div>
    </div>
    
    <!-- 取消信息 -->
    <div v-if="isCancelled" class="panel-cancelled">
      <span class="codicon codicon-debug-stop cancelled-icon"></span>
      <span class="cancelled-text">{{ resultData.error || t('components.tools.media.rotateImagePanel.cancelledMessage') }}</span>
    </div>
    
    <!-- 错误信息 -->
    <div v-else-if="isFailed || props.error" class="panel-error">
      <span class="codicon codicon-error error-icon"></span>
      <span class="error-text">{{ errorMessage }}</span>
    </div>
    
    <!-- 生成结果 -->
    <div v-if="multimodalData.length > 0" class="result-section">
      <div class="section-header">
        <span class="codicon codicon-preview"></span>
        <span class="section-title">{{ t('components.tools.media.rotateImagePanel.resultTitle', { count: multimodalData.length }) }}</span>
      </div>
      
      <!-- 尺寸信息 -->
      <div v-if="resultData.originalDimensions && resultData.rotatedDimensions" class="dimensions-info">
        <span class="dim-label">{{ t('components.tools.media.rotateImagePanel.dimensions.rotation') }}</span>
        <span class="dim-value">{{ resultData.angle }}°</span>
        <span class="codicon codicon-arrow-right dim-arrow"></span>
        <span class="dim-label">{{ t('components.tools.media.rotateImagePanel.dimensions.size') }}</span>
        <span class="dim-value">{{ resultData.originalDimensions.width }}×{{ resultData.originalDimensions.height }}</span>
        <span class="codicon codicon-arrow-right dim-arrow"></span>
        <span class="dim-value">{{ resultData.rotatedDimensions.width }}×{{ resultData.rotatedDimensions.height }}</span>
      </div>
      
      <div class="image-grid">
        <div
          v-for="(img, index) in multimodalData"
          :key="index"
          class="image-card"
        >
          <div class="image-wrapper">
            <img
              :src="`data:${img.mimeType};base64,${img.data}`"
              :alt="img.name || `Rotated ${index + 1}`"
              class="result-image"
            />
          </div>
          <div class="image-info">
            <span class="image-label">{{ img.name || t('components.tools.media.rotateImagePanel.rotateResultN', { n: index + 1 }) }}</span>
            <div class="image-actions">
              <button
                v-if="getImagePath(index)"
                class="action-btn"
                :disabled="saving"
                :title="saveSuccess ? t('components.tools.media.rotateImagePanel.saved') : t('components.tools.media.rotateImagePanel.overwriteSave')"
                @click="saveImage(img, getImagePath(index)!)"
              >
                <span :class="['codicon', saveSuccess ? 'codicon-check' : 'codicon-save']"></span>
                <span class="btn-text">{{ saveSuccess ? t('components.tools.media.rotateImagePanel.saved') : t('components.tools.media.rotateImagePanel.save') }}</span>
              </button>
              <button
                v-if="getImagePath(index)"
                class="action-btn"
                :title="t('components.tools.media.rotateImagePanel.openInEditor')"
                @click="openImageInVSCode(getImagePath(index)!)"
              >
                <span class="codicon codicon-go-to-file"></span>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div v-if="saveError" class="save-error">
        <span class="codicon codicon-error"></span>
        <span>{{ saveError }}</span>
      </div>
    </div>
    
    <!-- 结果摘要（无图片时显示） -->
    <div v-else-if="resultData.message && !isRunning" class="result-summary">
      <div class="summary-message">{{ resultData.message }}</div>
      <div v-if="resultData.paths && resultData.paths.length > 0" class="paths-list">
        <div class="paths-header">{{ t('components.tools.media.rotateImagePanel.savePaths') }}</div>
        <div v-for="p in resultData.paths" :key="p" class="path-item">
          <span class="codicon codicon-file-media"></span>
          <span
            class="path-text clickable"
            @click="openImageInVSCode(p)"
          >{{ p }}</span>
        </div>
      </div>
    </div>
    
    <!-- 运行中指示器 -->
    <div v-if="isRunning" class="running-indicator">
      <span class="spinner"></span>
      <span>{{ t('components.tools.media.rotateImagePanel.rotatingImages') }}</span>
    </div>
  </div>
</template>

<style scoped src="./rotate_image.css"></style>