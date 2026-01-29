export type ThinkingEffort = 'low' | 'medium' | 'high' | 'xhigh'

export const THINKING_EFFORT_OPTIONS: readonly ThinkingEffort[] = [
  'low',
  'medium',
  'high',
  'xhigh'
] as const

export function isThinkingEffort(value: unknown): value is ThinkingEffort {
  return THINKING_EFFORT_OPTIONS.includes(value as ThinkingEffort)
}

export function isOpenAIProtocolConfigType(configType: unknown): boolean {
  const type = String(configType || '').trim()
  // Treat OpenAI Responses as OpenAI protocol for UI gating purposes.
  return type === 'openai' || type === 'openai-responses'
}

export function isThinkingEffortVisibleForModel(input: {
  configType: unknown
  modelId: unknown
  modelName?: unknown
}): boolean {
  if (!isOpenAIProtocolConfigType(input.configType)) return false

  const modelId = String(input.modelId || '').trim()
  const modelName = String(input.modelName || '').trim()
  if (!modelId && !modelName) return false

  // The requirement gates on model name containing "gpt" (case-insensitive).
  const haystack = `${modelId} ${modelName}`.toLowerCase()
  return haystack.includes('gpt')
}

