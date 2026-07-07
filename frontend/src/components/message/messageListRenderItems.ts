import type { CheckpointRecord, Message, ToolUsage } from '../../types'
import { isReadOnlyShellCommand } from '../../utils/commandReadOnly'

interface EnhancedMessage {
  message: Message
  actualIndex: number
  beforeCheckpoints: CheckpointRecord[]
  afterCheckpoints: CheckpointRecord[]
}

export interface MessageRenderItem extends EnhancedMessage {
  kind: 'message'
}

export interface ToolGroupRenderItem {
  kind: 'toolGroup'
  id: string
  toolName: string
  messages: Message[]
}

export type RenderItem = MessageRenderItem | ToolGroupRenderItem

const READ_ONLY_TOOL_NAMES = new Set<string>([
  'read_file',
  'list_files',
  'search_in_files',
  'find_files',
  'get_symbols',
  'goto_definition',
  'find_references',
  'get_usages',
  'get_errors',
  'open_file'
])

function isToolOnlyMessage(message: Message): boolean {
  if (message.role !== 'assistant') return false
  if (message.isSummary) return false
  if (typeof message.content === 'string' && message.content.trim()) return false
  if (!Array.isArray(message.tools) || message.tools.length === 0) return false
  return true
}

function getSingleToolName(message: Message): string | null {
  if (!Array.isArray(message.tools) || message.tools.length === 0) return null
  const first = message.tools[0]?.name
  if (typeof first !== 'string' || !first) return null
  if (!message.tools.every((t) => t?.name === first)) return null
  return first
}

function didExecuteCommandChangeWorkspace(result: Record<string, unknown> | null | undefined): boolean | null {
  const summary = (result as any)?.data?.changesSummary as any
  if (!summary || typeof summary !== 'object') return false
  if (summary.unsupportedReason) return null
  const total = Number(summary.totalFiles)
  if (!Number.isFinite(total)) return null
  return total > 0
}

function isReadOnlyExecuteCommandTool(
  tool: ToolUsage,
  getToolResponseById: (id: string) => Record<string, unknown> | null
): boolean {
  if (tool.name !== 'execute_command') return false
  if (tool.status === 'running' || tool.status === 'pending') return false
  const args = (tool.args ?? {}) as Record<string, any>
  const command = typeof args.command === 'string' ? args.command : ''
  if (!isReadOnlyShellCommand(command)) return false

  const effectiveResult = (tool.result as Record<string, unknown> | undefined) ?? (tool.id ? getToolResponseById(tool.id) : null)

  if (!effectiveResult) return false

  const changed = didExecuteCommandChangeWorkspace(effectiveResult)
  if (changed === null) return false
  return changed === false
}

function getGroupableToolName(
  message: Message,
  getToolResponseById: (id: string) => Record<string, unknown> | null
): string | null {
  if (!isToolOnlyMessage(message)) return null
  const name = getSingleToolName(message)
  if (!name) return null

  if (name === 'execute_command') {
    const tools = message.tools || []
    return tools.length > 0 && tools.every((t) => isReadOnlyExecuteCommandTool(t, getToolResponseById)) ? name : null
  }

  return READ_ONLY_TOOL_NAMES.has(name) ? name : null
}

export function buildMessageListRenderItems(options: {
  messages: Message[]
  visibleCount: number
  allMessages: Message[]
  checkpoints: CheckpointRecord[]
  getToolResponseById: (toolId: string) => Record<string, unknown> | null
}): RenderItem[] {
  const { messages, visibleCount, allMessages, checkpoints, getToolResponseById } = options

  const total = messages.length
  const startIndex = Math.max(0, total - visibleCount)

  const visibleSlice = messages.slice(startIndex)
  const lastSummaryBeforeVisibleRange = messages
    .slice(0, startIndex)
    .reverse()
    .find((message) => message.isSummary === true)
  const renderSlice = lastSummaryBeforeVisibleRange
    ? [...visibleSlice, lastSummaryBeforeVisibleRange]
    : visibleSlice

  const idToActualIndex = new Map<string, number>()
  allMessages.forEach((m, idx) => {
    idToActualIndex.set(m.id, idx)
  })

  const checkpointsByMsgIndex = new Map<number, { before: CheckpointRecord[]; after: CheckpointRecord[] }>()
  checkpoints.forEach((cp) => {
    if (!checkpointsByMsgIndex.has(cp.messageIndex)) {
      checkpointsByMsgIndex.set(cp.messageIndex, { before: [], after: [] })
    }
    const group = checkpointsByMsgIndex.get(cp.messageIndex)!
    if (cp.phase === 'before') group.before.push(cp)
    else group.after.push(cp)
  })

  const enhanced: EnhancedMessage[] = renderSlice.map((message) => {
    const actualIndex = idToActualIndex.get(message.id) ?? -1
    const cpGroup = actualIndex !== -1 ? checkpointsByMsgIndex.get(actualIndex) : null

    return {
      message,
      actualIndex,
      beforeCheckpoints: cpGroup?.before || [],
      afterCheckpoints: cpGroup?.after || []
    }
  })

  const grouped: RenderItem[] = []
  let buffer: EnhancedMessage[] = []
  let bufferToolName = ''

  const flush = () => {
    if (buffer.length === 0) return
    if (buffer.length === 1) {
      grouped.push({ kind: 'message', ...buffer[0] })
      buffer = []
      bufferToolName = ''
      return
    }

    grouped.push({
      kind: 'toolGroup',
      id: `tool_msg_group:${bufferToolName}:${buffer[0].message.id}`,
      toolName: bufferToolName,
      messages: buffer.map((b) => b.message)
    })
    buffer = []
    bufferToolName = ''
  }

  for (const item of enhanced) {
    const toolName = getGroupableToolName(item.message, getToolResponseById)
    if (toolName) {
      if (buffer.length === 0 || bufferToolName === toolName) {
        buffer.push(item)
        bufferToolName = toolName
        continue
      }

      flush()
      buffer.push(item)
      bufferToolName = toolName
      continue
    }

    flush()
    grouped.push({ kind: 'message', ...item })
  }

  flush()
  return grouped
}

