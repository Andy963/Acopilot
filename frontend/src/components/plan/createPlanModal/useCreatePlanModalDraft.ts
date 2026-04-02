import { computed, ref } from 'vue'
import { useChatStore } from '../../../stores'
import type { PlanRunnerCreateInput } from '../../../stores/chat/planRunnerActions'
import { sendToExtension } from '../../../utils/vscode'
import {
  PLAN_DRAFT_LOCALSTORAGE_KEY,
  PLAN_DRAFT_METADATA_KEY,
  createEmptyStep,
  normalizeDraft,
  normalizeStepDrafts,
  type PlanDraft,
  type StepDraft,
} from './types'

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

export function useCreatePlanModalDraft(chatStore: ReturnType<typeof useChatStore>) {
  const title = ref('')
  const goal = ref('')
  const steps = ref<StepDraft[]>([createEmptyStep()])
  const draftSaving = ref(false)
  const draftSaved = ref(false)
  const loadedFromDraft = ref(false)

  function applyFormState(next: { title?: string; goal?: string; steps?: unknown }) {
    title.value = next.title || ''
    goal.value = next.goal || ''
    steps.value = normalizeStepDrafts(next.steps)
  }

  function resetForm() {
    title.value = ''
    goal.value = ''
    steps.value = [createEmptyStep()]
  }

  function loadFromExistingPlan() {
    const plan = chatStore.planRunner
    if (!plan) {
      resetForm()
      return
    }

    applyFormState({
      title: plan.title,
      goal: plan.goal,
      steps: plan.steps,
    })
  }

  async function persistDraft(value: PlanDraft | null) {
    const conversationId = chatStore.currentConversationId
    const key = conversationId ? `${PLAN_DRAFT_LOCALSTORAGE_KEY}.${conversationId}` : `${PLAN_DRAFT_LOCALSTORAGE_KEY}.__unpersisted__`
    persistDraftToLocalStorage(key, value)

    if (!conversationId) return

    try {
      await sendToExtension('conversation.setCustomMetadata', {
        conversationId,
        key: PLAN_DRAFT_METADATA_KEY,
        value,
      })
    } catch (error) {
      console.warn('[planRunner] Failed to persist draft to metadata:', error)
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
        applyFormState(localDraft)
        loadedFromDraft.value = true
        return
      }

      loadFromExistingPlan()
      return
    }

    try {
      const metadata = await sendToExtension<any>('conversation.getConversationMetadata', {
        conversationId,
      })
      const metadataDraft = normalizeDraft(metadata?.custom?.[PLAN_DRAFT_METADATA_KEY])

      const plan = chatStore.planRunner
      const planUpdatedAt = (plan as any)?.lastUpdatedAt ?? plan?.createdAt ?? 0

      const localDraft = loadDraftFromLocalStorage(localKey)
      const tempDraft = loadDraftFromLocalStorage(tempKey)
      const newestDraft = [metadataDraft, localDraft, tempDraft]
        .filter(Boolean)
        .sort((left, right) => (right!.savedAt || 0) - (left!.savedAt || 0))[0] || null

      if (newestDraft && (!plan || newestDraft.savedAt > planUpdatedAt)) {
        if (tempDraft && newestDraft === tempDraft) {
          persistDraftToLocalStorage(tempKey, null)
          await persistDraft(newestDraft)
        }

        applyFormState(newestDraft)
        loadedFromDraft.value = true
        return
      }
    } catch {
      const localDraft = loadDraftFromLocalStorage(localKey) || loadDraftFromLocalStorage(tempKey)
      if (localDraft) {
        applyFormState(localDraft)
        loadedFromDraft.value = true
        return
      }
    }

    loadFromExistingPlan()
  }

  const normalizedInput = computed<PlanRunnerCreateInput>(() => ({
    title: title.value.trim(),
    goal: goal.value.trim() || undefined,
    steps: steps.value
      .map(step => ({
        title: step.title.trim(),
        instruction: step.instruction.trim(),
        acceptanceCriteria: step.acceptanceCriteria.trim() || undefined,
        attachments: step.attachments.length > 0 ? step.attachments : undefined,
      }))
      .filter(step => step.title && step.instruction),
  }))

  const canSave = computed(() => normalizedInput.value.title.length > 0 && normalizedInput.value.steps.length > 0)

  const canStash = computed(() => {
    if (title.value.trim() || goal.value.trim()) return true

    return steps.value.some(step => {
      return step.title.trim() || step.instruction.trim() || step.acceptanceCriteria.trim() || step.attachments.length > 0
    })
  })

  async function handleStash() {
    if (!canStash.value || draftSaving.value) return

    draftSaving.value = true
    try {
      const draft: PlanDraft = {
        title: title.value,
        goal: goal.value || undefined,
        steps: steps.value.map(step => ({
          id: step.id,
          title: step.title,
          instruction: step.instruction,
          acceptanceCriteria: step.acceptanceCriteria,
          attachments: step.attachments,
        })),
        savedAt: Date.now(),
      }

      await persistDraft(draft)
      draftSaved.value = true
      loadedFromDraft.value = true

      setTimeout(() => {
        draftSaved.value = false
      }, 1500)
    } catch (error) {
      console.warn('[planRunner] Failed to stash draft:', error)
    } finally {
      draftSaving.value = false
    }
  }

  return {
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
  }
}
