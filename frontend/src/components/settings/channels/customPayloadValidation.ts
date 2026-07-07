export interface ValidationIssue {
  code: string
  index?: number
  line?: number
  column?: number
  detail?: string
}

export interface CustomPayloadItem {
  key: string
  enabled: boolean
}

export function getLineColumn(input: string, position: number): { line: number; column: number } {
  const before = input.slice(0, Math.max(0, position))
  const lines = before.split('\n')
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  }
}

function getSyntaxErrorPosition(message: string): number | undefined {
  const match = message.match(/position\s+(\d+)/i)
  if (!match) return undefined
  const position = Number(match[1])
  return Number.isFinite(position) ? position : undefined
}

export function validateAdvancedBodyJson(input: string): ValidationIssue | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    const position = getSyntaxErrorPosition(detail)
    const location = position === undefined ? undefined : getLineColumn(trimmed, position)
    return {
      code: 'invalidJson',
      detail,
      line: location?.line,
      column: location?.column,
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { code: 'rootMustBeObject' }
  }

  return null
}

export function validateDottedBodyKeys(items: CustomPayloadItem[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const seen = new Map<string, number>()

  for (const [index, item] of items.entries()) {
    if (!item.enabled) continue

    const key = item.key.trim()
    const normalized = key.toLowerCase()
    if (!key) {
      issues.push({ code: 'emptyKey', index })
      continue
    }

    if (key.split('.').some(part => part.trim() === '')) {
      issues.push({ code: 'emptyPathSegment', index })
    }

    if (seen.has(normalized)) {
      issues.push({ code: 'duplicateKey', index })
      issues.push({ code: 'duplicateKey', index: seen.get(normalized) })
    } else {
      seen.set(normalized, index)
    }
  }

  return issues
}

const HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/

export function validateCustomHeaders(headers: CustomPayloadItem[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const seen = new Map<string, number>()

  for (const [index, header] of headers.entries()) {
    if (!header.enabled) continue

    const key = header.key.trim()
    const normalized = key.toLowerCase()
    if (!key) {
      issues.push({ code: 'emptyKey', index })
      continue
    }

    if (!HEADER_NAME_PATTERN.test(key)) {
      issues.push({ code: 'invalidHeaderName', index })
    }

    if (seen.has(normalized)) {
      issues.push({ code: 'duplicateKey', index })
      issues.push({ code: 'duplicateKey', index: seen.get(normalized) })
    } else {
      seen.set(normalized, index)
    }
  }

  return issues
}
