<script setup lang="ts">
import { computed } from 'vue'
import { IconButton, Tooltip } from '../common'
import { sendToExtension } from '../../utils/vscode'
import { formatFileSize } from '../../utils/file'
import { useI18n } from '../../i18n'
import type { Attachment } from '../../types'
import type { SelectionReference } from '../../stores/chat/types'

const props = defineProps<{
  uploading?: boolean
  attachments?: Attachment[]
  enabledPinnedFilesCount: number
  hasPinnedPrompt: boolean
  selectionReferences: SelectionReference[]
}>()

const emit = defineEmits<{
  attachFile: []
  removeAttachment: [id: string]
  removeSelectionReference: [id: string]
  openPinnedPanel: []
  openTaskModal: []
  openPlanModal: []
}>()

const { t } = useI18n()
const selectionReferences = computed((): SelectionReference[] => {
  return Array.isArray(props.selectionReferences) ? props.selectionReferences : []
})

const selectionReferencesCount = computed(() => selectionReferences.value.length)
const hasAttachments = computed(() => props.attachments && props.attachments.length > 0)

function emitAttachFile() {
  emit('attachFile')
}

function emitOpenPinnedPanel() {
  emit('openPinnedPanel')
}

function emitOpenTaskModal() {
  emit('openTaskModal')
}

function emitOpenPlanModal() {
  emit('openPlanModal')
}

function emitRemoveAttachment(id: string) {
  emit('removeAttachment', id)
}

function getBasenameFromPath(inputPath: string): string {
  const path = String(inputPath || '').trim()
  if (!path) return ''

  const parts = path.split(/[/\\]+/).filter(Boolean)
  return parts.length > 0 ? parts[parts.length - 1] : path
}

async function openSelectionReference(selection: SelectionReference) {
  const path = String(selection?.path || '').trim()
  const line = Number(selection?.startLine)
  if (!path || !Number.isFinite(line) || line <= 0) return

  try {
    await sendToExtension('openWorkspaceFileAtLocation', {
      path,
      line,
      column: 1
    })
  } catch (error) {
    console.error('Failed to open selection reference:', error)
  }
}

async function removeSelectionReference(id: string) {
  emit('removeSelectionReference', id)
}

function getAttachmentIconClass(type: string): string {
  if (type === 'image') return 'codicon-file-media'
  if (type === 'video') return 'codicon-device-camera-video'
  if (type === 'audio') return 'codicon-unmute'
  if (type === 'code') return 'codicon-file-code'
  return 'codicon-file'
}

async function previewAttachment(attachment: Attachment) {
  if (!attachment.data) return

  try {
    await sendToExtension('previewAttachment', {
      name: attachment.name,
      mimeType: attachment.mimeType,
      data: attachment.data
    })
  } catch (error) {
    console.error('Failed to preview attachment:', error)
  }
}

</script>

<template>
  <div class="composer-top">
    <Tooltip :content="t('components.input.attachFile')" placement="top-left">
      <IconButton
        icon="codicon-attach"
        size="small"
        :disabled="uploading"
        class="attach-button"
        :aria-label="t('components.input.attachFile')"
        @click="emitAttachFile"
      />
    </Tooltip>
    <Tooltip :content="t('components.input.pinnedFiles')" placement="top">
      <div class="pinned-files-button-wrapper">
        <IconButton
          icon="codicon-pin"
          size="small"
          :class="{ 'has-files': props.enabledPinnedFilesCount > 0, 'has-prompt': props.hasPinnedPrompt }"
          class="pinned-files-button"
          :aria-label="t('components.input.pinnedFiles')"
          @click="emitOpenPinnedPanel"
        />
        <span v-if="props.enabledPinnedFilesCount > 0" class="pinned-files-badge">
          {{ props.enabledPinnedFilesCount }}
        </span>
      </div>
    </Tooltip>

    <Tooltip content="Create Task" placement="top">
      <IconButton
        icon="codicon-add"
        size="small"
        class="create-task-button"
        aria-label="Create Task"
        @click="emitOpenTaskModal"
      />
    </Tooltip>

    <Tooltip :content="t('components.input.createPlan')" placement="top">
      <IconButton
        icon="codicon-list-ordered"
        size="small"
        class="create-task-button"
        :aria-label="t('components.input.createPlan')"
        @click="emitOpenPlanModal"
      />
    </Tooltip>

    <div v-if="hasAttachments || selectionReferencesCount > 0" class="attachments-list">
      <div
        v-for="r in selectionReferences"
        :key="r.id"
        class="attachment-item reference-chip"
        :title="`${r.path}#L${r.startLine}-L${r.endLine}`"
        @click="openSelectionReference(r)"
      >
        <i class="codicon codicon-references attachment-icon reference-chip-icon"></i>
        <code class="reference-chip-text">{{ getBasenameFromPath(r.path) }}#L{{ r.startLine }}-L{{ r.endLine }}</code>
        <span v-if="r.truncated" class="reference-truncated">{{ t('components.input.pinnedFilesPanel.refs.truncated') }}</span>
        <IconButton
          icon="codicon-close"
          size="small"
          :disabled="uploading"
          @click.stop="removeSelectionReference(r.id)"
          :title="t('components.input.remove')"
        />
      </div>

      <div
        v-for="attachment in attachments"
        :key="attachment.id"
        class="attachment-item"
        :title="attachment.name"
      >
        <img
          v-if="attachment.type === 'image' && attachment.thumbnail"
          :src="attachment.thumbnail"
          :alt="attachment.name"
          class="attachment-preview clickable"
          @click="previewAttachment(attachment)"
          :title="`${attachment.name} · ${t('components.input.clickToPreview')}`"
        />
        <div
          v-else-if="attachment.type === 'video' && attachment.thumbnail"
          class="media-preview-wrapper clickable"
          @click="previewAttachment(attachment)"
          :title="`${attachment.name} · ${t('components.input.clickToPreview')}`"
        >
          <img
            :src="attachment.thumbnail"
            :alt="attachment.name"
            class="attachment-preview"
          />
          <i class="codicon codicon-play media-overlay-icon"></i>
        </div>
        <div
          v-else-if="attachment.type === 'audio'"
          class="media-preview-wrapper audio-placeholder clickable"
          @click="previewAttachment(attachment)"
          :title="`${attachment.name} · ${t('components.input.clickToPreview')}`"
        >
          <i class="codicon codicon-unmute media-center-icon"></i>
        </div>
        <i
          v-else
          :class="['codicon', getAttachmentIconClass(attachment.type), 'attachment-icon']"
        ></i>
        <span class="attachment-name">{{ attachment.name }}</span>
        <span class="attachment-size">{{ formatFileSize(attachment.size) }}</span>
        <IconButton
          icon="codicon-close"
          size="small"
          :disabled="uploading"
          @click="emitRemoveAttachment(attachment.id)"
          :title="t('components.input.remove')"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.composer-top {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 6px;
  min-width: 0;
  flex-wrap: nowrap;
}

.attachments-list {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  padding: 0;
  overflow-x: auto;
  overflow-y: hidden;
  flex-wrap: nowrap;
}

.reference-truncated {
  font-size: 11px;
  opacity: 0.75;
  flex-shrink: 0;
}

.attachment-item.reference-chip {
  max-width: 360px;
  cursor: pointer;
}

.attachment-icon.reference-chip-icon {
  font-size: 12px;
  opacity: 0.7;
}

.reference-chip-text {
  flex: 0 1 auto;
  font-size: 12px;
  color: inherit;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 260px;
  min-width: 0;
}

.attachment-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  background: var(--vscode-badge-background);
  color: var(--vscode-badge-foreground);
  border-radius: 999px;
  max-width: 220px;
  border: 1px solid var(--vscode-input-border);
  transition: opacity var(--transition-fast, 0.1s);
  min-width: 0;
}

.attachment-item:hover {
  opacity: 0.9;
}

.attachment-icon {
  font-size: 14px;
  flex-shrink: 0;
  opacity: 0.7;
}

.attachment-preview {
  width: 18px;
  height: 18px;
  object-fit: cover;
  border-radius: 3px;
  flex-shrink: 0;
}

.clickable {
  cursor: pointer;
  transition: opacity 0.15s, transform 0.15s;
}

.clickable:hover {
  opacity: 0.8;
  transform: scale(1.05);
}

.media-preview-wrapper {
  position: relative;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border-radius: 3px;
  overflow: hidden;
}

.media-preview-wrapper .attachment-preview {
  width: 100%;
  height: 100%;
}

.audio-placeholder {
  background: linear-gradient(135deg, #3a3d41, #2d2d30);
  display: flex;
  align-items: center;
  justify-content: center;
}

.media-overlay-icon {
  position: absolute;
  bottom: 2px;
  right: 2px;
  font-size: 9px;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  pointer-events: none;
}

.media-center-icon {
  font-size: 14px;
  color: inherit;
  opacity: 0.8;
}

.attachment-name {
  flex: 0 1 auto;
  font-size: 12px;
  color: inherit;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 140px;
  min-width: 0;
}

.attachment-size {
  display: none;
}

.attachment-item :deep(.icon-button.small) {
  width: 18px;
  height: 18px;
  font-size: 11px;
}

.attachment-item :deep(.icon-button.default) {
  color: inherit;
  opacity: 0.75;
}

.attachment-item :deep(.icon-button.default:hover:not(:disabled)) {
  opacity: 1;
}

.attach-button :deep(i.codicon) {
  font-size: 17px !important;
}

.create-task-button {
  color: var(--vscode-textLink-foreground);
  opacity: 1;
}

.create-task-button:hover:not(:disabled) {
  background: var(--vscode-toolbar-hoverBackground);
}

.pinned-files-button-wrapper {
  position: relative;
  display: inline-flex;
}

.pinned-files-button :deep(i.codicon) {
  transform: rotate(-90deg);
}

.pinned-files-button.has-files :deep(i.codicon) {
  color: var(--vscode-textLink-foreground);
}

.pinned-files-button.has-prompt :deep(i.codicon) {
  color: var(--vscode-textLink-foreground);
}

.pinned-files-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  font-size: 10px;
  font-weight: 500;
  line-height: 14px;
  text-align: center;
  color: var(--vscode-badge-foreground);
  background: var(--vscode-badge-background);
  border-radius: 7px;
}
</style>
