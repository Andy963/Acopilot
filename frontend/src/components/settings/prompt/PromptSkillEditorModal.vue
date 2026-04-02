<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Modal } from '@/components/common'
import { useI18n } from '@/i18n'
import type { SkillDefinition } from './types'

const props = defineProps<{
  modelValue: boolean
  skill: SkillDefinition | null
  existingSkills: SkillDefinition[]
  isSaving: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  save: [payload: { originalId: string | null; skill: SkillDefinition }]
}>()

const { t } = useI18n()

const skillFormError = ref('')
const skillForm = reactive<SkillDefinition>({
  id: '',
  name: '',
  description: '',
  prompt: ''
})

const originalSkillId = computed(() => props.skill?.id ?? null)
const isEditing = computed(() => originalSkillId.value !== null)

watch(
  () => [props.modelValue, props.skill] as const,
  ([isOpen, skill]) => {
    if (!isOpen) {
      skillFormError.value = ''
      return
    }

    skillFormError.value = ''
    skillForm.id = skill?.id ?? ''
    skillForm.name = skill?.name ?? ''
    skillForm.description = skill?.description ?? ''
    skillForm.prompt = skill?.prompt ?? ''
  },
  { immediate: true }
)

function closeModal() {
  emit('update:modelValue', false)
}

function confirmSkillModal() {
  const id = skillForm.id.trim()
  const name = skillForm.name.trim()
  const prompt = skillForm.prompt.trim()

  if (!id) {
    skillFormError.value = t('components.settings.promptSettings.skills.validation.idRequired')
    return
  }

  if (!prompt) {
    skillFormError.value = t('components.settings.promptSettings.skills.validation.promptRequired')
    return
  }

  const duplicate = props.existingSkills.find(skill => skill.id === id && skill.id !== originalSkillId.value)
  if (duplicate) {
    skillFormError.value = t('components.settings.promptSettings.skills.validation.idDuplicate')
    return
  }

  emit('save', {
    originalId: originalSkillId.value,
    skill: {
      id,
      name: name || id,
      description: skillForm.description?.trim() || '',
      prompt: skillForm.prompt
    }
  })
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="isEditing ? t('components.settings.promptSettings.skills.modal.editTitle') : t('components.settings.promptSettings.skills.modal.addTitle')"
    width="680px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="skill-form">
      <div class="skill-form-row">
        <label class="skill-form-label">{{ t('components.settings.promptSettings.skills.modal.id') }}</label>
        <input v-model="skillForm.id" class="skill-form-input" :placeholder="t('components.settings.promptSettings.skills.modal.idPlaceholder')" />
      </div>

      <div class="skill-form-row">
        <label class="skill-form-label">{{ t('components.settings.promptSettings.skills.modal.name') }}</label>
        <input v-model="skillForm.name" class="skill-form-input" :placeholder="t('components.settings.promptSettings.skills.modal.namePlaceholder')" />
      </div>

      <div class="skill-form-row">
        <label class="skill-form-label">{{ t('components.settings.promptSettings.skills.modal.description') }}</label>
        <input v-model="skillForm.description" class="skill-form-input" :placeholder="t('components.settings.promptSettings.skills.modal.descriptionPlaceholder')" />
      </div>

      <div class="skill-form-row">
        <label class="skill-form-label">{{ t('components.settings.promptSettings.skills.modal.prompt') }}</label>
        <textarea
          v-model="skillForm.prompt"
          class="skill-form-textarea"
          rows="10"
          :placeholder="t('components.settings.promptSettings.skills.modal.promptPlaceholder')"
        ></textarea>
      </div>

      <div v-if="skillFormError" class="skill-form-error">
        <i class="codicon codicon-warning"></i>
        <span>{{ skillFormError }}</span>
      </div>
    </div>

    <template #footer>
      <button class="dialog-btn cancel" @click="closeModal">{{ t('common.cancel') }}</button>
      <button class="dialog-btn confirm" :disabled="isSaving" @click="confirmSkillModal">{{ t('common.save') }}</button>
    </template>
  </Modal>
</template>

<style scoped>
.skill-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skill-form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.skill-form-label {
  font-size: 12px;
  color: var(--vscode-foreground);
}

.skill-form-input,
.skill-form-textarea {
  width: 100%;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  font-family: var(--vscode-font-family);
  font-size: 12px;
}

.skill-form-textarea {
  font-family: var(--vscode-editor-font-family);
  line-height: 1.4;
  resize: vertical;
}

.skill-form-error {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--vscode-errorForeground, #f14c4c);
}

.dialog-btn {
  padding: 6px 14px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  border: none;
  transition: background-color 0.15s, opacity 0.15s;
}

.dialog-btn.cancel {
  background: transparent;
  color: var(--vscode-foreground);
  border: 1px solid var(--vscode-panel-border);
}

.dialog-btn.cancel:hover:not(:disabled) {
  background: var(--vscode-toolbar-hoverBackground);
}

.dialog-btn.confirm {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.dialog-btn.confirm:hover:not(:disabled) {
  background: var(--vscode-button-hoverBackground);
}

.dialog-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
