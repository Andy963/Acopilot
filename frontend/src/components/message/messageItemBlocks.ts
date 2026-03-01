import type { Message, ToolUsage } from '../../types'

export interface RenderBlock {
  type: 'text' | 'tool' | 'thought' | 'thoughtTool'
  text?: string
  tools?: ToolUsage[]
}

const TOOL_CALL_START = '<<<TOOL_CALL>>>'
const TOOL_CALL_END = '<<<END_TOOL_CALL>>>'

const XML_TOOL_START = '<tool_use>'
const XML_TOOL_END = '</tool_use>'

function filterToolCallMarkers(text: string): string {
  let result = text

  if (result.includes(TOOL_CALL_START)) {
    const jsonRegex = new RegExp(
      TOOL_CALL_START.replace(/[<>]/g, '\\$&') + '[\\s\\S]*?' + TOOL_CALL_END.replace(/[<>]/g, '\\$&'),
      'g'
    )
    result = result.replace(jsonRegex, '')

    const jsonStartIdx = result.indexOf(TOOL_CALL_START)
    if (jsonStartIdx !== -1) {
      result = result.substring(0, jsonStartIdx)
    }
  }

  if (result.includes(XML_TOOL_START)) {
    const xmlRegex = new RegExp(
      XML_TOOL_START.replace(/[<>]/g, '\\$&') + '[\\s\\S]*?' + XML_TOOL_END.replace(/[<>]/g, '\\$&'),
      'g'
    )
    result = result.replace(xmlRegex, '')

    const xmlStartIdx = result.indexOf(XML_TOOL_START)
    if (xmlStartIdx !== -1) {
      result = result.substring(0, xmlStartIdx)
    }
  }

  return result.trim()
}

export function buildRenderBlocks(message: Message): RenderBlock[] {
  const parts = message.parts
  if (!parts || parts.length === 0) {
    return []
  }

  const blocks: RenderBlock[] = []
  let currentTextBlock: string[] = []
  let currentToolBlock: ToolUsage[] = []
  let currentThoughtBlock: string[] = []

  const flushText = () => {
    if (currentTextBlock.length === 0) return
    const text = filterToolCallMarkers(currentTextBlock.join(''))
    if (text.trim()) {
      blocks.push({ type: 'text', text })
    }
    currentTextBlock = []
  }

  const flushTools = () => {
    if (currentToolBlock.length === 0) return
    blocks.push({ type: 'tool', tools: [...currentToolBlock] })
    currentToolBlock = []
  }

  const flushThought = () => {
    if (currentThoughtBlock.length === 0) return
    const text = currentThoughtBlock.join('')
    if (text.trim()) {
      blocks.push({ type: 'thought', text })
    }
    currentThoughtBlock = []
  }

  for (const part of parts) {
    if (part.thought && part.text) {
      flushText()
      flushTools()
      currentThoughtBlock.push(part.text)
      continue
    }

    if (part.text) {
      flushThought()
      flushTools()
      currentTextBlock.push(part.text)
    }

    if (part.functionCall) {
      flushText()
      flushThought()

      const toolId = part.functionCall.id || ''
      const existingTool = message.tools?.find((t) => t.id === toolId)

      currentToolBlock.push({
        id: toolId,
        name: part.functionCall.name,
        args: part.functionCall.args,
        status: existingTool?.status,
        result: existingTool?.result
      })
    }
  }

  flushThought()
  flushText()
  flushTools()

  return blocks
}

export function mergeThoughtToolBlocks(blocks: RenderBlock[]): RenderBlock[] {
  if (!blocks.length) return []

  const merged: RenderBlock[] = []

  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index]
    const next = blocks[index + 1]

    if (block.type === 'thought' && next?.type === 'tool') {
      merged.push({
        type: 'thoughtTool',
        text: block.text,
        tools: next.tools
      })
      index++
      continue
    }

    merged.push(block)
  }

  return merged
}

