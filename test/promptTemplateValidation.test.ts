import { describe, expect, it } from 'vitest'
import { extractPromptVariables, validatePromptTemplate } from '../frontend/src/components/settings/prompt/promptTemplateValidation'

describe('prompt template validation', () => {
  it('extracts prompt variables from templates', () => {
    expect(extractPromptVariables('A {{$ENVIRONMENT}} B {{$WORKSPACE_FILES}}')).toEqual([
      'ENVIRONMENT',
      'WORKSPACE_FILES'
    ])
  })

  it('reports empty templates as blocking errors', () => {
    expect(validatePromptTemplate('   ')).toEqual([
      { type: 'error', key: 'emptyTemplate' }
    ])
  })

  it('reports unknown variables as errors', () => {
    expect(validatePromptTemplate('Use {{$ENVIRONMENT}} and {{$UNKNOWN_CONTEXT}}')).toEqual([
      { type: 'error', key: 'unknownVariables', variables: ['UNKNOWN_CONTEXT'] }
    ])
  })

  it('reports whitespace-padded variables as unknown because the backend will not expand them', () => {
    expect(validatePromptTemplate('Use {{$ ENVIRONMENT }}')).toEqual([
      { type: 'error', key: 'unknownVariables', variables: [' ENVIRONMENT '] }
    ])
  })

  it('reports duplicate variables as warnings', () => {
    expect(validatePromptTemplate('{{$ENVIRONMENT}}\n{{$ENVIRONMENT}}')).toEqual([
      { type: 'warning', key: 'duplicateVariables', variables: ['ENVIRONMENT'] }
    ])
  })
})
