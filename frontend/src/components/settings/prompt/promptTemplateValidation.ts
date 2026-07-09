import { AVAILABLE_PROMPT_MODULES } from './types'

export type PromptValidationIssueType = 'error' | 'warning'

export interface PromptValidationIssue {
  type: PromptValidationIssueType
  key: 'emptyTemplate' | 'unknownVariables' | 'duplicateVariables'
  variables?: string[]
}

const availableModuleIds = new Set(AVAILABLE_PROMPT_MODULES.map(module => module.id))

function isKnownPromptVariable(moduleId: string): boolean {
  if (availableModuleIds.has(moduleId)) return true
  return moduleId.startsWith('PINNED_PROMPT:') && moduleId.slice('PINNED_PROMPT:'.length).trim().length > 0
}

export function extractPromptVariables(template: string): string[] {
  return [...template.matchAll(/\{\{\$([^}]+)\}\}/g)].map(match => match[1])
}

export function validatePromptTemplate(template: string): PromptValidationIssue[] {
  if (!template.trim()) {
    return [{ type: 'error', key: 'emptyTemplate' }]
  }

  const variables = extractPromptVariables(template)
  const unknownVariables = [...new Set(variables.filter(moduleId => !isKnownPromptVariable(moduleId)))]
  const duplicateVariables = [...new Set(variables.filter((moduleId, index) => variables.indexOf(moduleId) !== index))]
  const issues: PromptValidationIssue[] = []

  if (unknownVariables.length > 0) {
    issues.push({ type: 'error', key: 'unknownVariables', variables: unknownVariables })
  }

  if (duplicateVariables.length > 0) {
    issues.push({ type: 'warning', key: 'duplicateVariables', variables: duplicateVariables })
  }

  return issues
}
