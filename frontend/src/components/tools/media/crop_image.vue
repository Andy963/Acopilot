<script setup lang="ts">
/**
 * crop_image 工具的内容面板
 *
 * 显示：
 * - 依赖状态检查（sharp）
 * - 裁切任务信息（坐标、路径）
 * - 处理进度
 * - 裁切结果图片
 * - 保存按钮
 * - 终止按钮
 */

import { computed, ref } from 'vue'
import { sendToExtension } from '../../../utils/vscode'
import { useChatStore } from '../../../stores/chatStore'
import { useDependency } from '../../../composables/useDependency'
import { DependencyWarning } from '../../common'
import { useI18n } from '../../../composables/useI18n'

const { t } = useI18n()

interface MultimodalData {
  mimeType: string
  data: string
  name?: string
}

interface CropTask {
  image_path: string
  output_path: string
  x1: number
  y1: number
  x2: number
  y2: number
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
  croppedDimensions?: { width: number; height: number }
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

// 获取任务信息
const images = computed(() => props.args.images as CropTask[] | undefined)
const singleImagePath = computed(() => props.args.image_path as string | undefined)
const singleOutputPath = computed(() => props.args.output_path as string | undefined)
const singleX1 = computed(() => props.args.x1 as number | undefined)
const singleY1 = computed(() => props.args.y1 as number | undefined)
const singleX2 = computed(() => props.args.x2 as number | undefined)
const singleY2 = computed(() => props.args.y2 as number | undefined)

// 判断模式
const isBatchMode = computed(() => images.value && Array.isArray(images.value) && images.value.length > 0)

// 获取任务列表
const taskList = computed<CropTask[]>(() => {
  if (isBatchMode.value) {
    return images.value || []
  }
  if (singleImagePath.value && singleOutputPath.value &&
      singleX1.value !== undefined && singleY1.value !== undefined &&
      singleX2.value !== undefined && singleY2.value !== undefined) {
    return [{
      image_path: singleImagePath.value,
      output_path: singleOutputPath.value,
      x1: singleX1.value,
      y1: singleY1.value,
      x2: singleX2.value,
      y2: singleY2.value
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

// 获取多模态数据（裁切后的图片）
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
  if (!isToolAvailable.value && !checkingDependency.value) return t('components.tools.media.cropImagePanel.status.needDependency')
  if (isCancelled.value) return t('components.tools.media.cropImagePanel.status.cancelled')
  if (isFailed.value || props.error) return t('components.tools.media.cropImagePanel.status.failed')
  if (props.status === 'success') return t('components.tools.media.cropImagePanel.status.success')
  if (props.status === 'error') return t('components.tools.media.cropImagePanel.status.error')
  if (isRunning.value) return t('components.tools.media.cropImagePanel.status.processing')
  return t('components.tools.media.cropImagePanel.status.waiting')
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
      saveError.value = result.error || t('components.tools.media.cropImagePanel.saveFailed')
    }
  } catch (err: any) {
    saveError.value = err.message || t('components.tools.media.cropImagePanel.saveFailed')
  } finally {
    saving.value = false
  }
}

// 在 VSCode 中打开图片
async function openImageInVSCode(path: string) {
  try {
    await sendToExtension('openWorkspaceFile', { path })
  } catch (err) {
    console.error(t('components.tools.media.cropImagePanel.openFileFailed'), err)
  }
}

// 截断文本
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

// 格式化坐标
function formatCoords(x1: number, y1: number, x2: number, y2: number): string {
  return `(${x1},${y1}) → (${x2},${y2})`
}

// 获取有效的 toolId
const effectiveToolId = computed(() => {
  return resultData.value.toolId || props.toolId
})

// 终止裁切
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
        console.warn('取消裁切失败:', result.error)
        await chatStore.cancelStream()
      }
    } else {
      await chatStore.cancelStream()
    }
  } catch (err) {
    console.error('取消裁切失败:', err)
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
  <div class="crop-panel">
    <!-- 头部信息 -->
    <div class="panel-header">
      <div class="header-info">
        <span class="codicon codicon-selection tool-icon"></span>
        <span class="title">{{ t('components.tools.media.cropImagePanel.title') }}</span>
        <span :class="['status-badge', statusClass]">{{ statusLabel }}</span>
      </div>
      <div class="header-actions">
        <button
          v-if="isRunning"
          class="action-btn cancel-btn"
          :disabled="cancelling"
          :title="t('components.tools.media.cropImagePanel.cancelCrop')"
          @click="handleCancel"
        >
          <span class="codicon codicon-debug-stop"></span>
          <span class="btn-text">{{ t('components.tools.media.cropImagePanel.cancel') }}</span>
        </button>
      </div>
    </div>
    
    <!-- 依赖未安装警告 -->
    <div v-if="checkingDependency" class="dependency-check">
      <span class="spinner"></span>
      <span>{{ t('components.tools.media.cropImagePanel.checkingDependency') }}</span>
    </div>
    
    <DependencyWarning
      v-else-if="!sharpInstalled"
      :dependencies="missingDependencies"
      :message="t('components.tools.media.cropImagePanel.dependencyMessage')"
    />
    
    <!-- 任务信息 -->
    <div class="tasks-section">
      <div class="section-header">
        <span class="codicon codicon-list-unordered"></span>
        <span class="section-title">{{ isBatchMode ? t('components.tools.media.cropImagePanel.batchCrop', { count: taskList.length }) : t('components.tools.media.cropImagePanel.cropTask') }}</span>
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
            <span class="meta-item coords">
              <span class="codicon codicon-symbol-ruler"></span>
              <span class="meta-value">{{ formatCoords(task.x1, task.y1, task.x2, task.y2) }}</span>
            </span>
            <span class="meta-item">
              <span class="codicon codicon-arrow-right"></span>
              <span class="meta-value">{{ truncateText(task.output_path, 20) }}</span>
            </span>
          </div>
        </div>
      </div>
      
      <!-- 坐标说明 -->
      <div class="coords-hint">
        <span class="codicon codicon-info"></span>
        <span>{{ t('components.tools.media.cropImagePanel.coordsHint') }}</span>
      </div>
    </div>
    
    <!-- 取消信息 -->
    <div v-if="isCancelled" class="panel-cancelled">
      <span class="codicon codicon-debug-stop cancelled-icon"></span>
      <span class="cancelled-text">{{ resultData.error || t('components.tools.media.cropImagePanel.cancelledMessage') }}</span>
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
        <span class="section-title">{{ t('components.tools.media.cropImagePanel.resultTitle', { count: multimodalData.length }) }}</span>
      </div>
      
      <!-- 尺寸信息 -->
      <div v-if="resultData.originalDimensions && resultData.croppedDimensions" class="dimensions-info">
        <span class="dim-label">{{ t('components.tools.media.cropImagePanel.original') }}</span>
        <span class="dim-value">{{ resultData.originalDimensions.width }}×{{ resultData.originalDimensions.height }}</span>
        <span class="codicon codicon-arrow-right dim-arrow"></span>
        <span class="dim-label">{{ t('components.tools.media.cropImagePanel.cropped') }}</span>
        <span class="dim-value">{{ resultData.croppedDimensions.width }}×{{ resultData.croppedDimensions.height }}</span>
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
              :alt="img.name || `Cropped ${index + 1}`"
              class="result-image"
            />
          </div>
          <div class="image-info">
            <span class="image-label">{{ img.name || t('components.tools.media.cropImagePanel.cropResultN', { n: index + 1 }) }}</span>
            <div class="image-actions">
              <button
                v-if="getImagePath(index)"
                class="action-btn"
                :disabled="saving"
                :title="saveSuccess ? t('components.tools.media.cropImagePanel.saved') : t('components.tools.media.cropImagePanel.overwriteSave')"
                @click="saveImage(img, getImagePath(index)!)"
              >
                <span :class="['codicon', saveSuccess ? 'codicon-check' : 'codicon-save']"></span>
                <span class="btn-text">{{ saveSuccess ? t('components.tools.media.cropImagePanel.saved') : t('components.tools.media.cropImagePanel.save') }}</span>
              </button>
              <button
                v-if="getImagePath(index)"
                class="action-btn"
                :title="t('components.tools.media.cropImagePanel.openInEditor')"
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
        <div class="paths-header">{{ t('components.tools.media.cropImagePanel.savePaths') }}</div>
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
      <span>{{ t('components.tools.media.cropImagePanel.croppingImages') }}</span>
    </div>
  </div>
</template>

<style scoped src="./crop_image.css"></style>