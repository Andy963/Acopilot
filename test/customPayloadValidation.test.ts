import { describe, expect, it } from 'vitest'

import {
  getLineColumn,
  validateAdvancedBodyJson,
  validateCustomHeaders,
  validateDottedBodyKeys,
} from '../frontend/src/components/settings/channels/customPayloadValidation'

describe('custom payload validation', () => {
  it('accepts empty and object-root advanced JSON', () => {
    expect(validateAdvancedBodyJson('')).toBeNull()
    expect(validateAdvancedBodyJson('{"extra_body":{"foo":true}}')).toBeNull()
  })

  it('rejects non-object advanced JSON roots', () => {
    expect(validateAdvancedBodyJson('[]')).toMatchObject({ code: 'rootMustBeObject' })
    expect(validateAdvancedBodyJson('"text"')).toMatchObject({ code: 'rootMustBeObject' })
  })

  it('reports JSON syntax locations when the runtime exposes a parse position', () => {
    expect(getLineColumn('{\n  "a": 1,\n  }', 13)).toEqual({ line: 3, column: 2 })
    const issue = validateAdvancedBodyJson('{\n  "a": 1,\n  }')
    expect(issue?.code).toBe('invalidJson')
    expect(issue?.detail).toBeTruthy()
  })

  it('validates simple body dotted keys', () => {
    const issues = validateDottedBodyKeys([
      { key: 'extra_body.google', enabled: true },
      { key: 'extra_body..bad', enabled: true },
      { key: 'EXTRA_BODY.GOOGLE', enabled: true },
      { key: '', enabled: true },
      { key: '', enabled: false },
    ])

    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'emptyPathSegment', index: 1 }),
      expect.objectContaining({ code: 'duplicateKey', index: 0 }),
      expect.objectContaining({ code: 'duplicateKey', index: 2 }),
      expect.objectContaining({ code: 'emptyKey', index: 3 }),
    ]))
  })

  it('validates enabled custom headers', () => {
    const issues = validateCustomHeaders([
      { key: 'X-Test', enabled: true },
      { key: 'x-test', enabled: true },
      { key: 'Bad Header', enabled: true },
      { key: '', enabled: true },
      { key: '', enabled: false },
    ])

    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'duplicateKey', index: 0 }),
      expect.objectContaining({ code: 'duplicateKey', index: 1 }),
      expect.objectContaining({ code: 'invalidHeaderName', index: 2 }),
      expect.objectContaining({ code: 'emptyKey', index: 3 }),
    ]))
  })
})
