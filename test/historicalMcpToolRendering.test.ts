import { describe, expect, it } from 'vitest'

import { getToolIcon, getToolLabel } from '../frontend/src/components/message/toolMessageUtils'
import { renderDefaultToolContent } from '../frontend/src/components/message/useToolMessage'
import type { ToolUsage } from '../frontend/src/types'

describe('historical MCP tool rendering', () => {
  it('uses the generic renderer for stored tool calls after MCP removal', () => {
    const tool: ToolUsage = {
      id: 'legacy-tool-1',
      name: 'mcp__legacy__lookup',
      args: { query: 'example' },
      result: { value: 42 },
      error: 'Legacy server unavailable',
      status: 'error',
    }
    const translate = (key: string) => key

    expect(getToolLabel(tool)).toBe('mcp__legacy__lookup')
    expect(getToolIcon(tool)).toBe('codicon-tools')

    const vnode = renderDefaultToolContent(tool, translate)
    const sections = vnode.children as any[]

    expect(sections).toHaveLength(3)
    expect(sections[0].children[1].children).toContain('"query": "example"')
    expect(sections[1].children[1].children).toContain('"value": 42')
    expect(sections[2].children[1].children).toBe('Legacy server unavailable')
  })
})
