/**
 * 改动后校验（build/test/lint）相关处理器
 *
 * 负责：
 * - 用户从 UI 触发执行校验命令（通过 execute_command 工具）
 * - 将工具调用与执行结果写入对话历史（可回放/可复现）
 */

import { t } from '../../backend/i18n';
import { registerExecuteCommand } from '../../backend/tools/terminal';
import type { Content, ContentPart, ThoughtSignatures } from '../../backend/modules/conversation/types';
import type { HandlerContext, MessageHandler } from '../types';

function findLatestThoughtSignatures(history: ReadonlyArray<Content>): ThoughtSignatures | undefined {
  for (let i = history.length - 1; i >= 0; i--) {
    const message = history[i];
    const parts = Array.isArray(message?.parts) ? message.parts : [];

    for (let j = parts.length - 1; j >= 0; j--) {
      const part = parts[j] as any;
      if (!part || typeof part !== 'object') continue;

      if (part.thoughtSignatures && typeof part.thoughtSignatures === 'object') {
        const signatures = part.thoughtSignatures as ThoughtSignatures;
        const hasAnySignature = Object.values(signatures).some(v => typeof v === 'string' && v.trim().length > 0);
        if (hasAnySignature) return signatures;
      }

      // 向后兼容：旧格式可能是 thoughtSignature（单数，Gemini 原始字段）
      if (typeof part.thoughtSignature === 'string' && part.thoughtSignature.trim().length > 0) {
        return { gemini: part.thoughtSignature.trim() };
      }
    }
  }

  return undefined;
}

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

  // 兼容 Gemini Thinking：在 function_call 流程中需要回传 thoughtSignature。
  // 校验预设是“用户主动触发”的本地工具执行，但为了不破坏后续对话请求的历史结构，
  // 这里复用最近一次模型输出里保存的 thoughtSignatures（如果有）。
  let latestThoughtSignatures: ThoughtSignatures | undefined;
  try {
    const history = await ctx.conversationManager.getHistory(conversationId);
    latestThoughtSignatures = findLatestThoughtSignatures(history);
  } catch {
    // ignore: absence of history/signatures should not block running the command
  }

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
        },
        ...(latestThoughtSignatures ? { thoughtSignatures: latestThoughtSignatures } : {})
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
