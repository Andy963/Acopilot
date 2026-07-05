import type { Attachment } from '../../../types'
import { generateId } from '../../../utils/format'

export interface StepDraft {
  id: string
  title: string
  instruction: string
  acceptanceCriteria: string
  attachments: Attachment[]
}

export interface PlanDraft {
  title: string
  goal?: string
  steps: StepDraft[]
  savedAt: number
}

export const PLAN_DRAFT_METADATA_KEY = 'planRunnerDraft'
export const PLAN_DRAFT_LOCALSTORAGE_KEY = 'acopilot.planRunnerDraft'

export function createEmptyStep(): StepDraft {
  return {
    id: `step_${generateId()}`,
    title: '',
    instruction: '',
    acceptanceCriteria: '',
    attachments: [],
  }
}

export function ensureStepDrafts(steps: StepDraft[]): StepDraft[] {
  return steps.length > 0 ? steps : [createEmptyStep()]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : String(value ?? '')
}

function normalizeAttachmentType(value: unknown): Attachment['type'] | null {
  const normalized = asString(value).trim()
  if (normalized === 'image' || normalized === 'video' || normalized === 'audio' || normalized === 'document' || normalized === 'code') {
    return normalized
  }

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

function normalizeStepDraft(raw: unknown): StepDraft | null {
  if (!isRecord(raw)) return null

  const attachmentsRaw = (raw as any).attachments
  const attachments = Array.isArray(attachmentsRaw)
    ? (attachmentsRaw.map(normalizeAttachment).filter(Boolean) as Attachment[])
    : []

  return {
    id: asString((raw as any).id || `step_${generateId()}`),
    title: asString((raw as any).title || ''),
    instruction: asString((raw as any).instruction || ''),
    acceptanceCriteria: asString((raw as any).acceptanceCriteria || ''),
    attachments,
  }
}

export function normalizeStepDrafts(raw: unknown): StepDraft[] {
  if (!Array.isArray(raw)) return [createEmptyStep()]

  const steps = raw.map(normalizeStepDraft).filter(Boolean) as StepDraft[]
  return ensureStepDrafts(steps)
}

export function normalizeDraft(raw: unknown): PlanDraft | null {
  if (!isRecord(raw)) return null

  return {
    title: asString((raw as any).title || ''),
    goal: typeof (raw as any).goal === 'string' ? (raw as any).goal : undefined,
    steps: normalizeStepDrafts((raw as any).steps),
    savedAt: typeof (raw as any).savedAt === 'number' ? (raw as any).savedAt : Date.now(),
  }
}
