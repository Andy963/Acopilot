<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { IconButton } from '../common'
import { useChatStore } from '../../stores'
import { sendToExtension, showNotification } from '../../utils/vscode'
import { useI18n } from '../../i18n'

interface PinnedFileItem {
  id: string
  path: string
  workspaceUri: string
  enabled: boolean
  addedAt: number
  exists?: boolean
}

interface SkillDefinition {
  id: string
  name: string
  description?: string
  prompt: string
}

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  statsChange: [enabledCount: number]
}>()

const { t } = useI18n()
const chatStore = useChatStore()

const pinnedFiles = ref<PinnedFileItem[]>([])
const showPinnedFilesPanel = computed(() => props.visible)
const isLoadingPinnedFiles = ref(false)
const isDraggingOver = ref(false)

type PinPanelTab = 'files' | 'skill' | 'custom'
const pinPanelTab = ref<PinPanelTab>('files')

const skills = ref<SkillDefinition[]>([])
const isLoadingSkills = ref(false)
const selectedSkillId = ref('')
const customPromptDraft = ref('')
const isSavingPinnedPrompt = ref(false)

const selectedSkill = computed(() => {
  return skills.value.find(s => s.id === selectedSkillId.value) || null
})

const hasPinnedPrompt = computed(() => {
  return Boolean(chatStore.pinnedPrompt?.mode && chatStore.pinnedPrompt.mode !== 'none')
})

const enabledPinnedFilesCount = computed(() => {
  return pinnedFiles.value.filter(f => f.enabled).length
})

function normalizeSkills(raw: unknown): SkillDefinition[] {
  if (!Array.isArray(raw)) return []

  return raw
    .filter((s): s is any => s && typeof s === 'object')
    .map((s: any) => ({
      id: String(s.id || '').trim(),
      name: String(s.name || '').trim(),
      description: typeof s.description === 'string' ? s.description : '',
      prompt: String(s.prompt || '')
    }))
    .filter(s => s.id && s.prompt.trim())
}

async function loadPinnedFiles() {
  isLoadingPinnedFiles.value = true
  try {
    const config = await sendToExtension<{ files: PinnedFileItem[] }>('getPinnedFilesConfig', {})
    if (config?.files) {
      pinnedFiles.value = config.files
    }
  } catch (error) {
    console.error('Failed to load pinned files:', error)
  } finally {
    isLoadingPinnedFiles.value = false
  }
}

async function loadSkills() {
  isLoadingSkills.value = true
  try {
    const result = await sendToExtension<any>('getSystemPromptConfig', {})
    skills.value = normalizeSkills(result?.skills)
  } catch (error) {
    console.error('Failed to load skills:', error)
    skills.value = []
  } finally {
    isLoadingSkills.value = false
  }
}

function syncPinnedPromptDraftFromStore() {
  selectedSkillId.value = String(chatStore.pinnedPrompt?.skillId || '').trim()
  customPromptDraft.value = String(chatStore.pinnedPrompt?.customPrompt || '')
}

async function applySkillSelection() {
  const skillId = selectedSkillId.value.trim()
  await chatStore.setPinnedPrompt({
    mode: skillId ? 'skill' : 'none',
    skillId: skillId || undefined,
    customPrompt: chatStore.pinnedPrompt?.customPrompt
  })
}

async function saveCustomPrompt() {
  const text = customPromptDraft.value
  const enabled = Boolean(text && text.trim())

  isSavingPinnedPrompt.value = true
  try {
    await chatStore.setPinnedPrompt({
      mode: enabled ? 'custom' : 'none',
      skillId: chatStore.pinnedPrompt?.skillId,
      customPrompt: text
    })
  } finally {
    isSavingPinnedPrompt.value = false
  }
}

async function clearCustomPrompt() {
  customPromptDraft.value = ''
  await chatStore.setPinnedPrompt({
    mode: 'none',
    skillId: chatStore.pinnedPrompt?.skillId,
    customPrompt: ''
  })
}

function getErrorMessageByCode(errorCode?: string, defaultError?: string): string {
  switch (errorCode) {
    case 'NOT_IN_ANY_WORKSPACE':
      return t('components.input.notifications.fileNotInAnyWorkspace')
    case 'NOT_IN_CURRENT_WORKSPACE':
      return defaultError || t('components.input.notifications.fileNotInWorkspace')
    case 'NO_WORKSPACE':
    case 'WORKSPACE_NOT_FOUND':
    case 'INVALID_URI':
    case 'NOT_FILE':
    case 'FILE_NOT_EXISTS':
    default:
      return defaultError || t('components.input.notifications.fileNotInWorkspace')
  }
}

async function checkPinnedFilesExistence() {
  if (pinnedFiles.value.length === 0) return

  try {
    const result = await sendToExtension<{ files: Array<{ id: string; exists: boolean }> }>(
      'checkPinnedFilesExistence',
      { files: pinnedFiles.value.map(f => ({ id: f.id, path: f.path })) }
    )

    if (result?.files) {
      for (const fileResult of result.files) {
        const file = pinnedFiles.value.find(f => f.id === fileResult.id)
        if (file) {
          file.exists = fileResult.exists
        }
      }
    }
  } catch (error) {
    console.error('Failed to check pinned files existence:', error)
  }
}

function handleDragEnter(e: DragEvent) {
  if (pinPanelTab.value !== 'files') return
  if (!e.shiftKey) return

  e.preventDefault()
  e.stopPropagation()
  isDraggingOver.value = true
}

function handleDragOver(e: DragEvent) {
  if (pinPanelTab.value !== 'files') return
  if (!e.shiftKey) {
    isDraggingOver.value = false
    return
  }

  e.preventDefault()
  e.stopPropagation()
  isDraggingOver.value = true
}

function handleDragLeave(e: DragEvent) {
  if (pinPanelTab.value !== 'files') return
  e.preventDefault()
  e.stopPropagation()

  const target = e.currentTarget as HTMLElement
  const related = e.relatedTarget as HTMLElement
  if (target && related && target.contains(related)) {
    return
  }

  isDraggingOver.value = false
}

async function handleDrop(e: DragEvent) {
  if (pinPanelTab.value !== 'files') return
  e.preventDefault()
  e.stopPropagation()
  isDraggingOver.value = false

  if (!e.shiftKey) {
    await showNotification(t('components.input.notifications.holdShiftToDrag'), 'warning')
    return
  }

  const vscodeUriList = e.dataTransfer?.getData('application/vnd.code.uri-list')
  const resourceUrls = e.dataTransfer?.getData('resourceurls')
  const codeEditors = e.dataTransfer?.getData('codeeditors')
  const textUriList = e.dataTransfer?.getData('text/uri-list')
  const textPlain = e.dataTransfer?.getData('text/plain')

  let urisToProcess: string[] = []

  if (vscodeUriList) {
    urisToProcess = vscodeUriList.split('\n').filter(uri => uri.trim() && uri.startsWith('file://'))
  }

  if (urisToProcess.length === 0 && resourceUrls) {
    try {
      const parsed = JSON.parse(resourceUrls)
      if (Array.isArray(parsed)) {
        urisToProcess = parsed.filter((uri: string) => typeof uri === 'string' && uri.startsWith('file://'))
      }
    } catch {
      // ignore
    }
  }

  if (urisToProcess.length === 0 && codeEditors) {
    try {
      const parsed = JSON.parse(codeEditors)
      if (Array.isArray(parsed)) {
        for (const editor of parsed) {
          if (editor.resource?.external && typeof editor.resource.external === 'string') {
            urisToProcess.push(editor.resource.external)
          }
        }
      }
    } catch {
      // ignore
    }
  }

  if (urisToProcess.length === 0 && textUriList) {
    urisToProcess = textUriList.split('\n').filter(uri => uri.trim() && !uri.startsWith('#'))
  }

  if (urisToProcess.length === 0 && textPlain && textPlain.startsWith('file://')) {
    urisToProcess = textPlain.split('\n').filter(uri => uri.trim() && uri.startsWith('file://'))
  }

  if (urisToProcess.length > 0) {
    for (const uri of urisToProcess) {
      try {
        const trimmedUri = uri.trim()

        const validation = await sendToExtension<{
          valid: boolean
          relativePath?: string
          workspaceUri?: string
          error?: string
          errorCode?: string
        }>(
          'validatePinnedFile',
          { path: trimmedUri }
        )

        if (!validation?.valid) {
          const errorMessage = getErrorMessageByCode(validation?.errorCode, validation?.error)
          await showNotification(errorMessage, 'error')
          continue
        }

        const addResult = await sendToExtension<{
          success: boolean
          file?: PinnedFileItem
          error?: string
          errorCode?: string
        }>(
          'addPinnedFile',
          { path: validation.relativePath, workspaceUri: validation.workspaceUri }
        )

        if (addResult?.success && addResult.file) {
          pinnedFiles.value.push(addResult.file)
          await showNotification(t('components.input.notifications.fileAdded', { path: validation.relativePath }), 'info')
        } else if (!addResult?.success) {
          const errorMessage = getErrorMessageByCode(addResult?.errorCode, addResult?.error)
          await showNotification(errorMessage, 'error')
        }
      } catch (error: any) {
        console.error('Failed to add pinned file:', error)
        await showNotification(t('components.input.notifications.addFailed', { error: error.message || t('common.unknownError') }), 'error')
      }
    }
    return
  }

  const files = e.dataTransfer?.files
  if (!files || files.length === 0) {
    await showNotification(t('components.input.notifications.cannotGetFilePath'), 'warning')
    return
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i]

    try {
      const validation = await sendToExtension<{
        valid: boolean
        relativePath?: string
        workspaceUri?: string
        error?: string
        errorCode?: string
      }>(
        'validatePinnedFile',
        { path: file.name }
      )

      if (!validation?.valid) {
        const errorMessage = getErrorMessageByCode(validation?.errorCode, validation?.error)
        await showNotification(errorMessage, 'error')
        continue
      }

      const addResult = await sendToExtension<{
        success: boolean
        file?: PinnedFileItem
        error?: string
        errorCode?: string
      }>(
        'addPinnedFile',
        { path: validation.relativePath, workspaceUri: validation.workspaceUri }
      )

      if (addResult?.success && addResult.file) {
        pinnedFiles.value.push(addResult.file)
        await showNotification(t('components.input.notifications.fileAdded', { path: validation.relativePath }), 'info')
      } else if (!addResult?.success) {
        const errorMessage = getErrorMessageByCode(addResult?.errorCode, addResult?.error)
        await showNotification(errorMessage, 'error')
      }
    } catch (error: any) {
      console.error('Failed to add pinned file:', error)
      await showNotification(t('components.input.notifications.addFailed', { error: error.message || t('common.unknownError') }), 'error')
    }
  }
}

async function handleRemovePinnedFile(id: string) {
  try {
    await sendToExtension('removePinnedFile', { id })
    pinnedFiles.value = pinnedFiles.value.filter(f => f.id !== id)
  } catch (error: any) {
    console.error('Failed to remove pinned file:', error)
    await showNotification(t('components.input.notifications.removeFailed', { error: error.message || t('common.unknownError') }), 'error')
  }
}

async function handleTogglePinnedFile(id: string, enabled: boolean) {
  try {
    await sendToExtension('setPinnedFileEnabled', { id, enabled })
    const file = pinnedFiles.value.find(f => f.id === id)
    if (file) {
      file.enabled = enabled
    }
  } catch (error: any) {
    console.error('Failed to toggle pinned file:', error)
  }
}

async function openPanel() {
  syncPinnedPromptDraftFromStore()
  pinPanelTab.value = chatStore.pinnedPrompt?.mode === 'skill'
    ? 'skill'
    : chatStore.pinnedPrompt?.mode === 'custom'
      ? 'custom'
      : 'files'

  await loadPinnedFiles()
  await checkPinnedFilesExistence()
  await loadSkills()
  emitStats()
}

function emitClose() {
  emit('close')
}

function emitStats() {
  emit('statsChange', enabledPinnedFilesCount.value)
}

watch(showPinnedFilesPanel, (visible) => {
  if (visible) {
    openPanel()
  }
})

watch(enabledPinnedFilesCount, () => {
  emitStats()
})

watch(pinPanelTab, (tab) => {
  if (tab !== 'files') {
    isDraggingOver.value = false
  }
})

defineExpose({
  enabledPinnedFilesCount,
  hasPinnedPrompt,
  openPanel
})
</script>

<template>
  <div
    v-if="showPinnedFilesPanel"
    class="pinned-files-panel"
    :class="{ 'drag-over': isDraggingOver }"
    @dragenter="handleDragEnter"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <div class="pinned-files-header">
      <span class="pinned-files-title">
        <i class="codicon codicon-pin"></i>
        {{ t('components.input.pinnedFilesPanel.title') }}
      </span>
      <IconButton
        icon="codicon-close"
        size="small"
        @click="emitClose"
      />
    </div>
    <div class="pinned-files-description">
      {{ t('components.input.pinnedFilesPanel.description') }}
    </div>

    <div class="pinned-panel-tabs">
      <button
        class="pinned-tab"
        :class="{ active: pinPanelTab === 'files' }"
        @click="pinPanelTab = 'files'"
      >
        {{ t('components.input.pinnedFilesPanel.tabs.files') }}
      </button>
      <button
        class="pinned-tab"
        :class="{ active: pinPanelTab === 'skill' }"
        @click="pinPanelTab = 'skill'"
      >
        {{ t('components.input.pinnedFilesPanel.tabs.skill') }}
      </button>
      <button
        class="pinned-tab"
        :class="{ active: pinPanelTab === 'custom' }"
        @click="pinPanelTab = 'custom'"
      >
        {{ t('components.input.pinnedFilesPanel.tabs.custom') }}
      </button>
    </div>

    <div v-if="pinPanelTab === 'files'" class="pinned-files-content">
      <div v-if="isLoadingPinnedFiles" class="pinned-files-loading">
        <i class="codicon codicon-loading codicon-modifier-spin"></i>
        <span>{{ t('components.input.pinnedFilesPanel.loading') }}</span>
      </div>
      <div v-else-if="pinnedFiles.length === 0" class="pinned-files-empty">
        <i class="codicon codicon-info"></i>
        <span>{{ t('components.input.pinnedFilesPanel.empty') }}</span>
      </div>
      <div v-else class="pinned-files-list">
        <div
          v-for="file in pinnedFiles"
          :key="file.id"
          class="pinned-file-item"
          :class="{ disabled: !file.enabled, 'not-exists': file.exists === false }"
        >
          <input
            type="checkbox"
            :checked="file.enabled"
            @change="handleTogglePinnedFile(file.id, !file.enabled)"
            class="pinned-file-checkbox"
            :disabled="file.exists === false"
          />
          <i :class="['codicon', file.exists === false ? 'codicon-warning' : 'codicon-file-text']"></i>
          <span class="pinned-file-path" :title="file.exists === false ? `${t('components.input.fileNotExists')}: ${file.path}` : file.path">
            {{ file.path }}
          </span>
          <span v-if="file.exists === false" class="file-not-exists-hint">{{ t('components.input.pinnedFilesPanel.notExists') }}</span>
          <IconButton
            icon="codicon-close"
            size="small"
            @click="handleRemovePinnedFile(file.id)"
            :title="t('components.input.remove')"
          />
        </div>
      </div>
    </div>

    <div v-else-if="pinPanelTab === 'skill'" class="pinned-skill-content">
      <div class="pinned-skill-row">
        <label class="pinned-skill-label">{{ t('components.input.pinnedFilesPanel.skill.selectLabel') }}</label>
        <select
          v-model="selectedSkillId"
          class="pinned-skill-select"
          :disabled="isLoadingSkills"
          @change="applySkillSelection"
        >
          <option value="">{{ t('common.none') }}</option>
          <option v-for="skill in skills" :key="skill.id" :value="skill.id">
            {{ skill.name || skill.id }}
          </option>
        </select>
        <button class="pinned-skill-refresh" :disabled="isLoadingSkills" @click="loadSkills" :title="t('common.refresh')">
          <i class="codicon" :class="isLoadingSkills ? 'codicon-loading codicon-modifier-spin' : 'codicon-refresh'"></i>
        </button>
      </div>

      <div v-if="isLoadingSkills" class="pinned-files-loading">
        <i class="codicon codicon-loading codicon-modifier-spin"></i>
        <span>{{ t('components.input.pinnedFilesPanel.skill.loading') }}</span>
      </div>
      <div v-else-if="skills.length === 0" class="pinned-files-empty">
        <i class="codicon codicon-info"></i>
        <span>{{ t('components.input.pinnedFilesPanel.skill.empty') }}</span>
      </div>

      <div v-else class="pinned-skill-preview">
        <div v-if="selectedSkill" class="pinned-skill-preview-inner">
          <div class="pinned-skill-preview-title">
            <i v-if="chatStore.pinnedPrompt?.mode === 'skill' && chatStore.pinnedPrompt?.skillId === selectedSkill.id" class="codicon codicon-check"></i>
            <span>{{ selectedSkill.name || selectedSkill.id }}</span>
          </div>
          <div v-if="selectedSkill.description" class="pinned-skill-preview-desc" :title="selectedSkill.description">
            {{ selectedSkill.description }}
          </div>
          <textarea class="pinned-skill-preview-text" readonly :value="selectedSkill.prompt"></textarea>
        </div>
        <div v-else class="pinned-skill-hint">
          <i class="codicon codicon-info"></i>
          <span>{{ t('components.input.pinnedFilesPanel.skill.pickOne') }}</span>
        </div>
      </div>

      <div class="pinned-skill-footer-hint">
        {{ t('components.input.pinnedFilesPanel.skill.manageHint') }}
      </div>
    </div>

    <div v-else class="pinned-custom-content">
      <div class="pinned-custom-row">
        <label class="pinned-custom-label">{{ t('components.input.pinnedFilesPanel.custom.label') }}</label>
      </div>
      <textarea
        v-model="customPromptDraft"
        class="pinned-custom-textarea"
        rows="7"
        :placeholder="t('components.input.pinnedFilesPanel.custom.placeholder')"
      ></textarea>
      <div class="pinned-custom-actions">
        <button class="pinned-custom-save" @click="saveCustomPrompt" :disabled="isSavingPinnedPrompt">
          <i v-if="isSavingPinnedPrompt" class="codicon codicon-loading codicon-modifier-spin"></i>
          <span v-else>{{ t('components.input.pinnedFilesPanel.custom.save') }}</span>
        </button>
        <button class="pinned-custom-clear" @click="clearCustomPrompt" :disabled="isSavingPinnedPrompt">
          {{ t('components.input.pinnedFilesPanel.custom.clear') }}
        </button>
      </div>
      <div class="pinned-custom-hint">
        {{ t('components.input.pinnedFilesPanel.custom.hint') }}
      </div>
    </div>

    <div v-if="pinPanelTab === 'files'" class="pinned-files-footer">
      <div class="drag-hint">
        <i class="codicon codicon-info"></i>
        <span>{{ t('components.input.pinnedFilesPanel.dragHint') }}</span>
      </div>
    </div>
    <div v-if="pinPanelTab === 'files' && isDraggingOver" class="drag-overlay">
      <i class="codicon codicon-cloud-upload"></i>
      <span>{{ t('components.input.pinnedFilesPanel.dropHint') }}</span>
    </div>
  </div>
</template>

<style scoped>
.pinned-files-panel {
  position: absolute;
  bottom: 100%;
  left: 8px;
  right: 8px;
  margin-bottom: 8px;
  background: var(--vscode-editorWidget-background);
  border: 1px solid var(--vscode-editorWidget-border);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
  max-height: 360px;
  display: flex;
  flex-direction: column;
}

.pinned-files-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--vscode-panel-border);
}

.pinned-files-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
}

.pinned-files-title .codicon {
  font-size: 14px;
  transform: rotate(-90deg);
}

.pinned-files-description {
  padding: 6px 12px;
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  border-bottom: 1px solid var(--vscode-panel-border);
}

.pinned-panel-tabs {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--vscode-panel-border);
}

.pinned-tab {
  padding: 3px 10px;
  font-size: 12px;
  line-height: 18px;
  border-radius: 999px;
  border: 1px solid var(--vscode-panel-border);
  background: transparent;
  color: var(--vscode-foreground);
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s, color 0.15s;
}

.pinned-tab:hover {
  background: var(--vscode-toolbar-hoverBackground);
}

.pinned-tab.active {
  background: var(--vscode-button-background);
  border-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.pinned-files-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.pinned-files-loading,
.pinned-files-empty {
  padding: 16px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.pinned-files-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px 12px;
}

.pinned-file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
  font-size: 12px;
}

.pinned-file-item.disabled {
  opacity: 0.6;
}

.pinned-file-item.not-exists {
  border-color: var(--vscode-errorForeground);
}

.pinned-file-checkbox {
  margin: 0;
}

.pinned-file-path {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-not-exists-hint {
  font-size: 11px;
  color: var(--vscode-errorForeground);
}

.pinned-skill-content,
.pinned-custom-content {
  padding: 10px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pinned-skill-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pinned-skill-label,
.pinned-custom-label {
  font-size: 12px;
}

.pinned-skill-select {
  flex: 1;
  min-width: 0;
}

.pinned-skill-refresh {
  border: none;
  background: transparent;
  cursor: pointer;
}

.pinned-skill-preview {
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
  padding: 8px;
  font-size: 12px;
}

.pinned-skill-preview-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  margin-bottom: 6px;
}

.pinned-skill-preview-desc {
  font-size: 11px;
  opacity: 0.75;
  margin-bottom: 6px;
}

.pinned-skill-preview-text {
  width: 100%;
  min-height: 120px;
  resize: vertical;
  background: transparent;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  padding: 6px;
  font-size: 11px;
}

.pinned-skill-footer-hint,
.pinned-custom-hint {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}

.pinned-custom-textarea {
  width: 100%;
  resize: vertical;
  background: transparent;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  padding: 6px;
  font-size: 12px;
}

.pinned-custom-actions {
  display: flex;
  gap: 8px;
}

.pinned-custom-save,
.pinned-custom-clear {
  border: none;
  background: transparent;
  color: var(--vscode-textLink-foreground);
  cursor: pointer;
}

.pinned-files-footer {
  padding: 8px 12px 12px;
  border-top: 1px solid var(--vscode-panel-border);
}

.drag-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}

.drag-hint .codicon {
  font-size: 12px;
}

.pinned-files-panel.drag-over {
  border-color: var(--vscode-textLink-foreground);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--vscode-textLink-foreground) 30%, transparent);
}

.drag-overlay {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 80%, transparent);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  color: var(--vscode-textLink-foreground);
}

.drag-overlay .codicon {
  font-size: 22px;
}

.drag-overlay span {
  font-size: 11px;
}
</style>
