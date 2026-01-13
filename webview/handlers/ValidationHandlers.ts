/**
 * 改动后校验（build/test/lint）相关处理器
 *
 * 负责：
 * - 用户从 UI 触发执行校验命令（通过 execute_command 工具）
 * - 将工具调用与执行结果写入对话历史（可回放/可复现）
 */

import { t } from '../../backend/i18n';
import { registerExecuteCommand } from '../../backend/tools/terminal';
import type { Content, ContentPart } from '../../backend/modules/conversation/types';
import type { HandlerContext, MessageHandler } from '../types';

export const runValidationCommand: MessageHandler = async (data, requestId, ctx) => {
  const { conversationId, toolCallId, command, cwd, shell, timeout } = data || {};

  if (!conversationId || typeof conversationId !== 'string') {
    ctx.sendError(requestId, 'RUN_VALIDATION_COMMAND_ERROR', 'conversationId is required');
    return;
  }
  if (!toolCallId || typeof toolCallId !== 'string') {
    ctx.sendError(requestId, 'RUN_VALIDATION_COMMAND_ERROR', 'toolCallId is required');
    return;
  }
  if (!command || typeof command !== 'string') {
    ctx.sendError(requestId, 'RUN_VALIDATION_COMMAND_ERROR', 'command is required');
    return;
  }

  const toolArgs: Record<string, unknown> = { command };
  if (typeof cwd === 'string' && cwd.trim()) toolArgs.cwd = cwd;
  if (typeof shell === 'string' && shell.trim()) toolArgs.shell = shell;
  if (typeof timeout === 'number') toolArgs.timeout = timeout;

  // 1) 写入工具调用消息（model -> functionCall）
  const toolCallContent: Content = {
    role: 'model',
    timestamp: Date.now(),
    parts: [
      {
        functionCall: {
          name: 'execute_command',
          args: toolArgs,
          id: toolCallId
        }
      } satisfies ContentPart
    ]
  };

  try {
    await ctx.conversationManager.addContent(conversationId, toolCallContent);
  } catch (error: any) {
    ctx.sendError(requestId, 'RUN_VALIDATION_COMMAND_ERROR', error?.message || t('webview.errors.unknownError'));
    return;
  }

  // 2) 执行工具（使用 toolCallId 作为 terminalId，便于前端实时输出匹配）
  const tool = registerExecuteCommand();
  let result: Record<string, unknown>;
  try {
    result = (await tool.handler(toolArgs, { toolId: toolCallId })) as unknown as Record<string, unknown>;
  } catch (error: any) {
    result = {
      success: false,
      error: error?.message || t('webview.errors.unknownError')
    };
  }

  // 3) 写入工具响应消息（user -> functionResponse）
  const toolResponseContent: Content = {
    role: 'user',
    timestamp: Date.now(),
    isFunctionResponse: true,
    parts: [
      {
        functionResponse: {
          name: 'execute_command',
          response: result,
          id: toolCallId
        }
      } satisfies ContentPart
    ]
  };

  try {
    await ctx.conversationManager.addContent(conversationId, toolResponseContent);
  } catch {
    // 即使写入失败也不影响前端展示本次运行结果
  }

  ctx.sendResponse(requestId, { success: true, toolCallId, result });
};

/**
 * 注册改动后校验处理器
 */
export function registerValidationHandlers(registry: Map<string, MessageHandler>): void {
  registry.set('validation.runCommand', runValidationCommand);
}
