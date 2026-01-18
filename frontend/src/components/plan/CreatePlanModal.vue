<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Modal } from '../common'
import { useChatStore } from '../../stores'
import { generateId } from '../../utils/format'
import { createThumbnail, formatFileSize, getFileType, inferMimeType, readFileAsBase64, validateFile } from '../../utils/file'
import type { PlanRunnerCreateInput } from '../../stores/chat/planRunnerActions'
import { useI18n } from '../../i18n'
import { sendToExtension } from '../../utils/vscode'
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

type StepDraft = { id: string; title: string; instruction: string; acceptanceCriteria: string; attachments: Attachment[] }
type PlanDraft = {
  title: string
  goal?: string
  acceptanceCriteria?: string
  steps: StepDraft[]
  savedAt: number
}

const PLAN_DRAFT_METADATA_KEY = 'planRunnerDraft'
const PLAN_DRAFT_LOCALSTORAGE_KEY = 'acopilot.planRunnerDraft'

const title = ref('')
const goal = ref('')
const steps = ref<StepDraft[]>([])
const stepsContainerRef = ref<HTMLElement | null>(null)
const draftSaving = ref(false)
const draftSaved = ref(false)
const loadedFromDraft = ref(false)

function createEmptyStep(): StepDraft {
  return { id: `step_${generateId()}`, title: '', instruction: '', acceptanceCriteria: '', attachments: [] }
}

function resetForm() {
  title.value = ''
  goal.value = ''
  steps.value = [createEmptyStep()]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : String(value ?? '')
}

function normalizeAttachmentType(value: unknown): Attachment['type'] | null {
  const v = asString(value).trim()
  if (v === 'image' || v === 'video' || v === 'audio' || v === 'document' || v === 'code') return v
  return null
}

function normalizeAttachment(raw: unknown): Attachment | null {
  if (!isRecord(raw)) return null

  const id = asString((raw as any).id).trim()
  const name = asString((raw as any).name).trim()
  const type = normalizeAttachmentType((raw as any).type)
  const size = typeof (raw as any).size === 'number' ? (raw as any).size : Number((raw as any).size)
  const mimeType = asString((raw as any).mimeType).trim()

  if (!id || !name || !type || !Number.isFinite(size) || !mimeType) return null

  return {
    id,
    name,
    type,
    size,
    url: typeof (raw as any).url === 'string' ? (raw as any).url : undefined,
    data: typeof (raw as any).data === 'string' ? (raw as any).data : undefined,
    mimeType,
    thumbnail: typeof (raw as any).thumbnail === 'string' ? (raw as any).thumbnail : undefined,
    metadata: isRecord((raw as any).metadata) ? (raw as any).metadata : undefined
  }
}

function normalizeDraft(raw: unknown): PlanDraft | null {
  if (!isRecord(raw)) return null

  const stepsRaw = (raw as any).steps
  if (!Array.isArray(stepsRaw)) return null

  const normalizedSteps: StepDraft[] = []
  for (const s of stepsRaw) {
    if (!isRecord(s)) continue
    const id = asString((s as any).id || `step_${generateId()}`)
    const title = asString((s as any).title || '')
    const instruction = asString((s as any).instruction || '')
    const acceptanceCriteria = asString((s as any).acceptanceCriteria || '')
    const attachmentsRaw = (s as any).attachments
    const attachments = Array.isArray(attachmentsRaw)
      ? (attachmentsRaw.map(normalizeAttachment).filter(Boolean) as Attachment[])
      : []

    normalizedSteps.push({ id, title, instruction, acceptanceCriteria, attachments })
  }

  return {
    title: asString((raw as any).title || ''),
    goal: typeof (raw as any).goal === 'string' ? (raw as any).goal : undefined,
    steps: normalizedSteps.length > 0 ? normalizedSteps : [createEmptyStep()],
    savedAt: typeof (raw as any).savedAt === 'number' ? (raw as any).savedAt : Date.now()
  }
}

function loadDraftFromLocalStorage(key: string): PlanDraft | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    return normalizeDraft(JSON.parse(raw))
  } catch {
    return null
  }
}

function persistDraftToLocalStorage(key: string, value: PlanDraft | null): void {
  try {
    if (!value) {
      window.localStorage.removeItem(key)
      return
    }
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore localStorage quota/errors
  }
}

function loadFromExistingPlan() {
  const plan = chatStore.planRunner
  if (!plan) {
    resetForm()
    return
  }

  title.value = plan.title || ''
  goal.value = plan.goal || ''
  steps.value = (plan.steps || []).map(s => ({
    id: s.id || `step_${generateId()}`,
    title: s.title || '',
    instruction: s.instruction || '',
    acceptanceCriteria: s.acceptanceCriteria || '',
    attachments: Array.isArray(s.attachments) ? [...s.attachments] : []
  }))

  if (steps.value.length === 0) {
    steps.value = [createEmptyStep()]
  }
}

async function loadFromDraftOrExistingPlan() {
  loadedFromDraft.value = false

  const conversationId = chatStore.currentConversationId
  const localKey = conversationId ? `${PLAN_DRAFT_LOCALSTORAGE_KEY}.${conversationId}` : `${PLAN_DRAFT_LOCALSTORAGE_KEY}.__unpersisted__`
  const tempKey = `${PLAN_DRAFT_LOCALSTORAGE_KEY}.__unpersisted__`

  if (!conversationId) {
    const localDraft = loadDraftFromLocalStorage(localKey)
      if (localDraft) {
        title.value = localDraft.title || ''
        goal.value = localDraft.goal || ''
        steps.value = (localDraft.steps || []).map(s => ({
          id: s.id || `step_${generateId()}`,
          title: s.title || '',
          instruction: s.instruction || '',
          acceptanceCriteria: s.acceptanceCriteria || '',
          attachments: Array.isArray(s.attachments) ? [...s.attachments] : []
        }))

        if (steps.value.length === 0) {
        steps.value = [createEmptyStep()]
      }

      loadedFromDraft.value = true
      return
    }

    loadFromExistingPlan()
    return
  }

  try {
    const meta = await sendToExtension<any>('conversation.getConversationMetadata', {
      conversationId
    })
    const rawDraft = meta?.custom?.[PLAN_DRAFT_METADATA_KEY]
    const draft = normalizeDraft(rawDraft)

    const plan = chatStore.planRunner
    const planUpdatedAt = (plan as any)?.lastUpdatedAt ?? plan?.createdAt ?? 0

    const localDraft = loadDraftFromLocalStorage(localKey)
    const tempDraft = loadDraftFromLocalStorage(tempKey)

    // Prefer the newest available draft (metadata/local/temp), but do not override a newer existing plan.
    const candidates = [draft, localDraft, tempDraft].filter(Boolean) as PlanDraft[]
    const newestDraft = candidates.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))[0]

    if (newestDraft && (!plan || newestDraft.savedAt > planUpdatedAt)) {
      // If we loaded from temp draft and now we have a conversationId, migrate it to this conversation key/meta.
      if (tempDraft && newestDraft === tempDraft) {
        persistDraftToLocalStorage(tempKey, null)
        await persistDraft(newestDraft)
      }

      title.value = newestDraft.title || ''
      goal.value = newestDraft.goal || ''
      steps.value = (newestDraft.steps || []).map(s => ({
        id: s.id || `step_${generateId()}`,
        title: s.title || '',
        instruction: s.instruction || '',
        acceptanceCriteria: s.acceptanceCriteria || '',
        attachments: Array.isArray(s.attachments) ? [...s.attachments] : []
      }))

      if (steps.value.length === 0) {
        steps.value = [createEmptyStep()]
      }

      loadedFromDraft.value = true
      return
    }
  } catch {
    // ignore draft load failures; fall back to local draft
    const localDraft = loadDraftFromLocalStorage(localKey) || loadDraftFromLocalStorage(tempKey)
    if (localDraft) {
      title.value = localDraft.title || ''
      goal.value = localDraft.goal || ''
      steps.value = (localDraft.steps || []).map(s => ({
        id: s.id || `step_${generateId()}`,
        title: s.title || '',
        instruction: s.instruction || '',
        acceptanceCriteria: s.acceptanceCriteria || '',
        attachments: Array.isArray(s.attachments) ? [...s.attachments] : []
      }))

      if (steps.value.length === 0) {
        steps.value = [createEmptyStep()]
      }

      loadedFromDraft.value = true
      return
    }
  }

  loadFromExistingPlan()
}

watch(visible, (v) => {
  if (v) {
    draftSaved.value = false
    resetForm()
    loadFromDraftOrExistingPlan()
  }
})

function addStep() {
  steps.value.push(createEmptyStep())

  // 自动滚动到新步骤并聚焦标题，避免添加多步时反复回到顶部
  requestAnimationFrame(() => {
    const container = stepsContainerRef.value
    if (!container) return

    const lastStep = container.querySelector('.step:last-child') as HTMLElement | null
    if (!lastStep) return

    lastStep.scrollIntoView({ block: 'nearest' })
    const titleInput = lastStep.querySelector('input.step-title') as HTMLInputElement | null
    titleInput?.focus()
  })
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

function toPastedImageFilename(mimeType: string): string {
  const lower = String(mimeType || '').toLowerCase().trim()
  let ext = 'png'
  if (lower === 'image/jpeg') ext = 'jpg'
  else if (lower === 'image/png') ext = 'png'
  else if (lower === 'image/gif') ext = 'gif'
  else if (lower === 'image/webp') ext = 'webp'
  else if (lower === 'image/bmp') ext = 'bmp'
  else if (lower.startsWith('image/')) {
    ext = lower.slice('image/'.length).replace(/[^a-z0-9]/g, '') || 'png'
  }
  return `pasted-image-${generateId()}.${ext}`
}

function normalizePastedImageFile(file: File, mimeTypeHint: string): File {
  const name = (file.name || '').trim()
  const mimeType = inferMimeType(name, file.type || mimeTypeHint || '')

  // Clipboard images sometimes come with an empty filename; give them a stable one for display.
  if (name) return file

  try {
    return new File([file], toPastedImageFilename(mimeType), { type: mimeType })
  } catch {
    // If File constructor fails for any reason, fall back to the original File.
    return file
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

async function handlePasteStep(stepId: string, e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return

  const step = steps.value.find(s => s.id === stepId)
  if (!step) return

  // First pass: detect whether the clipboard contains image files.
  const candidates: Array<{ file: File; mimeTypeHint: string }> = []
  let hasImage = false

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.kind !== 'file') continue

    const file = item.getAsFile()
    if (!file) continue

    const mimeType = inferMimeType(file.name, file.type || item.type || '')
    if (getFileType(mimeType) === 'image') {
      hasImage = true
    }

    candidates.push({ file, mimeTypeHint: item.type })
  }

  if (!hasImage) return

  // Prevent default paste (text/other) when an image exists, consistent with InputBox behavior.
  e.preventDefault()

  for (const c of candidates) {
    const normalizedFile = normalizePastedImageFile(c.file, c.mimeTypeHint)
    const attachment = await createImageAttachment(normalizedFile)
    if (attachment) {
      step.attachments.push(attachment)
    }
  }
}

function removeStepAttachment(stepId: string, attachmentId: string) {
  const step = steps.value.find(s => s.id === stepId)
  if (!step) return
  step.attachments = step.attachments.filter(att => att.id !== attachmentId)
}

const normalizedInput = computed<PlanRunnerCreateInput>(() => ({
  title: title.value.trim(),
  goal: goal.value.trim() || undefined,
  steps: steps.value
    .map(s => ({
      title: s.title.trim(),
      instruction: s.instruction.trim(),
      acceptanceCriteria: s.acceptanceCriteria.trim() || undefined,
      attachments: s.attachments.length > 0 ? s.attachments : undefined
    }))
    .filter(s => s.title && s.instruction)
}))

const canSave = computed(() => normalizedInput.value.title.length > 0 && normalizedInput.value.steps.length > 0)

const canStash = computed(() => {
  if (title.value.trim() || goal.value.trim()) return true
  return steps.value.some(s => s.title.trim() || s.instruction.trim() || s.acceptanceCriteria.trim() || s.attachments.length > 0)
})

async function persistDraft(value: PlanDraft | null) {
  const conversationId = chatStore.currentConversationId
  const key = conversationId ? `${PLAN_DRAFT_LOCALSTORAGE_KEY}.${conversationId}` : `${PLAN_DRAFT_LOCALSTORAGE_KEY}.__unpersisted__`
  persistDraftToLocalStorage(key, value)

  if (!conversationId) return

  try {
    await sendToExtension('conversation.setCustomMetadata', {
      conversationId,
      key: PLAN_DRAFT_METADATA_KEY,
      value
    })
  } catch (e) {
    console.warn('[planRunner] Failed to persist draft to metadata:', e)
  }
}

async function handleStash() {
  if (!canStash.value) return
  if (draftSaving.value) return

  draftSaving.value = true
  try {
    const draft: PlanDraft = {
      title: title.value,
      goal: goal.value || undefined,
      steps: steps.value.map(s => ({
        id: s.id,
        title: s.title,
        instruction: s.instruction,
        acceptanceCriteria: s.acceptanceCriteria,
        attachments: s.attachments
      })),
      savedAt: Date.now()
    }

    await persistDraft(draft)
    draftSaved.value = true
    loadedFromDraft.value = true
    setTimeout(() => {
      draftSaved.value = false
    }, 1500)
  } catch (err) {
    console.warn('[planRunner] Failed to stash draft:', err)
  } finally {
    draftSaving.value = false
  }
}

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
  <Modal
    v-model="visible"
    :title="t('components.planRunner.modal.title')"
    width="720px"
  >
    <div class="plan-form">
      <div v-if="loadedFromDraft" class="draft-banner">
        <i class="codicon codicon-save"></i>
        <span>{{ t('components.planRunner.modal.draftLoaded') }}</span>
      </div>

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
        <div class="form-label-row">
        <label class="form-label">{{ t('components.planRunner.modal.steps') }}</label>
          <button class="btn" @click="addStep">
            <i class="codicon codicon-add"></i>
            {{ t('components.planRunner.modal.addStep') }}
          </button>
        </div>

        <div ref="stepsContainerRef" class="steps">
          <div
            v-for="(s, idx) in steps"
            :key="s.id"
            class="step"
            @paste="handlePasteStep(s.id, $event)"
          >
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

            <div class="step-acceptance">
              <div class="step-acceptance-label">{{ t('components.planRunner.modal.acceptanceCriteria') }}</div>
              <textarea
                v-model="s.acceptanceCriteria"
                class="form-textarea step-acceptance-textarea"
                rows="2"
                :placeholder="t('components.planRunner.modal.acceptanceCriteriaPlaceholder')"
              />
            </div>

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
  gap: 12px;
  position: sticky;
  top: 0;
  z-index: 5;
  padding: 6px 0;
  background: var(--vscode-editor-background);
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
