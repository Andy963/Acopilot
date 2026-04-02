export type ValidationPresetKind = 'build' | 'test' | 'lint' | 'custom'

export interface ValidationPresetInput {
  id?: string
  label?: string
  command?: string
  cwd?: string
  shell?: string
  timeout?: number
  kind?: ValidationPresetKind
  enabled?: boolean
}

export interface RunnableValidationPreset {
  id: string
  label: string
  command: string
  cwd?: string
  shell?: string
  timeout?: number
  kind?: ValidationPresetKind
  enabled: true
}

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function normalizeTimeout(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function hashPresetIdentity(input: string): string {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `validation_preset_${(hash >>> 0).toString(36)}`
}

function buildStablePresetId(preset: ValidationPresetInput, command: string): string {
  const providedId = normalizeText(preset.id)
  if (providedId) return providedId

  const identity = JSON.stringify({
    label: normalizeText(preset.label) || '',
    command,
    cwd: normalizeText(preset.cwd) || '',
    shell: normalizeText(preset.shell) || '',
    timeout: normalizeTimeout(preset.timeout) ?? '',
    kind: normalizeText(preset.kind) || '',
  })

  return hashPresetIdentity(identity)
}

function buildDisplayLabel(preset: ValidationPresetInput): string {
  return normalizeText(preset.label) || normalizeText(preset.kind) || 'Run'
}

export function toRunnableValidationPreset(preset: ValidationPresetInput | null | undefined): RunnableValidationPreset | null {
  if (!preset || preset.enabled === false) return null

  const command = normalizeText(preset.command)
  if (!command) return null

  return {
    id: buildStablePresetId(preset, command),
    label: buildDisplayLabel(preset),
    command,
    cwd: normalizeText(preset.cwd),
    shell: normalizeText(preset.shell),
    timeout: normalizeTimeout(preset.timeout),
    kind: preset.kind,
    enabled: true,
  }
}

export function getRunnableValidationPresets(
  presets: ReadonlyArray<ValidationPresetInput | null | undefined> | unknown,
): RunnableValidationPreset[] {
  if (!Array.isArray(presets)) return []

  return presets
    .map((preset) => toRunnableValidationPreset(preset))
    .filter((preset): preset is RunnableValidationPreset => preset !== null)
}

export function getValidationPresetMetadata(args: Record<string, unknown> | null | undefined): {
  id?: string
  label?: string
} | null {
  if (!args) return null

  const id = normalizeText(args.validationPresetId)
  const label = normalizeText(args.validationPresetLabel)

  if (!id && !label) return null
  return { id, label }
}
