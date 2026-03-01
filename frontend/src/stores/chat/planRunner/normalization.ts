import type { PlanRunnerData, PlanRunnerStep } from '../types'
import type { Attachment } from '../../../types'
import { generateId } from '../../../utils/format'

export interface PlanRunnerCreateInput {
  title: string
  goal?: string
  acceptanceCriteria?: string
  steps: Array<{
    title: string
    instruction: string
    acceptanceCriteria?: string
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
    metadata: isRecord((raw as any).metadata) ? (raw as any).metadata : undefined,
  }
}

function normalizeAttachments(value: unknown): Attachment[] | undefined {
  if (!Array.isArray(value)) return undefined
  const normalized = value.map(normalizeAttachment).filter(Boolean) as Attachment[]
  return normalized.length > 0 ? normalized : undefined
}

export function normalizeLoadedPlanRunner(raw: unknown): PlanRunnerData | null {
  if (!isRecord(raw)) return null

  const stepsRaw = (raw as any).steps
  if (!Array.isArray(stepsRaw)) return null

  const steps: PlanRunnerStep[] = []
  for (const s of stepsRaw) {
    if (!isRecord(s)) continue
    const title = asString((s as any).title).trim()
    const instruction = asString((s as any).instruction).trim()
    const acceptanceCriteria =
      typeof (s as any).acceptanceCriteria === 'string' ? (s as any).acceptanceCriteria.trim() : undefined
    if (!title || !instruction) continue

    steps.push({
      id: asString((s as any).id || `plan_step_${generateId()}`),
      title,
      instruction,
      acceptanceCriteria: acceptanceCriteria || undefined,
      attachments: normalizeAttachments((s as any).attachments),
      status: normalizeStepStatus((s as any).status),
      startedAt: typeof (s as any).startedAt === 'number' ? (s as any).startedAt : undefined,
      endedAt: typeof (s as any).endedAt === 'number' ? (s as any).endedAt : undefined,
      error: typeof (s as any).error === 'string' ? (s as any).error : undefined,
      errorCode: typeof (s as any).errorCode === 'string' ? (s as any).errorCode : undefined,
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
    acceptanceCriteria:
      typeof (raw as any).acceptanceCriteria === 'string' ? (raw as any).acceptanceCriteria : undefined,
    createdAt: typeof (raw as any).createdAt === 'number' ? (raw as any).createdAt : Date.now(),
    status: status === 'running' ? 'paused' : status,
    currentStepIndex: Math.max(0, Math.min(currentStepIndex, steps.length)),
    steps,
    pauseRequested: status === 'running' ? false : pauseRequested,
    lastUpdatedAt: typeof (raw as any).lastUpdatedAt === 'number' ? (raw as any).lastUpdatedAt : undefined,
  }
}

