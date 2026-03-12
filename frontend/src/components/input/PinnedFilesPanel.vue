<script setup lang="ts">
import { IconButton } from '../common'
import { usePinnedFilesPanel } from './usePinnedFilesPanel'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  statsChange: [enabledCount: number]
}>()

const {
  t,
  chatStore,
  pinnedFiles,
  showPinnedFilesPanel,
  isLoadingPinnedFiles,
  isDraggingOver,
  pinPanelTab,
  skills,
  isLoadingSkills,
  selectedSkillId,
  selectedSkill,
  customPromptDraft,
  isSavingPinnedPrompt,
  hasPinnedPrompt,
  enabledPinnedFilesCount,
  loadSkills,
  openPanel,
  emitClose,
  handleRemovePinnedFile,
  handleTogglePinnedFile,
  handleSavePinnedPrompt,
  handleClearPinnedPrompt,
  handleSelectSkill,
  handleDragEnter,
  handleDragOver,
  handleDragLeave,
  handleDrop,
} = usePinnedFilesPanel(props, emit)

defineExpose({
  enabledPinnedFilesCount,
  hasPinnedPrompt,
  openPanel,
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
          @change="handleSelectSkill(selectedSkillId)"
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
        <button class="pinned-custom-save" @click="handleSavePinnedPrompt" :disabled="isSavingPinnedPrompt">
          <i v-if="isSavingPinnedPrompt" class="codicon codicon-loading codicon-modifier-spin"></i>
          <span v-else>{{ t('components.input.pinnedFilesPanel.custom.save') }}</span>
        </button>
        <button class="pinned-custom-clear" @click="handleClearPinnedPrompt" :disabled="isSavingPinnedPrompt">
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

<style scoped src="./PinnedFilesPanel.css"></style>
