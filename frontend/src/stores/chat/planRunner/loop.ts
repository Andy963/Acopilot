import { watch } from 'vue'
import type { Attachment } from '../../../types'
import type { ChatStoreComputed, ChatStoreState, PlanRunnerData, PlanRunnerStep } from '../types'
import { continueAfterToolExecution, sendMessage } from '../messageActions'
import { persistPlanRunnerState } from './persistence'

let loopInProgress = false

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
      const att = attachments[i] as Attachment
      const alias = `S${stepIndex + 1}A${i + 1}`
      const mime = att?.mimeType ? ` (${att.mimeType})` : ''
      attachmentLines.push(`- [${alias}] ${att?.name || 'attachment'}${mime}`)
    }
    attachmentLines.push(
      '',
      'Note: These attachments are provided directly as multimodal inputs for this step. Do NOT use read_file on the attachment names; they may not exist on disk. Refer to attachments using the aliases above.',
    )
  }

  const blocks: string[] = [header]
  if (contextLines.length > 0) blocks.push('', ...contextLines)
  if (attachmentLines.length > 0) blocks.push('', ...attachmentLines)
  blocks.push('', step.instruction)

  const stepAcceptanceCriteria = step.acceptanceCriteria?.trim() || ''
  if (stepAcceptanceCriteria) {
    blocks.push(
      '',
      'Step Acceptance Criteria (optional):',
      stepAcceptanceCriteria,
      '',
      'After you finish this step, end your reply with exactly one line:',
      '- ACCEPTANCE: PASS',
      '- or ACCEPTANCE: FAIL - <reason>',
    )
  }

  return blocks.join('\n')
}

type StepAcceptanceResult = { status: 'pass' } | { status: 'fail'; reason?: string }

function getLatestAssistantContent(state: ChatStoreState): string {
  const messages = state.allMessages.value
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as any
    if (msg?.role === 'assistant' && typeof msg.content === 'string' && msg.content.trim()) {
      return msg.content
    }
  }
  return ''
}

function parseAcceptanceResult(text: string): StepAcceptanceResult | null {
  if (!text) return null

  const tailLines = text.split(/\r?\n/).slice(-40)
  for (let i = tailLines.length - 1; i >= 0; i--) {
    const line = tailLines[i].trim()
    if (!line) continue

    const match = line.match(/^ACCEPTANCE\s*:\s*(PASS|FAIL)(?:\s*[-–—:]?\s*(.*))?\s*$/i)
    if (!match) continue

    const verdict = match[1].toLowerCase()
    const rest = (match[2] || '').trim()

    if (verdict === 'pass') return { status: 'pass' }
    return { status: 'fail', reason: rest || undefined }
  }

  return null
}

async function waitForResponseDone(state: ChatStoreState): Promise<void> {
  if (!state.isWaitingForResponse.value) return

  await new Promise<void>((resolve) => {
    let stop: (() => void) | null = null
    stop = watch(
      () => state.isWaitingForResponse.value,
      (waiting) => {
        if (waiting) return
        stop?.()
        resolve()
      },
    )
  })
}

async function runPlanLoop(state: ChatStoreState, computed: ChatStoreComputed): Promise<void> {
  while (true) {
    const runner = state.planRunner.value
    if (!runner) return
    if (runner.status !== 'running') return

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

    await waitForResponseDone(state)
    if (!state.planRunner.value || state.planRunner.value.status !== 'running') return

    await sendMessage(state, computed, buildStepPrompt(runner, stepIndex, step), step.attachments, { chatMode: 'agent' })
    await waitForResponseDone(state)

    const stepAcceptanceCriteria = step.acceptanceCriteria?.trim() || ''

    if (state.planRunner.value?.status === 'running' && computed.needsContinueButton.value) {
      step.status = 'error'
      step.errorCode = 'NEEDS_CONTINUE'
      step.error = '工具执行完成，等待继续生成最终回复'
      step.endedAt = Date.now()
      runner.status = 'paused'
      await persistPlanRunnerState(state)
      return
    }

    if (state.error.value) {
      step.status = 'error'
      step.error = state.error.value.message
      step.errorCode = state.error.value.code
      step.endedAt = Date.now()
      runner.status = 'paused'
      await persistPlanRunnerState(state)
      return
    }

    const latestRunner = state.planRunner.value as PlanRunnerData | null
    if (latestRunner?.status === 'cancelled') {
      step.status = 'cancelled'
      step.endedAt = Date.now()
      await persistPlanRunnerState(state)
      return
    }

    if (stepAcceptanceCriteria) {
      const latestAssistant = getLatestAssistantContent(state)
      const acceptance = parseAcceptanceResult(latestAssistant)

      if (!acceptance) {
        step.status = 'error'
        step.error = '未检测到验收结果标记（请在回复末尾包含：ACCEPTANCE: PASS 或 ACCEPTANCE: FAIL - 原因）'
        step.endedAt = Date.now()
        runner.status = 'paused'
        await persistPlanRunnerState(state)
        return
      }

      if (acceptance.status === 'fail') {
        step.status = 'error'
        step.error = acceptance.reason ? `验收未通过：${acceptance.reason}` : '验收未通过'
        step.endedAt = Date.now()
        runner.status = 'paused'
        await persistPlanRunnerState(state)
        return
      }
    }

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
  stepIndex: number,
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

export async function continuePlanRunner(state: ChatStoreState, computed: ChatStoreComputed): Promise<void> {
  const runner = state.planRunner.value
  if (!runner) return
  if (runner.status !== 'paused') return
  if (loopInProgress) return
  if (state.isWaitingForResponse.value) return

  const stepIndex = runner.currentStepIndex
  if (!Number.isFinite(stepIndex) || stepIndex < 0 || stepIndex >= runner.steps.length) return

  const step = runner.steps[stepIndex]
  const code = step.errorCode
  const canContinue = step.status === 'error' && (code === 'NEEDS_CONTINUE' || code === 'MAX_TOOL_ITERATIONS')
  if (!canContinue) return

  step.error = undefined
  await persistPlanRunnerState(state)

  loopInProgress = true
  try {
    const continuePrompt = step.acceptanceCriteria?.trim()
      ? [
          '继续完成上一条回复（PlanRunner 当前步骤），不要重复执行任何工具/命令；仅基于已经产生的工具结果继续回答。',
          '请在回复最后一行按要求输出：ACCEPTANCE: PASS 或 ACCEPTANCE: FAIL - <reason>。',
        ].join('\n')
      : '继续完成上一条回复（PlanRunner 当前步骤），不要重复执行任何工具/命令；仅基于已经产生的工具结果继续回答。'

    await continueAfterToolExecution(state, computed, continuePrompt)
    await waitForResponseDone(state)

    if (state.error.value) {
      step.status = 'error'
      step.error = state.error.value.message
      step.errorCode = state.error.value.code
      step.endedAt = Date.now()
      runner.status = 'paused'
      await persistPlanRunnerState(state)
      return
    }

    const stepAcceptanceCriteria = step.acceptanceCriteria?.trim() || ''
    if (stepAcceptanceCriteria) {
      const latestAssistant = getLatestAssistantContent(state)
      const acceptance = parseAcceptanceResult(latestAssistant)
      if (!acceptance) {
        step.status = 'error'
        step.errorCode = 'ACCEPTANCE_MISSING'
        step.error = '未检测到验收结果标记（请在回复末尾包含：ACCEPTANCE: PASS 或 ACCEPTANCE: FAIL - 原因）'
        step.endedAt = Date.now()
        runner.status = 'paused'
        await persistPlanRunnerState(state)
        return
      }
      if (acceptance.status === 'fail') {
        step.status = 'error'
        step.errorCode = 'ACCEPTANCE_FAIL'
        step.error = acceptance.reason ? `验收未通过：${acceptance.reason}` : '验收未通过'
        step.endedAt = Date.now()
        runner.status = 'paused'
        await persistPlanRunnerState(state)
        return
      }
    }

    step.status = 'success'
    step.endedAt = Date.now()
    step.error = undefined
    step.errorCode = undefined
    runner.currentStepIndex = stepIndex + 1
    runner.status = runner.pauseRequested ? 'paused' : 'running'
    runner.pauseRequested = false
    await persistPlanRunnerState(state)

    if (runner.status === 'running') {
      await runPlanLoop(state, computed)
    }
  } finally {
    loopInProgress = false
  }
}

export async function runSinglePlanRunnerStep(
  state: ChatStoreState,
  computed: ChatStoreComputed,
  stepIndex: number,
): Promise<void> {
  const runner = state.planRunner.value
  if (!runner) return
  if (runner.status === 'running') return
  if (loopInProgress) return
  if (state.isWaitingForResponse.value) return
  if (!Number.isFinite(stepIndex)) return
  if (runner.steps.length === 0) return

  const targetIndex = Math.max(0, Math.min(Math.floor(stepIndex), runner.steps.length - 1))
  const step = runner.steps[targetIndex]

  step.status = 'pending'
  step.startedAt = undefined
  step.endedAt = undefined
  step.error = undefined

  runner.currentStepIndex = targetIndex
  runner.status = 'running'
  runner.pauseRequested = true

  await persistPlanRunnerState(state)

  loopInProgress = true
  try {
    await runPlanLoop(state, computed)
  } finally {
    loopInProgress = false
  }
}

