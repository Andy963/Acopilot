<script setup lang="ts">
import { useI18n } from '@/i18n'
import type { SkillDefinition } from './types'

defineProps<{
  skills: SkillDefinition[]
  isSaving: boolean
  isInstalling: boolean
  message: string
  messageVariant: 'success' | 'error' | ''
}>()

const emit = defineEmits<{
  add: []
  install: []
  edit: [skill: SkillDefinition]
  delete: [id: string]
}>()

const { t } = useI18n()
</script>

<template>
  <div class="skills-section">
    <div class="skills-header">
      <h5 class="reference-title">
        <i class="codicon codicon-wand"></i>
        {{ t('components.settings.promptSettings.skills.title') }}
      </h5>
      <div class="skills-header-actions">
        <button class="reset-btn" :disabled="isSaving || isInstalling" @click="emit('install')">
          <i class="codicon codicon-cloud-download"></i>
          {{ t('components.settings.promptSettings.skills.installFromUrl.button') }}
        </button>
        <button class="reset-btn" :disabled="isSaving" @click="emit('add')">
          <i class="codicon codicon-add"></i>
          {{ t('components.settings.promptSettings.skills.add') }}
        </button>
      </div>
    </div>

    <p class="section-description">
      {{ t('components.settings.promptSettings.skills.description') }}
    </p>

    <div v-if="skills.length === 0" class="skills-empty">
      <i class="codicon codicon-info"></i>
      <span>{{ t('components.settings.promptSettings.skills.empty') }}</span>
    </div>

    <div v-else class="skills-list">
      <div v-for="skill in skills" :key="skill.id" class="skill-item">
        <div class="skill-main">
          <div class="skill-name">{{ skill.name || skill.id }}</div>
          <div class="skill-meta">
            <code class="skill-id" :title="skill.id">{{ skill.id }}</code>
            <span v-if="skill.description" class="skill-desc" :title="skill.description">{{ skill.description }}</span>
          </div>
        </div>
        <div class="skill-actions">
          <button class="skill-action" :disabled="isSaving" @click="emit('edit', skill)">
            <i class="codicon codicon-edit"></i>
            {{ t('common.edit') }}
          </button>
          <button class="skill-action danger" :disabled="isSaving" @click="emit('delete', skill.id)">
            <i class="codicon codicon-trash"></i>
            {{ t('common.delete') }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="message" class="skills-message" :class="{ success: messageVariant === 'success' }">
      {{ message }}
    </div>
  </div>
</template>

<style scoped>
.skills-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
}

.skills-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.reference-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 13px;
  font-weight: 500;
}

.skills-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-description {
  margin: 0;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.skills-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  border: 1px dashed var(--vscode-panel-border);
  border-radius: 6px;
}

.skills-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skill-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  background: var(--vscode-list-hoverBackground);
  border: 1px solid transparent;
  border-radius: 6px;
}

.skill-item:hover {
  border-color: var(--vscode-panel-border);
}

.skill-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.skill-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--vscode-foreground);
}

.skill-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.skill-id {
  display: inline-block;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--vscode-textBlockQuote-background);
  color: var(--vscode-descriptionForeground);
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-desc {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.skill-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px solid var(--vscode-panel-border);
  background: transparent;
  color: var(--vscode-foreground);
  font-size: 12px;
  cursor: pointer;
}

.skill-action:hover:not(:disabled) {
  background: var(--vscode-toolbar-hoverBackground);
}

.skill-action.danger {
  border-color: rgba(241, 76, 76, 0.35);
  color: var(--vscode-errorForeground, #f14c4c);
}

.skill-action.danger:hover:not(:disabled) {
  background: rgba(241, 76, 76, 0.08);
}

.skills-message {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.skills-message.success {
  color: var(--vscode-testing-iconPassed, #89d185);
}

.reset-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  font-size: 11px;
  background: transparent;
  color: var(--vscode-foreground);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.reset-btn:hover:not(:disabled) {
  background: var(--vscode-list-hoverBackground);
}

.reset-btn:disabled,
.skill-action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
