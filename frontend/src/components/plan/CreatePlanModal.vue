<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from '../../i18n'
import { useChatStore } from '../../stores'
import { Modal } from '../common'
import { useCreatePlanModalDraft } from './createPlanModal/useCreatePlanModalDraft'
import { useCreatePlanModalSteps } from './createPlanModal/useCreatePlanModalSteps'

const { t } = useI18n()

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const chatStore = useChatStore()
const stepsContainerRef = ref<HTMLElement | null>(null)

const {
  canSave,
  canStash,
  draftSaved,
  draftSaving,
  goal,
  handleStash,
  loadedFromDraft,
  loadFromDraftOrExistingPlan,
  normalizedInput,
  persistDraft,
  resetForm,
  steps,
  title,
} = useCreatePlanModalDraft(chatStore)

const { addStep, handleAttachStep, handlePasteStep, removeStep, removeStepAttachment } = useCreatePlanModalSteps(
  steps,
  stepsContainerRef
)

watch(visible, value => {
  if (!value) return
  draftSaved.value = false
  resetForm()
  void loadFromDraftOrExistingPlan()
})

async function handleSave() {
  if (!canSave.value) return
  await chatStore.createPlanRunner(normalizedInput.value)
  await persistDraft(null)
  visible.value = false
}

async function handleSaveAndStart() {
  if (!canSave.value) return
  await chatStore.createPlanRunner(normalizedInput.value)
  await persistDraft(null)
  visible.value = false
  await chatStore.startPlanRunner()
}
</script>

<template>
  <Modal v-model="visible" :title="t('components.planRunner.modal.title')" width="720px">
    <div class="plan-form">
      <div v-if="loadedFromDraft" class="draft-banner">
        <i class="codicon codicon-save"></i>
        <span>{{ t('components.planRunner.modal.draftLoaded') }}</span>
      </div>

      <div class="form-row">
        <label class="form-label">{{ t('components.planRunner.modal.planTitle') }}</label>
        <input v-model="title" class="form-input"
          :placeholder="t('components.planRunner.modal.planTitlePlaceholder')" />
      </div>

      <div class="form-row">
        <label class="form-label">{{ t('components.planRunner.modal.goal') }}</label>
        <textarea v-model="goal" class="form-textarea" rows="3"
          :placeholder="t('components.planRunner.modal.goalPlaceholder')" />
      </div>

      <div class="form-row">
        <div class="form-label-row">
          <label class="form-label">{{ t('components.planRunner.modal.steps') }}</label>
        </div>

        <div ref="stepsContainerRef" class="steps">
          <div v-for="(s, idx) in steps" :key="s.id" class="step" @paste="handlePasteStep(s.id, $event)">
            <div class="step-header">
              <span class="step-index">{{ idx + 1 }}.</span>
              <input v-model="s.title" class="form-input step-title"
                :placeholder="t('components.planRunner.modal.stepTitle')" />
              <button class="icon-btn" :title="t('components.planRunner.modal.attachImage')"
                @click="handleAttachStep(s.id)">
                <i class="codicon codicon-attach"></i>
              </button>
              <button class="icon-btn" :title="t('components.planRunner.modal.removeStep')" @click="removeStep(s.id)">
                <i class="codicon codicon-trash"></i>
              </button>
            </div>
            <textarea v-model="s.instruction" class="form-textarea step-instruction" rows="3"
              :placeholder="t('components.planRunner.modal.stepInstruction')" />

            <!-- Attachments should stay close to the step description for better scanning -->
            <div v-if="s.attachments.length > 0" class="step-attachments">
              <div class="step-attachments-label">
                <i class="codicon codicon-attach"></i>
                <span>{{ t('components.planRunner.attachmentsLabel') }}</span>
              </div>
              <div class="step-attachments-list">
                <div v-for="attachment in s.attachments" :key="attachment.id" class="step-attachment"
                  :title="attachment.name">
                  <img v-if="attachment.thumbnail" :src="attachment.thumbnail" :alt="attachment.name"
                    class="step-attachment-thumb" />
                  <i v-else class="codicon codicon-file step-attachment-icon"></i>
                  <div class="step-attachment-meta">
                    <div class="step-attachment-name">{{ attachment.name }}</div>
                  </div>
                  <button class="icon-btn" :title="t('components.planRunner.modal.removeAttachment')"
                    @click="removeStepAttachment(s.id, attachment.id)">
                    <i class="codicon codicon-close"></i>
                  </button>
                </div>
              </div>
            </div>

            <div class="step-acceptance">
              <div class="step-acceptance-label">{{ t('components.planRunner.modal.acceptanceCriteria') }}</div>
              <textarea v-model="s.acceptanceCriteria" class="form-textarea step-acceptance-textarea" rows="2"
                :placeholder="t('components.planRunner.modal.acceptanceCriteriaPlaceholder')" />
            </div>
          </div>
        </div>

        <div class="add-step-row">
          <button class="btn add-step-btn" @click="addStep">
            <i class="codicon codicon-add"></i>
            {{ t('components.planRunner.modal.addStep') }}
          </button>
        </div>
      </div>

      <div v-if="!canSave" class="hint">
        {{ t('components.planRunner.modal.hint') }}
      </div>
    </div>

    <template #footer>
      <button class="btn" @click="visible = false">{{ t('common.cancel') }}</button>
      <button class="btn" :disabled="!canStash || draftSaving" @click="handleStash">
        <i :class="['codicon', draftSaved ? 'codicon-check' : 'codicon-save']"></i>
        {{ draftSaved ? t('components.planRunner.modal.stashed') : t('components.planRunner.modal.stash') }}
      </button>
      <button class="btn primary" :disabled="!canSave" @click="handleSave">
        {{ t('components.planRunner.modal.save') }}
      </button>
      <button class="btn primary" :disabled="!canSave" @click="handleSaveAndStart">
        <i class="codicon codicon-play"></i>
        {{ t('components.planRunner.modal.saveAndStart') }}
      </button>
    </template>
  </Modal>
</template>

<style scoped>
.plan-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.draft-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  background: rgba(127, 127, 127, 0.06);
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
}

.draft-banner .codicon {
  color: var(--vscode-textLink-foreground);
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.form-label {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.form-input,
.form-textarea {
  width: 100%;
  border: 1px solid var(--vscode-input-border);
  border-radius: 6px;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  padding: 8px 10px;
  font-size: 12px;
}

.form-textarea {
  resize: vertical;
  font-family: var(--vscode-editor-font-family);
}

.steps {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.add-step-row {
  display: flex;
  justify-content: center;
}

.add-step-btn {
  width: 100%;
  justify-content: center;
}

.step {
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  padding: 10px;
  background: rgba(127, 127, 127, 0.04);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.step-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.step-index {
  width: 18px;
  text-align: right;
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
}

.step-title {
  flex: 1;
}

.step-instruction {
  min-height: 72px;
}

.step-acceptance {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.step-acceptance-label {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}

.step-acceptance-textarea {
  min-height: 52px;
}

.step-attachments {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.step-attachments-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}

.step-attachments-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.step-attachment {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 6px;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
  flex: 0 1 auto;
  max-width: 120px;
  min-width: 0;
}

.step-attachment .icon-btn {
  padding: 2px;
  border-radius: 4px;
}

.step-attachment-thumb {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  object-fit: cover;
}

.step-attachment-icon {
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: rgba(127, 127, 127, 0.08);
  font-size: 12px;
}

.step-attachment-meta {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.step-attachment-name {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  color: var(--vscode-foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--vscode-panel-border);
  background: transparent;
  color: var(--vscode-foreground);
  font-size: 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.btn:hover:not(:disabled) {
  background: var(--vscode-toolbar-hoverBackground);
}

.btn.primary {
  border: none;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.icon-btn {
  border: none;
  background: transparent;
  color: var(--vscode-foreground);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
}

.icon-btn:hover {
  background: var(--vscode-toolbar-hoverBackground);
}

.hint {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}
</style>
