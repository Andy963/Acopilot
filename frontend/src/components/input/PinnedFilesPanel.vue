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
  pinnedFiles,
  showPinnedFilesPanel,
  isLoadingPinnedFiles,
  isDraggingOver,
  pinPanelTab,
  skills,
  isLoadingSkills,
  selectedSkillId,
  selectedSkill,
  presets,
  isLoadingPresets,
  selectedPresetId,
  selectedPreset,
  activePinnedPrompts,
  customPromptDraft,
  isSavingPinnedPrompt,
  presetNameDraft,
  isSavingPreset,
  hasPinnedPrompt,
  enabledPinnedFilesCount,
  loadSkills,
  loadPinnedPromptPresets,
  openPanel,
  emitClose,
  handleRemovePinnedFile,
  handleTogglePinnedFile,
  handleSavePinnedPrompt,
  handleSaveCustomPromptAsPreset,
<<<<<<< HEAD
  handleDeleteSelectedPreset,
=======
>>>>>>> f327a97 (merge: dev into main for v1.2.0)
  handleClearPinnedPrompt,
  handleRemovePinnedPrompt,
  handleMovePinnedPrompt,
  handleSelectSkill,
  handleSelectPreset,
  handleCustomPromptEdited,
  formatPinnedPromptItemTitle,
  isSkillPinned,
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
<<<<<<< HEAD
      <span class="pinned-files-title" :title="t('components.input.pinnedFilesPanel.description')">
=======
      <span class="pinned-files-title">
>>>>>>> f327a97 (merge: dev into main for v1.2.0)
        <i class="codicon codicon-pin"></i>
        {{ t('components.input.pinnedFilesPanel.title') }}
      </span>
      <IconButton
        icon="codicon-close"
        size="small"
        @click="emitClose"
      />
    </div>
<<<<<<< HEAD
=======
    <div class="pinned-files-description">
      {{ t('components.input.pinnedFilesPanel.description') }}
    </div>
>>>>>>> f327a97 (merge: dev into main for v1.2.0)

    <div class="pinned-panel-tabs">
      <button
        class="pinned-tab"
        :class="{ active: pinPanelTab === 'custom' }"
        @click="pinPanelTab = 'custom'"
      >
        {{ t('components.input.pinnedFilesPanel.tabs.custom') }}
      </button>
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
    </div>

    <div class="pinned-prompt-active">
      <div class="pinned-prompt-active-header">
        <span>{{ t('components.input.pinnedFilesPanel.active.title') }}</span>
        <button
          v-if="activePinnedPrompts.length > 0"
          class="pinned-prompt-active-clear"
          :disabled="isSavingPinnedPrompt"
          @click="handleClearPinnedPrompt"
        >
          {{ t('components.input.pinnedFilesPanel.custom.clear') }}
        </button>
      </div>
      <div v-if="activePinnedPrompts.length === 0" class="pinned-prompt-active-empty">
        {{ t('components.input.pinnedFilesPanel.active.empty') }}
      </div>
      <div v-else class="pinned-prompt-active-list">
        <div
          v-for="(item, index) in activePinnedPrompts"
          :key="item.id"
          class="pinned-prompt-active-item"
        >
          <span class="pinned-prompt-active-order">{{ index + 1 }}</span>
          <span class="pinned-prompt-active-name" :title="item.id">
            {{ formatPinnedPromptItemTitle(item) }}
          </span>
          <span class="pinned-prompt-active-mode">{{ item.mode }}</span>
          <IconButton
            icon="codicon-arrow-up"
            size="small"
            :disabled="index === 0 || isSavingPinnedPrompt"
            :title="t('components.input.pinnedFilesPanel.active.moveUp')"
            @click="handleMovePinnedPrompt(item.id, -1)"
          />
          <IconButton
            icon="codicon-arrow-down"
            size="small"
            :disabled="index === activePinnedPrompts.length - 1 || isSavingPinnedPrompt"
            :title="t('components.input.pinnedFilesPanel.active.moveDown')"
            @click="handleMovePinnedPrompt(item.id, 1)"
          />
          <IconButton
            icon="codicon-close"
            size="small"
            :disabled="isSavingPinnedPrompt"
            :title="t('components.input.remove')"
            @click="handleRemovePinnedPrompt(item.id)"
          />
        </div>
      </div>
    </div>

    <div v-if="pinPanelTab === 'custom'" class="pinned-custom-content">
<<<<<<< HEAD
      <div class="pinned-custom-toolbar">
=======
      <div class="pinned-custom-row">
        <label class="pinned-custom-label">{{ t('components.input.pinnedFilesPanel.custom.presetsLabel') }}</label>
>>>>>>> f327a97 (merge: dev into main for v1.2.0)
        <select
          v-model="selectedPresetId"
          class="pinned-custom-preset-select"
          :disabled="isLoadingPresets"
<<<<<<< HEAD
          :aria-label="t('components.input.pinnedFilesPanel.custom.presetsLabel')"
          :title="presets.length === 0
            ? t('components.input.pinnedFilesPanel.custom.presetsEmpty')
            : (selectedPreset
              ? t('components.input.pinnedFilesPanel.custom.selectedPresetHint', { name: selectedPreset.name || selectedPreset.id })
              : t('components.input.pinnedFilesPanel.custom.presetsLabel'))"
=======
>>>>>>> f327a97 (merge: dev into main for v1.2.0)
          @change="handleSelectPreset(selectedPresetId)"
        >
          <option value="" disabled>{{ t('components.input.pinnedFilesPanel.custom.presetsEmptyOption') }}</option>
          <option v-for="preset in presets" :key="preset.id" :value="preset.id">
            {{ preset.name || preset.id }}
          </option>
        </select>
<<<<<<< HEAD
        <button
          class="pinned-custom-icon-btn danger"
          :disabled="!selectedPreset || isSavingPreset"
          :title="t('components.input.pinnedFilesPanel.custom.deletePreset')"
          @click="handleDeleteSelectedPreset"
        >
          <i class="codicon codicon-trash"></i>
        </button>
        <button
          class="pinned-custom-icon-btn"
          :disabled="isLoadingPresets"
          :title="t('common.refresh')"
          @click="loadPinnedPromptPresets"
        >
          <i class="codicon" :class="isLoadingPresets ? 'codicon-loading codicon-modifier-spin' : 'codicon-refresh'"></i>
        </button>
      </div>

      <textarea
        v-model="customPromptDraft"
        class="pinned-custom-textarea"
        :aria-label="t('components.input.pinnedFilesPanel.custom.label')"
        :placeholder="t('components.input.pinnedFilesPanel.custom.placeholder')"
        @input="handleCustomPromptEdited"
      ></textarea>

      <div class="pinned-custom-actions-bar">
        <button
          class="pinned-custom-btn primary"
          :disabled="isSavingPinnedPrompt || !customPromptDraft.trim()"
          :title="t('components.input.pinnedFilesPanel.custom.hint')"
          @click="handleSavePinnedPrompt"
        >
          <i v-if="isSavingPinnedPrompt" class="codicon codicon-loading codicon-modifier-spin"></i>
          <span v-else>{{ t('components.input.pinnedFilesPanel.custom.save') }}</span>
        </button>
        <button class="pinned-custom-btn" @click="handleClearPinnedPrompt" :disabled="isSavingPinnedPrompt">
          {{ t('components.input.pinnedFilesPanel.custom.clear') }}
        </button>
        <input
          v-model="presetNameDraft"
          class="pinned-custom-name-input"
          :placeholder="t('components.input.pinnedFilesPanel.custom.saveAsPresetNamePlaceholder')"
          :aria-label="t('components.input.pinnedFilesPanel.custom.saveAsPresetLabel')"
          :title="t('components.input.pinnedFilesPanel.custom.saveAsPresetHint')"
        />
        <button
          class="pinned-custom-btn"
          :disabled="isSavingPreset || !customPromptDraft.trim() || !presetNameDraft.trim()"
          :title="t('components.input.pinnedFilesPanel.custom.saveAsPresetHint')"
          @click="handleSaveCustomPromptAsPreset"
        >
          <i v-if="isSavingPreset" class="codicon codicon-loading codicon-modifier-spin"></i>
          <span v-else>{{ t('components.input.pinnedFilesPanel.custom.saveAsPresetButton') }}</span>
        </button>
=======
        <button class="pinned-skill-refresh" :disabled="isLoadingPresets" @click="loadPinnedPromptPresets" :title="t('common.refresh')">
          <i class="codicon" :class="isLoadingPresets ? 'codicon-loading codicon-modifier-spin' : 'codicon-refresh'"></i>
        </button>
      </div>
      <div v-if="!isLoadingPresets && presets.length === 0" class="pinned-custom-hint">
        {{ t('components.input.pinnedFilesPanel.custom.presetsEmpty') }}
      </div>
      <div v-else-if="selectedPreset" class="pinned-custom-hint">
        {{ t('components.input.pinnedFilesPanel.custom.selectedPresetHint', { name: selectedPreset.name || selectedPreset.id }) }}
      </div>

      <div class="pinned-custom-row">
        <label class="pinned-custom-label">{{ t('components.input.pinnedFilesPanel.custom.label') }}</label>
      </div>
      <textarea
        v-model="customPromptDraft"
        class="pinned-custom-textarea"
        rows="7"
        :placeholder="t('components.input.pinnedFilesPanel.custom.placeholder')"
        @input="handleCustomPromptEdited"
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

      <div class="pinned-custom-save-as-preset">
        <label class="pinned-custom-label">{{ t('components.input.pinnedFilesPanel.custom.saveAsPresetLabel') }}</label>
        <div class="pinned-custom-save-as-preset-row">
          <input
            v-model="presetNameDraft"
            class="pinned-custom-save-as-preset-input"
            :placeholder="t('components.input.pinnedFilesPanel.custom.saveAsPresetNamePlaceholder')"
          />
          <button
            class="pinned-custom-save-as-preset-btn"
            :disabled="isSavingPreset || !customPromptDraft.trim() || !presetNameDraft.trim()"
            @click="handleSaveCustomPromptAsPreset"
          >
            <i v-if="isSavingPreset" class="codicon codicon-loading codicon-modifier-spin"></i>
            <span v-else>{{ t('components.input.pinnedFilesPanel.custom.saveAsPresetButton') }}</span>
          </button>
        </div>
        <div class="pinned-custom-hint">
          {{ t('components.input.pinnedFilesPanel.custom.saveAsPresetHint') }}
        </div>
>>>>>>> f327a97 (merge: dev into main for v1.2.0)
      </div>
    </div>

    <div v-else-if="pinPanelTab === 'files'" class="pinned-files-content">
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

    <div v-else class="pinned-skill-content">
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
            <i v-if="isSkillPinned(selectedSkill.id)" class="codicon codicon-check"></i>
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

      <div class="pinned-custom-actions">
        <button class="pinned-custom-save" @click="handleSavePinnedPrompt" :disabled="isSavingPinnedPrompt || !selectedSkill">
          <i v-if="isSavingPinnedPrompt" class="codicon codicon-loading codicon-modifier-spin"></i>
          <span v-else>{{ t('components.input.pinnedFilesPanel.skill.add') }}</span>
        </button>
      </div>

      <div class="pinned-skill-footer-hint">
        {{ t('components.input.pinnedFilesPanel.skill.manageHint') }}
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
