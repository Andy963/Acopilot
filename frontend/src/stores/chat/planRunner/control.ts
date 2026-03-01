import { generateId } from '../../../utils/format'
import type { ChatStoreComputed, ChatStoreState, PlanRunnerStep } from '../types'
import type { Attachment } from '../../../types'
import { cancelStream as cancelStreamFn } from '../toolActions'
import { persistPlanRunnerState } from './persistence'
import type { PlanRunnerCreateInput } from './normalization'

export async function createPlanRunner(state: ChatStoreState, input: PlanRunnerCreateInput): Promise<void> {
  const title = String(input.title || '').trim()
  const goal = typeof input.goal === 'string' ? input.goal.trim() : undefined
  const acceptanceCriteria = typeof input.acceptanceCriteria === 'string' ? input.acceptanceCriteria.trim() : undefined

  const steps: PlanRunnerStep[] = (Array.isArray(input.steps) ? input.steps : [])
    .map(s => ({
      id: `plan_step_${generateId()}`,
      title: String(s?.title || '').trim(),
      instruction: String(s?.instruction || '').trim(),
      acceptanceCriteria: s.acceptanceCriteria?.trim() || undefined,
      attachments: Array.isArray((s as any)?.attachments) ? ((s as any).attachments as Attachment[]) : undefined,
      status: 'pending' as const,
    }))
    .filter(s => s.title && s.instruction)

  if (!title || steps.length === 0) return

  state.planRunner.value = {
    id: `plan_${generateId()}`,
    title,
    goal: goal || undefined,
    acceptanceCriteria: acceptanceCriteria || undefined,
    createdAt: Date.now(),
    status: 'idle',
    currentStepIndex: 0,
    steps,
    pauseRequested: false,
  }

  await persistPlanRunnerState(state)
}

export async function clearPlanRunner(state: ChatStoreState): Promise<void> {
  state.planRunner.value = null
  await persistPlanRunnerState(state)
}

export async function pausePlanRunner(state: ChatStoreState): Promise<void> {
  if (!state.planRunner.value) return
  if (state.planRunner.value.status !== 'running') return

  if (state.isWaitingForResponse.value) {
    state.planRunner.value.pauseRequested = true
  } else {
    state.planRunner.value.status = 'paused'
    state.planRunner.value.pauseRequested = false
  }

  await persistPlanRunnerState(state)
}

export async function cancelPlanRunner(state: ChatStoreState, computed: ChatStoreComputed): Promise<void> {
  if (!state.planRunner.value) return

  state.planRunner.value.status = 'cancelled'
  state.planRunner.value.pauseRequested = false
  await persistPlanRunnerState(state)

  if (state.isWaitingForResponse.value) {
    await cancelStreamFn(state, computed)
  }
}

