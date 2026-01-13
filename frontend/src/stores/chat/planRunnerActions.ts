/**
 * Plan Runner（Plan & Run）
 *
 * - 在同一对话中按步骤逐步发送消息执行
 * - 支持暂停/继续/取消
 * - 状态持久化到 conversation custom metadata（重启后可恢复）
 */

import { watch } from 'vue'
import type { ChatStoreComputed, ChatStoreState, PlanRunnerData, PlanRunnerStep } from './types'
import type { Attachment } from '../../types'
import { sendToExtension } from '../../utils/vscode'
import { generateId } from '../../utils/format'
import { sendMessage, retryAfterError } from './messageActions'
import { cancelStream as cancelStreamFn } from './toolActions'

const PLAN_RUNNER_METADATA_KEY = 'planRunner'
const MAX_AUTO_CONTINUE = 3

let loopInProgress = false

export interface PlanRunnerCreateInput {
  title: string
  goal?: string
  acceptanceCriteria?: string
  steps: Array<{
    title: string
    instruction: string
    attachments?: Attachment[]
  }>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : String(value ?? '')
}

function normalizeStepStatus(value: unknown): PlanRunnerStep['status'] {
  const v = asString(value).trim()
  if (v === 'pending' || v === 'running' || v === 'success' || v === 'error' || v === 'cancelled') return v
  return 'pending'
}

function normalizeRunnerStatus(value: unknown): PlanRunnerData['status'] {
  const v = asString(value).trim()
  if (v === 'idle' || v === 'running' || v === 'paused' || v === 'completed' || v === 'cancelled') return v
  return 'idle'
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

function normalizeAttachments(value: unknown): Attachment[] | undefined {
  if (!Array.isArray(value)) return undefined
  const normalized = value.map(normalizeAttachment).filter(Boolean) as Attachment[]
  return normalized.length > 0 ? normalized : undefined
}

function normalizeLoadedPlanRunner(raw: unknown): PlanRunnerData | null {
  if (!isRecord(raw)) return null

  const stepsRaw = (raw as any).steps
  if (!Array.isArray(stepsRaw)) return null

  const steps: PlanRunnerStep[] = []
  for (const s of stepsRaw) {
    if (!isRecord(s)) continue
    const title = asString((s as any).title).trim()
    const instruction = asString((s as any).instruction).trim()
    if (!title || !instruction) continue

    steps.push({
      id: asString((s as any).id || `plan_step_${generateId()}`),
      title,
      instruction,
      attachments: normalizeAttachments((s as any).attachments),
      status: normalizeStepStatus((s as any).status),
      startedAt: typeof (s as any).startedAt === 'number' ? (s as any).startedAt : undefined,
      endedAt: typeof (s as any).endedAt === 'number' ? (s as any).endedAt : undefined,
      error: typeof (s as any).error === 'string' ? (s as any).error : undefined
    })
  }

  if (steps.length === 0) return null

  const currentStepIndexRaw = (raw as any).currentStepIndex
  const currentStepIndex = typeof currentStepIndexRaw === 'number' ? currentStepIndexRaw : 0

  const status = normalizeRunnerStatus((raw as any).status)
  const pauseRequested = Boolean((raw as any).pauseRequested)

  return {
    id: asString((raw as any).id || `plan_${generateId()}`),
    title: asString((raw as any).title || 'Plan').trim() || 'Plan',
    goal: typeof (raw as any).goal === 'string' ? (raw as any).goal : undefined,
    acceptanceCriteria: typeof (raw as any).acceptanceCriteria === 'string' ? (raw as any).acceptanceCriteria : undefined,
    createdAt: typeof (raw as any).createdAt === 'number' ? (raw as any).createdAt : Date.now(),
    status: status === 'running' ? 'paused' : status,
    currentStepIndex: Math.max(0, Math.min(currentStepIndex, steps.length)),
    steps,
    pauseRequested: status === 'running' ? false : pauseRequested,
    lastUpdatedAt: typeof (raw as any).lastUpdatedAt === 'number' ? (raw as any).lastUpdatedAt : undefined
  }
}

async function persistPlanRunnerState(state: ChatStoreState): Promise<void> {
  if (!state.currentConversationId.value) return

  const conversationId = state.currentConversationId.value
  const value = state.planRunner.value
    ? { ...state.planRunner.value, lastUpdatedAt: Date.now() }
    : null

  if (state.planRunner.value) {
    state.planRunner.value.lastUpdatedAt = (value as any).lastUpdatedAt
  }

  try {
    await sendToExtension('conversation.setCustomMetadata', {
      conversationId,
      key: PLAN_RUNNER_METADATA_KEY,
      value
    })
  } catch (err) {
    console.warn('[planRunner] Failed to persist state:', err)
  }
}

export async function loadPlanRunnerState(state: ChatStoreState): Promise<void> {
  if (!state.currentConversationId.value) {
    state.planRunner.value = null
    return
  }

  try {
    const meta = await sendToExtension<any>('conversation.getConversationMetadata', {
      conversationId: state.currentConversationId.value
    })
    const raw = meta?.custom?.[PLAN_RUNNER_METADATA_KEY]
    state.planRunner.value = normalizeLoadedPlanRunner(raw)

    if (state.planRunner.value) {
      await persistPlanRunnerState(state)
    }
  } catch (err) {
    console.warn('[planRunner] Failed to load state:', err)
    state.planRunner.value = null
  }
}

export async function createPlanRunner(state: ChatStoreState, input: PlanRunnerCreateInput): Promise<void> {
  const title = asString(input.title).trim()
  const goal = typeof input.goal === 'string' ? input.goal.trim() : undefined
  const acceptanceCriteria = typeof input.acceptanceCriteria === 'string' ? input.acceptanceCriteria.trim() : undefined

  const steps: PlanRunnerStep[] = (Array.isArray(input.steps) ? input.steps : [])
    .map(s => ({
      id: `plan_step_${generateId()}`,
      title: asString(s?.title).trim(),
      instruction: asString(s?.instruction).trim(),
      attachments: normalizeAttachments((s as any)?.attachments),
      status: 'pending' as const
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
    pauseRequested: false
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

function buildStepPrompt(plan: PlanRunnerData, stepIndex: number, step: PlanRunnerStep): string {
  const header = `PlanRunner Step ${stepIndex + 1}/${plan.steps.length}: ${step.title}`

  const contextLines: string[] = []
  if (plan.title) contextLines.push(`Plan: ${plan.title}`)
  if (plan.goal) contextLines.push(`Goal: ${plan.goal}`)
  if (plan.acceptanceCriteria) contextLines.push(`Acceptance: ${plan.acceptanceCriteria}`)

  const attachments = Array.isArray(step.attachments) ? step.attachments : []
  const attachmentLines: string[] = []
  if (attachments.length > 0) {
    attachmentLines.push('Attachments:')
    for (let i = 0; i < attachments.length; i++) {
      const att = attachments[i]
      const alias = `S${stepIndex + 1}A${i + 1}`
      const mime = att?.mimeType ? ` (${att.mimeType})` : ''
      attachmentLines.push(`- [${alias}] ${att?.name || 'attachment'}${mime}`)
    }
  }

  const blocks: string[] = [header]
  if (contextLines.length > 0) {
    blocks.push('', ...contextLines)
  }
  if (attachmentLines.length > 0) {
    blocks.push('', ...attachmentLines)
  }
  blocks.push('', step.instruction)

  return blocks.join('\n')
}

async function waitForResponseDone(state: ChatStoreState): Promise<void> {
  if (!state.isWaitingForResponse.value) return

  await new Promise<void>((resolve) => {
    let stop: (() => void) | null = null
    stop = watch(
      () => state.isWaitingForResponse.value,
      (waiting) => {
        if (!waiting) {
          stop?.()
          resolve()
        }
      }
    )
  })
}

async function runPlanLoop(state: ChatStoreState, computed: ChatStoreComputed): Promise<void> {
  while (true) {
    const runner = state.planRunner.value
    if (!runner) return
    if (runner.status !== 'running') return

    // 跳过已完成的步骤
    while (runner.currentStepIndex < runner.steps.length && runner.steps[runner.currentStepIndex].status === 'success') {
      runner.currentStepIndex++
    }

    if (runner.currentStepIndex >= runner.steps.length) {
      runner.status = 'completed'
      await persistPlanRunnerState(state)
      return
    }

    const stepIndex = runner.currentStepIndex
    const step = runner.steps[stepIndex]

    step.status = 'running'
    step.startedAt = Date.now()
    step.endedAt = undefined
    step.error = undefined
    await persistPlanRunnerState(state)

    // 如果当前还有在跑的请求，先等待结束（避免并发）
    await waitForResponseDone(state)
    if (!state.planRunner.value || state.planRunner.value.status !== 'running') return

    await sendMessage(state, computed, buildStepPrompt(runner, stepIndex, step), step.attachments)
    await waitForResponseDone(state)

    // 工具执行后中断：自动触发 continue（最多尝试 MAX_AUTO_CONTINUE 次）
    let continueCount = 0
    while (
      state.planRunner.value?.status === 'running' &&
      computed.needsContinueButton.value &&
      continueCount < MAX_AUTO_CONTINUE
    ) {
      continueCount++
      await retryAfterError(state, computed)
      await waitForResponseDone(state)
    }

    // stream error：暂停，等待用户介入
    if (state.error.value) {
      step.status = 'error'
      step.error = state.error.value.message
      step.endedAt = Date.now()
      runner.status = 'paused'
      await persistPlanRunnerState(state)
      return
    }

    // 取消：当前步标记为 cancelled
    if (runner.status === 'cancelled') {
      step.status = 'cancelled'
      step.endedAt = Date.now()
      await persistPlanRunnerState(state)
      return
    }

    // 用户请求暂停：当前步按成功记录，然后暂停
    if (runner.pauseRequested) {
      step.status = 'success'
      step.endedAt = Date.now()
      runner.currentStepIndex = stepIndex + 1
      runner.pauseRequested = false
      runner.status = 'paused'
      await persistPlanRunnerState(state)
      return
    }

    if (runner.status !== 'running') {
      // 被用户暂停：本步按成功记录，然后停在下一步
      step.status = 'success'
      step.endedAt = Date.now()
      runner.currentStepIndex = stepIndex + 1
      await persistPlanRunnerState(state)
      return
    }

    step.status = 'success'
    step.endedAt = Date.now()
    runner.currentStepIndex = stepIndex + 1
    await persistPlanRunnerState(state)
  }
}

export async function startPlanRunner(state: ChatStoreState, computed: ChatStoreComputed): Promise<void> {
  const runner = state.planRunner.value
  if (!runner) return
  if (runner.status === 'running') return
  if (loopInProgress) return
  if (state.isWaitingForResponse.value) return

  runner.status = 'running'
  runner.pauseRequested = false
  if (runner.currentStepIndex < 0) runner.currentStepIndex = 0
  await persistPlanRunnerState(state)

  loopInProgress = true
  try {
    await runPlanLoop(state, computed)
  } finally {
    loopInProgress = false
  }
}

export async function resumePlanRunner(state: ChatStoreState, computed: ChatStoreComputed): Promise<void> {
  const runner = state.planRunner.value
  if (!runner) return
  if (runner.status !== 'paused') return
  if (loopInProgress) return
  if (state.isWaitingForResponse.value) return

  runner.status = 'running'
  runner.pauseRequested = false
  await persistPlanRunnerState(state)

  loopInProgress = true
  try {
    await runPlanLoop(state, computed)
  } finally {
    loopInProgress = false
  }
}

export async function rerunPlanRunnerFromStep(
  state: ChatStoreState,
  computed: ChatStoreComputed,
  stepIndex: number
): Promise<void> {
  const runner = state.planRunner.value
  if (!runner) return
  if (loopInProgress) return
  if (state.isWaitingForResponse.value) return
  if (!Number.isFinite(stepIndex)) return

  const targetIndex = Math.max(0, Math.min(Math.floor(stepIndex), runner.steps.length - 1))
  if (runner.steps.length === 0) return

  for (let i = targetIndex; i < runner.steps.length; i++) {
    const step = runner.steps[i]
    step.status = 'pending'
    step.startedAt = undefined
    step.endedAt = undefined
    step.error = undefined
  }

  runner.currentStepIndex = targetIndex
  runner.pauseRequested = false
  runner.status = 'idle'

  await persistPlanRunnerState(state)
  await startPlanRunner(state, computed)
}
