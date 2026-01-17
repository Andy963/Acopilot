/**
 * 改动后校验（build/test/lint）动作
 *
 * - 由 UI 触发执行 execute_command
 * - 将结果以 functionResponse 形式写回对话流（便于后续复现/追踪）
 */

import type { Message } from '../../types'
import type { ChatStoreState } from './types'
import { sendToExtension } from '../../utils/vscode'
import { generateId } from '../../utils/format'

export interface ValidationCommandPreset {
  label?: string
  command: string
  cwd?: string
  shell?: string
  timeout?: number
}

/**
 * 运行校验命令（通过 execute_command 工具）
 */
export async function runPostEditValidationCommand(
  state: ChatStoreState,
  preset: ValidationCommandPreset
): Promise<void> {
  if (!state.currentConversationId.value) return
  if (!preset?.command) return

  const toolCallId = `terminal_${generateId()}`
  const now = Date.now()

  const toolArgs: Record<string, unknown> = {
    command: preset.command
  }
  if (preset.cwd) toolArgs.cwd = preset.cwd
  if (preset.shell) toolArgs.shell = preset.shell
  if (typeof preset.timeout === 'number') toolArgs.timeout = preset.timeout

  // 1) 先在前端插入一个工具调用消息，立即显示并接收实时输出
  state.allMessages.value.push({
    id: generateId(),
    role: 'assistant',
    content: '',
    timestamp: now,
    parts: [
      {
        functionCall: {
          name: 'execute_command',
          args: toolArgs,
          id: toolCallId
        }
      }
    ],
    tools: [
      {
        id: toolCallId,
        name: 'execute_command',
        args: toolArgs,
        status: 'running'
      }
    ]
  } as unknown as Message)

  // 2) 让后端真正执行命令，并将结果写入后端对话历史
  let result: Record<string, unknown> | null = null
  try {
    const resp = await sendToExtension<{ success: boolean; toolCallId: string; result: Record<string, unknown> }>(
      'validation.runCommand',
      {
        conversationId: state.currentConversationId.value,
        toolCallId,
        ...toolArgs
      }
    )
    if (resp?.result) {
      result = resp.result
    }
  } catch (err: any) {
    result = {
      success: false,
      error: err?.message || 'Failed to run validation command'
    }
  }

  // 3) 将 functionResponse 追加到消息流（UI 通过 toolCallId 匹配响应）
  state.allMessages.value.push({
    id: generateId(),
    role: 'user',
    content: '',
    timestamp: Date.now(),
    isFunctionResponse: true,
    parts: [
      {
        functionResponse: {
          name: 'execute_command',
          response: result || { success: false, error: 'Unknown error' },
          id: toolCallId
        }
      }
    ]
  } as unknown as Message)
}

