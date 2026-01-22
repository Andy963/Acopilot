/**
 * Acopilot - Chat 流程服务（应用服务层）
 *
 * 负责编排单次 Chat 调用的核心业务逻辑：
 * - 配置校验
 * - 对话存在性检查
 * - 用户消息写入 & checkpoint
 * - 工具调用循环（委托 ToolIterationLoopService / ToolExecutionService）
 */

import { t } from '../../../../i18n';
import type { ConfigManager } from '../../../config/ConfigManager';
import type { ChannelManager } from '../../../channel/ChannelManager';
import type { ConversationManager } from '../../../conversation/ConversationManager';
import type { SettingsManager } from '../../../settings/SettingsManager';
import type { BaseChannelConfig } from '../../../config/configs/base';
import { ChannelError, ErrorType } from '../../../channel/types';
import type { ContentPart, ContextInjectionOverrides } from '../../../conversation/types';
import type { CheckpointRecord } from '../../../checkpoint';

import type {
  ChatRequestData,
  RetryRequestData,
  EditAndRetryRequestData,
  ToolConfirmationResponseData,
  DeleteToMessageRequestData,
  DeleteToMessageSuccessData,
  DeleteToMessageErrorData,
  ChatSuccessData,
  ChatErrorData,
  ChatStreamChunkData,
  ChatStreamCompleteData,
  ChatStreamErrorData,
  ChatStreamToolIterationData,
  ChatStreamCheckpointsData,
  ChatStreamToolConfirmationData,
  ChatStreamToolsExecutingData,
} from '../types';

import type { MessageBuilderService } from './MessageBuilderService';
import type { TokenEstimationService } from './TokenEstimationService';
import {
  LOCATE_CARRYOVER_METADATA_KEY,
  buildLocateCarryoverTaskContext,
  createLocateCarryoverState,
  parseLocateCarryoverState,
} from './locateCarryover';

const OPENAI_RESPONSES_CONTINUATION_KEY = 'openaiResponsesContinuation';
import type { ToolIterationLoopService } from './ToolIterationLoopService';
import type { CheckpointService } from './CheckpointService';
import type { DiffInterruptService } from './DiffInterruptService';
import type { OrphanedToolCallService } from './OrphanedToolCallService';
import type { ToolExecutionService } from './ToolExecutionService';
import type { ToolCallParserService } from './ToolCallParserService';

export type ChatStreamOutput =
  | ChatStreamChunkData
  | ChatStreamCompleteData
  | ChatStreamErrorData
  | ChatStreamToolIterationData
  | ChatStreamCheckpointsData
  | ChatStreamToolConfirmationData
  | ChatStreamToolsExecutingData;

export class ChatFlowService {
  constructor(
    private configManager: ConfigManager,
    private conversationManager: ConversationManager,
    private settingsManager: SettingsManager | undefined,
    private messageBuilderService: MessageBuilderService,
    private tokenEstimationService: TokenEstimationService,
    private toolIterationLoopService: ToolIterationLoopService,
    private checkpointService: CheckpointService,
    private diffInterruptService: DiffInterruptService,
    private orphanedToolCallService: OrphanedToolCallService,
    private toolExecutionService: ToolExecutionService,
    private toolCallParserService: ToolCallParserService,
  ) {}

  /**
   * 获取单回合最大工具调用次数
   */
  private getMaxToolIterations(): number {
    return this.settingsManager?.getMaxToolIterations() ?? 20;
  }

  private static readonly LOCATE_TOOL_ALLOWLIST = [
    'search_in_files',
    'find_files',
    'read_file',
    'get_errors',
    'get_usages',
    'open_file'
  ] as const;

  private static readonly LOCATE_TASK_CONTEXT = [
    'LOCATE MODE:',
    '- Goal: quickly locate the relevant file/line and open it.',
    '- Do NOT modify code and do NOT propose patches.',
    '- Use tools (read/search/lsp) to narrow down the location.',
    '- Once confident, call open_file(path, start_line, start_column) to open the best match.',
    '- After opening, reply with a short note of what you opened (file:line) and wait for the user to edit.'
  ].join('\n');

  private async applyPendingLocateCarryover(
    conversationId: string,
    isLocateMode: boolean,
    taskContext: string | undefined
  ): Promise<string | undefined> {
    if (isLocateMode) return taskContext;

    const raw = await this.conversationManager.getCustomMetadata(conversationId, LOCATE_CARRYOVER_METADATA_KEY);
    const state = parseLocateCarryoverState(raw);
    if (!state || !state.pending) return taskContext;

    const carryoverBlock = buildLocateCarryoverTaskContext(state);
    const nextTaskContext = [carryoverBlock, taskContext?.trim() ? taskContext.trim() : ''].filter(Boolean).join('\n\n');

    await this.conversationManager.setCustomMetadata(conversationId, LOCATE_CARRYOVER_METADATA_KEY, {
      ...state,
      pending: false,
      updatedAt: Date.now(),
    });

    return nextTaskContext;
  }

  /**
   * 确保对话存在（不存在则创建）
   */
  private async ensureConversation(conversationId: string): Promise<void> {
    await this.conversationManager.getHistory(conversationId);
  }

  /**
   * 非流式 Chat 流程
   */
  async handleChat(request: ChatRequestData): Promise<ChatSuccessData | ChatErrorData> {
    const { conversationId, configId, message } = request;

    // 1. 确保对话存在（自动创建）
    await this.ensureConversation(conversationId);

    // 2. 验证配置
    const config = await this.configManager.getConfig(configId);
    if (!config) {
      return {
        success: false,
        error: {
          code: 'CONFIG_NOT_FOUND',
          message: t('modules.api.chat.errors.configNotFound', { configId }),
        },
      };
    }

    if (!config.enabled) {
      return {
        success: false,
        error: {
          code: 'CONFIG_DISABLED',
          message: t('modules.api.chat.errors.configDisabled', { configId }),
        },
      };
    }

    const isLocateMode = request.mode === 'locate';
    const effectiveMessage = isLocateMode ? String(message || '').replace(/^\s*\/locate\b\s*/i, '') : message;

    let effectiveContextOverrides = request.contextOverrides;
    let effectiveTaskContext = request.taskContext;

    if (isLocateMode) {
      if (this.settingsManager && this.settingsManager.isToolEnabled('locate') === false) {
        return {
          success: false,
          error: { code: 'LOCATE_DISABLED', message: 'Locate is disabled in settings.' }
        };
      }

      const locateModel = (() => {
        const cfg = this.settingsManager?.getToolsConfig?.();
        const raw = (cfg as any)?.locate?.model;
        return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
      })();

      effectiveContextOverrides = {
        ...(effectiveContextOverrides || {}),
        mode: 'locate',
        includeTools: true,
        toolAllowList: [...ChatFlowService.LOCATE_TOOL_ALLOWLIST],
        ...(locateModel ? { modelOverride: locateModel } : {}),
      };

      const userTaskContext = typeof effectiveTaskContext === 'string' && effectiveTaskContext.trim()
        ? effectiveTaskContext.trim()
        : '';
      effectiveTaskContext = [ChatFlowService.LOCATE_TASK_CONTEXT, userTaskContext].filter(Boolean).join('\n\n');

      const carryover = createLocateCarryoverState(effectiveMessage);
      if (carryover) {
        await this.conversationManager.setCustomMetadata(conversationId, LOCATE_CARRYOVER_METADATA_KEY, carryover);
      }
    }

    effectiveTaskContext = await this.applyPendingLocateCarryover(conversationId, isLocateMode, effectiveTaskContext);

    // 3. 添加用户消息到历史（包含附件）
    const userParts = this.messageBuilderService.buildUserMessageParts(effectiveMessage, request.attachments);
    await this.conversationManager.addContent(conversationId, {
      role: 'user',
      parts: userParts,
      selectionReferences: request.selectionReferences,
      taskContext: typeof effectiveTaskContext === 'string' && effectiveTaskContext.trim()
        ? effectiveTaskContext
        : undefined,
      contextOverrides: effectiveContextOverrides,
    });

    // 4. 工具调用循环（委托给 ToolIterationLoopService，非流式）
    const maxToolIterations = this.getMaxToolIterations();
    const loopResult = await this.toolIterationLoopService.runNonStreamLoop(
      conversationId,
      configId,
      config,
      maxToolIterations,
    );

    if (loopResult.exceededMaxIterations) {
      return {
        success: false,
        error: {
          code: 'MAX_TOOL_ITERATIONS',
          message: t('modules.api.chat.errors.maxToolIterations', { maxIterations: maxToolIterations }),
        },
      };
    }

    return {
      success: true,
      content: loopResult.content!,
    };
  }

  /**
   * 非流式 Retry 流程
   */
  async handleRetry(request: RetryRequestData): Promise<ChatSuccessData | ChatErrorData> {
    const { conversationId, configId } = request;

    // 1. 确保对话存在
    await this.ensureConversation(conversationId);

    // 2. 验证配置
    const config = await this.configManager.getConfig(configId);
    if (!config) {
      return {
        success: false,
        error: {
          code: 'CONFIG_NOT_FOUND',
          message: t('modules.api.chat.errors.configNotFound', { configId }),
        },
      };
    }

    if (!config.enabled) {
      return {
        success: false,
        error: {
          code: 'CONFIG_DISABLED',
          message: t('modules.api.chat.errors.configDisabled', { configId }),
        },
      };
    }

    // Retry 需要重新生成上一轮内容：清理 OpenAI Responses continuation（避免继续写在旧 response 上）
    await this.conversationManager.setCustomMetadata(
      conversationId,
      OPENAI_RESPONSES_CONTINUATION_KEY,
      null,
    );

    // 3. 工具调用循环（委托给 ToolIterationLoopService，非流式）
    const maxToolIterations = this.getMaxToolIterations();
    const loopResult = await this.toolIterationLoopService.runNonStreamLoop(
      conversationId,
      configId,
      config,
      maxToolIterations,
    );

    if (loopResult.exceededMaxIterations) {
      return {
        success: false,
        error: {
          code: 'MAX_TOOL_ITERATIONS',
          message: t('modules.api.chat.errors.maxToolIterations', { maxIterations: maxToolIterations }),
        },
      };
    }

    return {
      success: true,
      content: loopResult.content!,
    };
  }

  /**
   * 非流式 EditAndRetry 流程
   */
  async handleEditAndRetry(
    request: EditAndRetryRequestData,
  ): Promise<ChatSuccessData | ChatErrorData> {
    const { conversationId, messageIndex, newMessage, configId } = request;

    // 1. 确保对话存在
    await this.ensureConversation(conversationId);

    // 2. 验证配置
    const config = await this.configManager.getConfig(configId);
    if (!config) {
      return {
        success: false,
        error: {
          code: 'CONFIG_NOT_FOUND',
          message: t('modules.api.chat.errors.configNotFound', { configId }),
        },
      };
    }

    if (!config.enabled) {
      return {
        success: false,
        error: {
          code: 'CONFIG_DISABLED',
          message: t('modules.api.chat.errors.configDisabled', { configId }),
        },
      };
    }

    // 3. 验证消息索引和角色
    const message = await this.conversationManager.getMessage(conversationId, messageIndex);
    if (!message) {
      return {
        success: false,
        error: {
          code: 'MESSAGE_NOT_FOUND',
          message: t('modules.api.chat.errors.messageNotFound', { messageIndex }),
        },
      };
    }

    if (message.role !== 'user') {
      return {
        success: false,
        error: {
          code: 'INVALID_MESSAGE_ROLE',
          message: t('modules.api.chat.errors.canOnlyEditUserMessage', { role: message.role }),
        },
      };
    }

    // 4. 更新消息内容
    await this.conversationManager.updateMessage(conversationId, messageIndex, {
      parts: [{ text: newMessage }],
    });

    // 4.5 重新计算编辑后消息的 token 数
    await this.tokenEstimationService.preCountUserMessageTokens(
      conversationId,
      config.type,
      messageIndex,
      true,
    );

    // 5. 删除后续所有消息（messageIndex+1 及之后）和关联的检查点
    const historyRef = await this.conversationManager.getHistoryRef(conversationId);
    if (messageIndex + 1 < historyRef.length) {
      await this.checkpointService.deleteCheckpointsFromIndex(conversationId, messageIndex + 1);
      await this.conversationManager.deleteToMessage(conversationId, messageIndex + 1);
    }

    // EditAndRetry 会改写历史：清理 OpenAI Responses continuation（避免 previous_response_id 对不上）
    await this.conversationManager.setCustomMetadata(
      conversationId,
      OPENAI_RESPONSES_CONTINUATION_KEY,
      null,
    );

    // 6. 工具调用循环（委托给 ToolIterationLoopService，非流式）
    const maxToolIterations = this.getMaxToolIterations();
    const loopResult = await this.toolIterationLoopService.runNonStreamLoop(
      conversationId,
      configId,
      config,
      maxToolIterations,
    );

    if (loopResult.exceededMaxIterations) {
      return {
        success: false,
        error: {
          code: 'MAX_TOOL_ITERATIONS',
          message: t('modules.api.chat.errors.maxToolIterations', { maxIterations: maxToolIterations }),
        },
      };
    }

    return {
      success: true,
      content: loopResult.content!,
    };
  }

  /**
   * 流式 Chat 流程
   */
  async *handleChatStream(
    request: ChatRequestData,
  ): AsyncGenerator<ChatStreamOutput> {
    const { conversationId, configId, message } = request;

    // 1. 确保对话存在
    await this.ensureConversation(conversationId);

    // 2. 验证配置
    const config = await this.configManager.getConfig(configId);
    if (!config) {
      yield {
        conversationId,
        error: {
          code: 'CONFIG_NOT_FOUND',
          message: t('modules.api.chat.errors.configNotFound', { configId }),
        },
      };
      return;
    }

    if (!config.enabled) {
      yield {
        conversationId,
        error: {
          code: 'CONFIG_DISABLED',
          message: t('modules.api.chat.errors.configDisabled', { configId }),
        },
      };
      return;
    }

    const isLocateMode = request.mode === 'locate';
    const effectiveMessage = isLocateMode ? String(message || '').replace(/^\s*\/locate\b\s*/i, '') : message;

    let effectiveContextOverrides = request.contextOverrides;
    let effectiveTaskContext = request.taskContext;

    if (isLocateMode) {
      if (this.settingsManager && this.settingsManager.isToolEnabled('locate') === false) {
        yield {
          conversationId,
          error: { code: 'LOCATE_DISABLED', message: 'Locate is disabled in settings.' }
        };
        return;
      }

      const locateModel = (() => {
        const cfg = this.settingsManager?.getToolsConfig?.();
        const raw = (cfg as any)?.locate?.model;
        return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
      })();

      effectiveContextOverrides = {
        ...(effectiveContextOverrides || {}),
        mode: 'locate',
        includeTools: true,
        toolAllowList: [...ChatFlowService.LOCATE_TOOL_ALLOWLIST],
        ...(locateModel ? { modelOverride: locateModel } : {})
      };

      const userTaskContext = typeof effectiveTaskContext === 'string' && effectiveTaskContext.trim()
        ? effectiveTaskContext.trim()
        : '';
      effectiveTaskContext = [ChatFlowService.LOCATE_TASK_CONTEXT, userTaskContext].filter(Boolean).join('\n\n');

      const carryover = createLocateCarryoverState(effectiveMessage);
      if (carryover) {
        await this.conversationManager.setCustomMetadata(conversationId, LOCATE_CARRYOVER_METADATA_KEY, carryover);
      }
    }

    effectiveTaskContext = await this.applyPendingLocateCarryover(conversationId, isLocateMode, effectiveTaskContext);

    // 3. 中断之前未完成的 diff 等待
    this.diffInterruptService.markUserInterrupt();

    // 4. 为用户消息创建存档点（如果配置了执行前）
    const beforeUserCheckpoint = await this.checkpointService.createUserMessageCheckpoint(
      conversationId,
      'before',
    );
    if (beforeUserCheckpoint) {
      // 立即发送用户消息前存档点到前端
      yield {
        conversationId,
        checkpoints: [beforeUserCheckpoint],
        checkpointOnly: true as const,
      } satisfies ChatStreamCheckpointsData;
    }

    // 5. 添加用户消息到历史（包含附件）
    const userParts = this.messageBuilderService.buildUserMessageParts(effectiveMessage, request.attachments);
    await this.conversationManager.addContent(conversationId, {
      role: 'user',
      parts: userParts,
      selectionReferences: request.selectionReferences,
      taskContext: typeof effectiveTaskContext === 'string' && effectiveTaskContext.trim()
        ? effectiveTaskContext
        : undefined,
      contextOverrides: effectiveContextOverrides,
    });

    // 5.1 预计算用户消息 token 数
    await this.tokenEstimationService.preCountUserMessageTokens(conversationId, config.type);

    // 6. 为用户消息创建存档点（如果配置了执行后）
    const afterUserCheckpoint = await this.checkpointService.createUserMessageCheckpoint(
      conversationId,
      'after',
    );
    if (afterUserCheckpoint) {
      yield {
        conversationId,
        checkpoints: [afterUserCheckpoint],
        checkpointOnly: true as const,
      } satisfies ChatStreamCheckpointsData;
    }

    // 7. 重置中断标记
    this.diffInterruptService.resetUserInterrupt();

    // 8. 判断是否是首条消息（需要刷新动态系统提示词）
    const currentHistoryCheck = await this.conversationManager.getHistoryRef(conversationId);
    const isFirstMessage = currentHistoryCheck.length === 1; // 只有刚添加的用户消息

    // 9. 工具调用循环（委托给 ToolIterationLoopService）
    const maxToolIterations = this.getMaxToolIterations();

    for await (const output of this.toolIterationLoopService.runToolLoop({
      conversationId,
      configId,
      config,
      abortSignal: request.abortSignal,
      isFirstMessage,
      maxIterations: maxToolIterations,
    })) {
      yield output as ChatStreamOutput;
    }
  }

  /**
   * 流式 Retry 流程
   */
  async *handleRetryStream(
    request: RetryRequestData,
  ): AsyncGenerator<ChatStreamOutput> {
    const { conversationId, configId } = request;

    // 1. 确保对话存在
    await this.ensureConversation(conversationId);

    // 2. 验证配置
    const config = await this.configManager.getConfig(configId);
    if (!config) {
      yield {
        conversationId,
        error: {
          code: 'CONFIG_NOT_FOUND',
          message: t('modules.api.chat.errors.configNotFound', { configId }),
        },
      };
      return;
    }

    if (!config.enabled) {
      yield {
        conversationId,
        error: {
          code: 'CONFIG_DISABLED',
          message: t('modules.api.chat.errors.configDisabled', { configId }),
        },
      };
      return;
    }

    // 3. 中断之前未完成的 diff 等待
    this.diffInterruptService.markUserInterrupt();

    // 4. 检查并处理孤立的函数调用
    const orphanedFunctionCalls =
      await this.orphanedToolCallService.checkAndExecuteOrphanedFunctionCalls(conversationId);
    if (orphanedFunctionCalls) {
      // 计算工具响应消息的 token 数
      await this.tokenEstimationService.preCountUserMessageTokens(conversationId, config.type);

      // 发送孤立函数调用的执行结果到前端
      yield {
        conversationId,
        content: orphanedFunctionCalls.functionCallContent,
        toolIteration: true as const,
        toolResults: orphanedFunctionCalls.toolResults,
      } satisfies ChatStreamToolIterationData;
    }

    // 5. 重置中断标记
    this.diffInterruptService.resetUserInterrupt();

    // 6. 判断是否需要刷新动态系统提示词
    const retryHistoryCheck = await this.conversationManager.getHistoryRef(conversationId);
    const isRetryFirstMessage =
      retryHistoryCheck.length === 1 && retryHistoryCheck[0].role === 'user';

    // Retry 需要重新生成上一轮内容：清理 OpenAI Responses continuation（避免继续写在旧 response 上）
    await this.conversationManager.setCustomMetadata(
      conversationId,
      OPENAI_RESPONSES_CONTINUATION_KEY,
      null,
    );

    // 7. 工具调用循环（委托给 ToolIterationLoopService）
    const maxToolIterations = this.getMaxToolIterations();

    for await (const output of this.toolIterationLoopService.runToolLoop({
      conversationId,
      configId,
      config,
      abortSignal: request.abortSignal,
      isFirstMessage: isRetryFirstMessage,
      maxIterations: maxToolIterations,
      // 重试场景原本没有模型消息前检查点，这里显式关闭以保持行为一致
      createBeforeModelCheckpoint: false,
    })) {
      yield output as ChatStreamOutput;
    }
  }

  /**
   * 流式 EditAndRetry 流程
   */
  async *handleEditAndRetryStream(
    request: EditAndRetryRequestData,
  ): AsyncGenerator<ChatStreamOutput> {
    const { conversationId, messageIndex, newMessage, configId } = request;

    // 1. 确保对话存在
    await this.ensureConversation(conversationId);

    // 2. 验证配置
    const config = await this.configManager.getConfig(configId);
    if (!config) {
      yield {
        conversationId,
        error: {
          code: 'CONFIG_NOT_FOUND',
          message: t('modules.api.chat.errors.configNotFound', { configId }),
        },
      };
      return;
    }

    if (!config.enabled) {
      yield {
        conversationId,
        error: {
          code: 'CONFIG_DISABLED',
          message: t('modules.api.chat.errors.configDisabled', { configId }),
        },
      };
      return;
    }

    // 3. 验证消息索引和角色
    const message = await this.conversationManager.getMessage(conversationId, messageIndex);
    if (!message) {
      yield {
        conversationId,
        error: {
          code: 'MESSAGE_NOT_FOUND',
          message: t('modules.api.chat.errors.messageNotFound', { messageIndex }),
        },
      };
      return;
    }

    if (message.role !== 'user') {
      yield {
        conversationId,
        error: {
          code: 'INVALID_MESSAGE_ROLE',
          message: t('modules.api.chat.errors.canOnlyEditUserMessage', { role: message.role }),
        },
      };
      return;
    }

    // 4. 中断之前未完成的 diff 等待
    this.diffInterruptService.markUserInterrupt();

    // 5. 删除该消息及后续所有消息的检查点
    await this.checkpointService.deleteCheckpointsFromIndex(conversationId, messageIndex);

    // 6. 为编辑后的用户消息创建存档点（执行前）
    const beforeEditCheckpoint = await this.checkpointService.createUserMessageCheckpoint(
      conversationId,
      'before',
      messageIndex,
    );
    if (beforeEditCheckpoint) {
      yield {
        conversationId,
        checkpoints: [beforeEditCheckpoint],
        checkpointOnly: true as const,
      } satisfies ChatStreamCheckpointsData;
    }

    // 7. 更新消息内容（包含附件）
    const editParts = this.messageBuilderService.buildUserMessageParts(newMessage, request.attachments);
    await this.conversationManager.updateMessage(conversationId, messageIndex, {
      parts: editParts,
    });

    // 7.5 重新计算编辑后消息的 token 数
    await this.tokenEstimationService.preCountUserMessageTokens(
      conversationId,
      config.type,
      messageIndex,
      true,
    );

    // 8. 删除后续所有消息
    const historyRef = await this.conversationManager.getHistoryRef(conversationId);
    if (messageIndex + 1 < historyRef.length) {
      await this.conversationManager.deleteToMessage(conversationId, messageIndex + 1);
    }

    // EditAndRetry 会改写历史：清理 OpenAI Responses continuation（避免 previous_response_id 对不上）
    await this.conversationManager.setCustomMetadata(
      conversationId,
      OPENAI_RESPONSES_CONTINUATION_KEY,
      null,
    );

    // 9. 为编辑后的用户消息创建存档点（执行后）
    const afterEditCheckpoint = await this.checkpointService.createUserMessageCheckpoint(
      conversationId,
      'after',
      messageIndex,
    );
    if (afterEditCheckpoint) {
      yield {
        conversationId,
        checkpoints: [afterEditCheckpoint],
        checkpointOnly: true as const,
      } satisfies ChatStreamCheckpointsData;
    }

    // 10. 重置中断标记
    this.diffInterruptService.resetUserInterrupt();

    // 11. 判断是否是编辑首条消息（需要刷新动态系统提示词）
    const isEditFirstMessage = messageIndex === 0;

    // 12. 工具调用循环（委托给 ToolIterationLoopService）
    const maxToolIterations = this.getMaxToolIterations();

    for await (const output of this.toolIterationLoopService.runToolLoop({
      conversationId,
      configId,
      config,
      abortSignal: request.abortSignal,
      isFirstMessage: isEditFirstMessage,
      maxIterations: maxToolIterations,
    })) {
      yield output as ChatStreamOutput;
    }
  }

  /**
   * 工具确认流程
   */
  async *handleToolConfirmation(
    request: ToolConfirmationResponseData,
  ): AsyncGenerator<ChatStreamOutput> {
    const { conversationId, configId, toolResponses } = request;

    // 1. 确保对话存在
    await this.ensureConversation(conversationId);

    // 2. 验证配置
    const config = await this.configManager.getConfig(configId);
    if (!config) {
      yield {
        conversationId,
        error: {
          code: 'CONFIG_NOT_FOUND',
          message: t('modules.api.chat.errors.configNotFound', { configId }),
        },
      };
      return;
    }

    // 3. 获取历史中最后一条 model 消息的函数调用
    const history = await this.conversationManager.getHistoryRef(conversationId);
    if (history.length === 0) {
      yield {
        conversationId,
        error: {
          code: 'NO_HISTORY',
          message: t('modules.api.chat.errors.noHistory'),
        },
      };
      return;
    }

    const lastMessage = history[history.length - 1];
    if (lastMessage.role !== 'model') {
      yield {
        conversationId,
        error: {
          code: 'INVALID_STATE',
          message: t('modules.api.chat.errors.lastMessageNotModel'),
        },
      };
      return;
    }

    let lastUserContextOverrides: ContextInjectionOverrides | undefined;
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i] as any;
      if (!msg || msg.role !== 'user') continue;
      if (msg.isFunctionResponse === true) continue;
      if (msg.isSummary === true) continue;
      lastUserContextOverrides = msg.contextOverrides as ContextInjectionOverrides | undefined;
      break;
    }

    const functionCalls = this.toolCallParserService.extractFunctionCalls(lastMessage);
    if (functionCalls.length === 0) {
      yield {
        conversationId,
        error: {
          code: 'NO_FUNCTION_CALLS',
          message: t('modules.api.chat.errors.noFunctionCalls'),
        },
      };
      return;
    }

    // 4. 分离确认和拒绝的工具调用
    const confirmedCalls = functionCalls.filter(call => {
      const response = toolResponses.find(r => r.id === call.id);
      return response?.confirmed;
    });
    const rejectedCalls = functionCalls.filter(call => {
      const response = toolResponses.find(r => r.id === call.id);
      return !response?.confirmed;
    });

    const messageIndex = history.length - 1;

    // 5. 执行确认的工具调用
    let confirmedResult: {
      responseParts: ContentPart[];
      toolResults: Array<{ id: string; name: string; result: Record<string, unknown> }>;
      checkpoints: CheckpointRecord[];
      multimodalAttachments?: ContentPart[];
    } = {
      responseParts: [],
      toolResults: [],
      checkpoints: [],
    };

    if (confirmedCalls.length > 0) {
      // 工具执行前先发送计时信息（让前端立即显示）
      yield {
        conversationId,
        content: lastMessage,
        toolsExecuting: true as const,
        pendingToolCalls: confirmedCalls.map(call => ({
          id: call.id,
          name: call.name,
          args: call.args,
        })),
      } satisfies ChatStreamToolsExecutingData;

      confirmedResult = await this.toolExecutionService.executeFunctionCallsWithResults(
        confirmedCalls,
        conversationId,
        messageIndex,
        config,
        request.abortSignal,
      );
    }

    // 6. 处理拒绝的工具调用
    const rejectedParts: ContentPart[] = [];
    const rejectedResults: Array<{ id: string; name: string; result: Record<string, unknown> }> = [];

    for (const call of rejectedCalls) {
      const rejectionResponse = {
        success: false,
        error: t('modules.api.chat.errors.userRejectedTool'),
        rejected: true,
      };

      rejectedResults.push({
        id: call.id,
        name: call.name,
        result: rejectionResponse,
      });

      rejectedParts.push({
        functionResponse: {
          name: call.name,
          response: rejectionResponse,
          id: call.id,
        },
      });
    }

    // 7. 合并结果
    const allToolResults = [...confirmedResult.toolResults, ...rejectedResults];
    const allResponseParts = [...confirmedResult.responseParts, ...rejectedParts];
    const allCheckpoints = confirmedResult.checkpoints;

    // 8. 发送工具执行结果
    yield {
      conversationId,
      content: lastMessage,
      toolIteration: true as const,
      toolResults: allToolResults,
      checkpoints: allCheckpoints,
    } satisfies ChatStreamToolIterationData;

    // 9. 将函数响应添加到历史
    const confirmFunctionResponseParts =
      confirmedResult.multimodalAttachments && confirmedResult.multimodalAttachments.length > 0
        ? [...confirmedResult.multimodalAttachments, ...allResponseParts]
        : allResponseParts;

    await this.conversationManager.addContent(conversationId, {
      role: 'user',
      parts: confirmFunctionResponseParts,
      isFunctionResponse: true,
    });

    // 计算工具响应消息的 token 数
    await this.tokenEstimationService.preCountUserMessageTokens(conversationId, config.type);

    // 9.5 如果有用户批注，添加为新的用户消息
    if (request.annotation && request.annotation.trim()) {
      await this.conversationManager.addContent(conversationId, {
        role: 'user',
        parts: [{ text: request.annotation.trim() }],
        contextOverrides: lastUserContextOverrides,
      });
      await this.tokenEstimationService.preCountUserMessageTokens(conversationId, config.type);
    }

    // 10. 继续 AI 对话（让 AI 处理工具结果）
    const maxToolIterations = this.getMaxToolIterations();

    for await (const output of this.toolIterationLoopService.runToolLoop({
      conversationId,
      configId,
      config,
      abortSignal: request.abortSignal,
      // 工具确认后的继续对话不视为首条消息
      isFirstMessage: false,
      maxIterations: maxToolIterations,
      // 原逻辑未在确认后的循环中创建模型消息前检查点，这里保持一致
      createBeforeModelCheckpoint: false,
    })) {
      yield output as ChatStreamOutput;
    }
  }

  /**
   * 删除到指定消息的流程
   */
  async handleDeleteToMessage(
    request: DeleteToMessageRequestData,
  ): Promise<DeleteToMessageSuccessData | DeleteToMessageErrorData> {
    const { conversationId, targetIndex } = request;

    // 1. 确保对话存在
    await this.ensureConversation(conversationId);

    // 2. 中断之前未完成的 diff 等待
    this.diffInterruptService.markUserInterrupt();

    try {
      // 3. 删除关联的检查点
      await this.checkpointService.deleteCheckpointsFromIndex(conversationId, targetIndex);

      // 4. 删除消息
      const deletedCount = await this.conversationManager.deleteToMessage(conversationId, targetIndex);

      // 历史被截断：清理 OpenAI Responses continuation（避免 previous_response_id 对不上）
      await this.conversationManager.setCustomMetadata(
        conversationId,
        OPENAI_RESPONSES_CONTINUATION_KEY,
        null,
      );

      return {
        success: true,
        deletedCount,
      };
    } finally {
      // 5. 重置 diff 中断标记
      this.diffInterruptService.resetUserInterrupt();
    }
  }
}
