<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Modal } from '../common'
import { useChatStore } from '../../stores'
import { generateId } from '../../utils/format'
import { createThumbnail, formatFileSize, getFileType, inferMimeType, readFileAsBase64, validateFile } from '../../utils/file'
import type { PlanRunnerCreateInput } from '../../stores/chat/planRunnerActions'
import { useI18n } from '../../i18n'
import type { Attachment } from '../../types'

const { t } = useI18n()

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v)
})

const chatStore = useChatStore()

type StepDraft = { id: string; title: string; instruction: string; attachments: Attachment[] }

const title = ref('')
const goal = ref('')
const acceptanceCriteria = ref('')
const steps = ref<StepDraft[]>([])

function createEmptyStep(): StepDraft {
  return { id: `step_${generateId()}`, title: '', instruction: '', attachments: [] }
}

function resetForm() {
  title.value = ''
  goal.value = ''
  acceptanceCriteria.value = ''
  steps.value = [createEmptyStep()]
}

function loadFromExistingPlan() {
  const plan = chatStore.planRunner
  if (!plan) {
    resetForm()
    return
  }

  title.value = plan.title || ''
  goal.value = plan.goal || ''
  acceptanceCriteria.value = plan.acceptanceCriteria || ''
  steps.value = (plan.steps || []).map(s => ({
    id: s.id || `step_${generateId()}`,
    title: s.title || '',
    instruction: s.instruction || '',
    attachments: Array.isArray(s.attachments) ? [...s.attachments] : []
  }))

  if (steps.value.length === 0) {
    steps.value = [createEmptyStep()]
  }
}

watch(visible, (v) => {
  if (v) {
    loadFromExistingPlan()
  }
})

function addStep() {
  steps.value.push(createEmptyStep())
}

function removeStep(id: string) {
  steps.value = steps.value.filter(s => s.id !== id)
  if (steps.value.length === 0) {
    steps.value = [createEmptyStep()]
  }
}

async function createImageAttachment(file: File): Promise<Attachment | null> {
  const validation = validateFile(file)
  if (!validation.valid) return null

  const mimeType = inferMimeType(file.name, file.type)
  const type = getFileType(mimeType)
  if (type !== 'image') return null

  try {
    const data = await readFileAsBase64(file)
    const attachment: Attachment = {
      id: generateId(),
      name: file.name,
      type,
      size: file.size,
      mimeType,
      data
    }

    try {
      attachment.thumbnail = await createThumbnail(file)
    } catch {
      // ignore thumbnail failure
    }

    return attachment
  } catch (err) {
    console.error('Failed to read attachment file:', err)
    return null
  }
}

async function handleAttachStep(stepId: string) {
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = true
  input.accept = 'image/*'

  input.onchange = async (e) => {
    const files = Array.from((e.target as HTMLInputElement).files || [])
    if (files.length === 0) return

    const step = steps.value.find(s => s.id === stepId)
    if (!step) return

    for (const file of files) {
      const attachment = await createImageAttachment(file)
      if (attachment) {
        step.attachments.push(attachment)
      }
    }
  }

  input.click()
}

function removeStepAttachment(stepId: string, attachmentId: string) {
  const step = steps.value.find(s => s.id === stepId)
  if (!step) return
  step.attachments = step.attachments.filter(att => att.id !== attachmentId)
}

const normalizedInput = computed<PlanRunnerCreateInput>(() => ({
  title: title.value.trim(),
  goal: goal.value.trim() || undefined,
  acceptanceCriteria: acceptanceCriteria.value.trim() || undefined,
  steps: steps.value
    .map(s => ({
      title: s.title.trim(),
      instruction: s.instruction.trim(),
      attachments: s.attachments.length > 0 ? s.attachments : undefined
    }))
    .filter(s => s.title && s.instruction)
}))

const canSave = computed(() => normalizedInput.value.title.length > 0 && normalizedInput.value.steps.length > 0)

async function handleSave() {
  if (!canSave.value) return
  await chatStore.createPlanRunner(normalizedInput.value)
  visible.value = false
}

async function handleSaveAndStart() {
  if (!canSave.value) return
  await chatStore.createPlanRunner(normalizedInput.value)
  visible.value = false
  await chatStore.startPlanRunner()
}
</script>

<template>
  <Modal
    v-model="visible"
    :title="t('components.planRunner.modal.title')"
    width="720px"
  >
    <div class="plan-form">
      <div class="form-row">
        <label class="form-label">{{ t('components.planRunner.modal.planTitle') }}</label>
        <input v-model="title" class="form-input" :placeholder="t('components.planRunner.modal.planTitlePlaceholder')" />
      </div>

      <div class="form-row">
        <label class="form-label">{{ t('components.planRunner.modal.goal') }}</label>
        <textarea
          v-model="goal"
          class="form-textarea"
          rows="3"
          :placeholder="t('components.planRunner.modal.goalPlaceholder')"
        />
      </div>

      <div class="form-row">
        <label class="form-label">{{ t('components.planRunner.modal.acceptanceCriteria') }}</label>
        <textarea
          v-model="acceptanceCriteria"
          class="form-textarea"
          rows="3"
          :placeholder="t('components.planRunner.modal.acceptanceCriteriaPlaceholder')"
        />
      </div>

      <div class="form-row">
        <div class="form-label-row">
          <label class="form-label">{{ t('components.planRunner.modal.steps') }}</label>
          <button class="btn" @click="addStep">
            <i class="codicon codicon-add"></i>
            {{ t('components.planRunner.modal.addStep') }}
          </button>
        </div>

        <div class="steps">
          <div v-for="(s, idx) in steps" :key="s.id" class="step">
            <div class="step-header">
              <span class="step-index">{{ idx + 1 }}.</span>
              <input
                v-model="s.title"
                class="form-input step-title"
                :placeholder="t('components.planRunner.modal.stepTitle')"
              />
              <button class="icon-btn" :title="t('components.planRunner.modal.attachImage')" @click="handleAttachStep(s.id)">
                <i class="codicon codicon-attach"></i>
              </button>
              <button class="icon-btn" :title="t('components.planRunner.modal.removeStep')" @click="removeStep(s.id)">
                <i class="codicon codicon-trash"></i>
              </button>
            </div>
            <textarea
              v-model="s.instruction"
              class="form-textarea step-instruction"
              rows="3"
              :placeholder="t('components.planRunner.modal.stepInstruction')"
            />

            <div v-if="s.attachments.length > 0" class="step-attachments">
              <div v-for="attachment in s.attachments" :key="attachment.id" class="step-attachment" :title="attachment.name">
                <img
                  v-if="attachment.thumbnail"
                  :src="attachment.thumbnail"
                  :alt="attachment.name"
                  class="step-attachment-thumb"
                />
                <i v-else class="codicon codicon-file step-attachment-icon"></i>
                <div class="step-attachment-meta">
                  <div class="step-attachment-name">{{ attachment.name }}</div>
                  <div class="step-attachment-size">{{ formatFileSize(attachment.size) }}</div>
                </div>
                <button
                  class="icon-btn"
                  :title="t('components.planRunner.modal.removeAttachment')"
                  @click="removeStepAttachment(s.id, attachment.id)"
                >
                  <i class="codicon codicon-close"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="!canSave" class="hint">
        {{ t('components.planRunner.modal.hint') }}
      </div>
    </div>

    <template #footer>
      <button class="btn" @click="visible = false">{{ t('common.cancel') }}</button>
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

.form-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
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

.step-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.step-attachment {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  max-width: 100%;
}

.step-attachment-thumb {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  object-fit: cover;
}

.step-attachment-icon {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: rgba(127, 127, 127, 0.08);
}

.step-attachment-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.step-attachment-name {
  font-size: 11px;
  color: var(--vscode-foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 320px;
}

.step-attachment-size {
  font-size: 10px;
  color: var(--vscode-descriptionForeground);
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
