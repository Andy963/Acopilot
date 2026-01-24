/**
 * Chat Store - Pinia状态管理
 * 
 * 管理对话和消息状态：
 * - 当前对话ID
 * - 消息列表
 * - 对话列表
 * - 加载/流式状态
 * 
 * 逻辑说明：
 * 1. 打开时创建临时对话（不立即持久化）
 * 2. 用户发送第一条消息时才持久化对话
 * 3. 加载历史对话从后端获取
 * 
 * 模块化结构：
 * - state.ts: 状态定义
 * - computed.ts: 计算属性
 * - streamHandler.ts: 流式响应处理
 * - conversationActions.ts: 对话操作
 * - messageActions.ts: 消息操作
 * - toolActions.ts: 工具操作
 * - checkpointActions.ts: 检查点操作
 * - configActions.ts: 配置操作
 * - parsers.ts: 解析器
 * - utils.ts: 工具函数
 */

import { defineStore } from 'pinia'
import type { Attachment, StreamChunk, ContextInspectorData, ContextInjectionOverrides } from '../types'
import { sendToExtension, onMessageFromExtension } from '../utils/vscode'

// 导入模块
import { createChatState } from './chat/state'
import { createChatComputed } from './chat/computed'
import { handleStreamChunk } from './chat/streamHandler'
import { formatTime } from './chat/utils'

import {
  createNewConversation as createNewConvAction,
  loadConversations as loadConvsAction,
  loadHistory,
  loadCheckpoints,
  switchConversation as switchConvAction,
  deleteConversation as deleteConvAction,
  isDeletingConversation,
  updateConversationAfterMessage
} from './chat/conversationActions'

import {
  loadCurrentConfig,
  setConfigId as setConfigIdAction,
  loadSavedConfigId,
  loadCheckpointConfig,
  setMergeUnchangedCheckpoints,
  setCurrentWorkspaceUri,
  setWorkspaceFilter as setWorkspaceFilterAction,
  setInputValue as setInputValueAction,
  clearInputValue as clearInputValueAction,
  handleRetryStatus
} from './chat/configActions'

import {
  getCheckpointsForMessage as getCheckpointsFn,
  hasCheckpoint as hasCheckpointFn,
  addCheckpoint as addCheckpointFn,
  restoreCheckpoint as restoreCheckpointFn,
  restoreAndRetry as restoreAndRetryFn,
  restoreAndDelete as restoreAndDeleteFn,
  restoreAndEdit as restoreAndEditFn,
  summarizeContext as summarizeContextFn
} from './chat/checkpointActions'

import {
  getToolResponseById as getToolResponseByIdFn,
  hasToolResponse as hasToolResponseFn,
  getActualIndex as getActualIndexFn,
  cancelStream as cancelStreamFn,
  cancelStreamAndRejectTools as cancelStreamAndRejectToolsFn,
  rejectPendingToolsWithAnnotation as rejectPendingToolsWithAnnotationFn
} from './chat/toolActions'

import {
  sendMessage as sendMessageFn,
  retryLastMessage as retryLastMessageFn,
  retryFromMessage as retryFromMessageFn,
  retryAfterError as retryAfterErrorFn,
  continueAfterToolExecution as continueAfterToolExecutionFn,
  editAndRetry as editAndRetryFn,
  deleteMessage as deleteMessageFn,
  deleteSingleMessage as deleteSingleMessageFn,
  clearMessages as clearMessagesFn
} from './chat/messageActions'
import type { SendMessageOptions } from './chat/messageActions'

import type { PinnedPromptState } from './chat/types'
import { setPinnedPrompt as setPinnedPromptFn } from './chat/pinnedPromptActions'
import type { SelectionReference } from './chat/types'
import {
  addSelectionReference as addSelectionReferenceFn,
  removeSelectionReference as removeSelectionReferenceFn,
  clearSelectionReferences as clearSelectionReferencesFn
} from './chat/selectionReferenceActions'
import {
  closeContextInspector as closeContextInspectorFn,
  openContextInspectorPreview as openContextInspectorPreviewFn,
  openContextInspectorWithData as openContextInspectorWithDataFn
} from './chat/contextInspectorActions'
import {
  loadPlanRunnerState as loadPlanRunnerStateFn,
  createPlanRunner as createPlanRunnerFn,
  clearPlanRunner as clearPlanRunnerFn,
  startPlanRunner as startPlanRunnerFn,
  resumePlanRunner as resumePlanRunnerFn,
  pausePlanRunner as pausePlanRunnerFn,
  cancelPlanRunner as cancelPlanRunnerFn,
  rerunPlanRunnerFromStep as rerunPlanRunnerFromStepFn,
  runSinglePlanRunnerStep as runSinglePlanRunnerStepFn,
  type PlanRunnerCreateInput
} from './chat/planRunnerActions'

import { runPostEditValidationCommand as runPostEditValidationCommandFn, type ValidationCommandPreset } from './chat/validationActions'

// 重新导出类型
export type { Conversation, WorkspaceFilter } from './chat/types'

export const useChatStore = defineStore('chat', () => {
  // ============ 状态 ============
  const state = createChatState()
  
  // ============ 计算属性 ============
  const computed = createChatComputed(state)
  
  // ============ 工具操作 ============
  
  const getToolResponseById = (toolCallId: string) => getToolResponseByIdFn(state, toolCallId)
  const hasToolResponse = (toolCallId: string) => hasToolResponseFn(state, toolCallId)
  const getActualIndex = (displayIndex: number) => getActualIndexFn(state, computed, displayIndex)
  
  const cancelStreamAndRejectTools = () => cancelStreamAndRejectToolsFn(state, computed)
  const cancelStream = () => cancelStreamFn(state, computed)
  const rejectPendingToolsWithAnnotation = (annotation: string) => 
    rejectPendingToolsWithAnnotationFn(state, computed, annotation)

  // ============ 消息操作 ============
  
  const sendMessage = (messageText: string, attachments?: Attachment[], options?: SendMessageOptions) =>
    sendMessageFn(state, computed, messageText, attachments, options)
  
  const retryLastMessage = () => retryLastMessageFn(state, computed, cancelStream)
  const retryFromMessage = (messageIndex: number) => 
    retryFromMessageFn(state, computed, messageIndex, cancelStream)
  const retryAfterError = () => retryAfterErrorFn(state, computed)
  const continueAfterToolExecution = (prompt?: string) => continueAfterToolExecutionFn(state, computed, prompt)
  
  const editAndRetry = (messageIndex: number, newMessage: string, attachments?: Attachment[]) =>
    editAndRetryFn(state, computed, messageIndex, newMessage, attachments, cancelStream)
  
  const deleteMessage = (targetIndex: number) => deleteMessageFn(state, targetIndex, cancelStream)
  const deleteSingleMessage = (targetIndex: number) => deleteSingleMessageFn(state, targetIndex, cancelStream)
  const clearMessages = () => clearMessagesFn(state)

  // ============ 对话操作 ============
  
  const createNewConversation = () => createNewConvAction(state, cancelStreamAndRejectTools)
  const loadConversations = () => loadConvsAction(state)
  const switchConversation = async (id: string) => {
    await switchConvAction(state, id, cancelStreamAndRejectTools)
    await loadPlanRunnerState()
  }
  const deleteConversation = (id: string) => deleteConvAction(
    state,
    id,
    switchConversation,
    createNewConversation
  )
  
  // ============ 配置操作 ============
  
  const setConfigId = (newConfigId: string) => setConfigIdAction(state, newConfigId)
  const setWorkspaceFilter = (filter: 'current' | 'all') => setWorkspaceFilterAction(state, filter)
  const setInputValue = (value: string) => setInputValueAction(state, value)
  const clearInputValue = () => clearInputValueAction(state)
  const setPinnedPrompt = (pinnedPrompt: PinnedPromptState) => setPinnedPromptFn(state, pinnedPrompt)
  const addSelectionReference = (selection: Partial<SelectionReference>) => addSelectionReferenceFn(state, selection)
  const removeSelectionReference = (id: string) => removeSelectionReferenceFn(state, id)
  const clearSelectionReferences = () => clearSelectionReferencesFn(state)

  const setMessageContextOverride = (key: keyof ContextInjectionOverrides, value: boolean | undefined): void => {
    const next: ContextInjectionOverrides = { ...(state.messageContextOverrides.value || {}) }
    if (value === undefined) {
      delete (next as any)[key]
    } else {
      (next as any)[key] = value
    }
    state.messageContextOverrides.value = next
  }

  const clearMessageContextOverrides = (): void => {
    state.messageContextOverrides.value = {}
  }
  
  // ============ 检查点操作 ============
  
  const getCheckpointsForMessage = (messageIndex: number) => getCheckpointsFn(state, messageIndex)
  const hasCheckpoint = (messageIndex: number) => hasCheckpointFn(state, messageIndex)
  const addCheckpoint = (checkpoint: any) => addCheckpointFn(state, checkpoint)
  const restoreCheckpoint = (checkpointId: string) => restoreCheckpointFn(state, checkpointId)
  const restoreAndRetry = (messageIndex: number, checkpointId: string) =>
    restoreAndRetryFn(state, messageIndex, checkpointId, computed.currentModelName.value, cancelStream)
  const restoreAndDelete = (messageIndex: number, checkpointId: string) =>
    restoreAndDeleteFn(state, messageIndex, checkpointId, cancelStream)
  const restoreAndEdit = (messageIndex: number, newContent: string, attachments: Attachment[] | undefined, checkpointId: string) =>
    restoreAndEditFn(state, messageIndex, newContent, attachments, checkpointId, computed.currentModelName.value, cancelStream)
  const summarizeContext = () => summarizeContextFn(state, () => loadHistory(state))

  // ============ Context Inspector ============

  const openContextInspectorPreview = (attachments?: Attachment[]) => openContextInspectorPreviewFn(state, attachments)
  const openContextInspectorWithData = (data: ContextInspectorData) => openContextInspectorWithDataFn(state, data)
  const closeContextInspector = () => closeContextInspectorFn(state)

  // ============ Plan Runner ============

  const loadPlanRunnerState = () => loadPlanRunnerStateFn(state)
  const createPlanRunner = (input: PlanRunnerCreateInput) => createPlanRunnerFn(state, input)
  const clearPlanRunner = () => clearPlanRunnerFn(state)
  const startPlanRunner = () => startPlanRunnerFn(state, computed)
  const resumePlanRunner = () => resumePlanRunnerFn(state, computed)
  const pausePlanRunner = () => pausePlanRunnerFn(state)
  const cancelPlanRunner = () => cancelPlanRunnerFn(state, computed)
  const rerunPlanRunnerFromStep = (stepIndex: number) => rerunPlanRunnerFromStepFn(state, computed, stepIndex)
  const runSinglePlanRunnerStep = (stepIndex: number) => runSinglePlanRunnerStepFn(state, computed, stepIndex)

  // ============ 改动后校验 ============

  const runPostEditValidationCommand = (preset: ValidationCommandPreset) =>
    runPostEditValidationCommandFn(state, preset)

  // ============ 流式处理 ============
  
  function handleStreamChunkWrapper(chunk: StreamChunk): void {
    handleStreamChunk(chunk, {
      state,
      currentModelName: () => computed.currentModelName.value,
      addCheckpoint,
      updateConversationAfterMessage: () => updateConversationAfterMessage(state)
    })
  }

  // ============ 初始化 ============
  
  async function initialize(): Promise<void> {
    onMessageFromExtension((message) => {
      if (message.type === 'streamChunk') {
        handleStreamChunkWrapper(message.data)
      } else if (message.type === 'workspaceUri') {
        setCurrentWorkspaceUri(state, message.data)
      } else if (message.type === 'retryStatus') {
        handleRetryStatus(state, message.data)
      }
    })
    
    try {
      const uri = await sendToExtension<string | null>('getWorkspaceUri', {})
      setCurrentWorkspaceUri(state, uri)
    } catch {
      // 忽略错误
    }
    
    await loadSavedConfigId(state)
    await loadCurrentConfig(state)
    await loadCheckpointConfig(state)
    await loadConversations()
    
    state.currentConversationId.value = null
    state.allMessages.value = []
  }

  // ============ 返回 ============
  
  return {
    // 状态
    conversations: state.conversations,
    currentConversationId: state.currentConversationId,
    allMessages: state.allMessages,
    messages: computed.messages,
    configId: state.configId,
    currentConfig: state.currentConfig,
    isLoading: state.isLoading,
    isStreaming: state.isStreaming,
    isLoadingConversations: state.isLoadingConversations,
    isWaitingForResponse: state.isWaitingForResponse,
    retryStatus: state.retryStatus,
    error: state.error,
    planRunner: state.planRunner,
    postEditValidationPending: state.postEditValidationPending,

    // Context Inspector
    contextInspectorVisible: state.contextInspectorVisible,
    contextInspectorLoading: state.contextInspectorLoading,
    contextInspectorData: state.contextInspectorData,
    contextInspectorError: state.contextInspectorError,
    contextInspectorSource: state.contextInspectorSource,
    
    // 计算属性
    currentConversation: computed.currentConversation,
    sortedConversations: computed.sortedConversations,
    filteredConversations: computed.filteredConversations,
    hasMessages: computed.hasMessages,
    showEmptyState: computed.showEmptyState,
    currentModelName: computed.currentModelName,
    maxContextTokens: computed.maxContextTokens,
    usedTokens: computed.usedTokens,
    tokenUsagePercent: computed.tokenUsagePercent,
    needsContinueButton: computed.needsContinueButton,
    hasPendingToolConfirmation: computed.hasPendingToolConfirmation,
    pendingToolCalls: computed.pendingToolCalls,

    // 对话管理
    createNewConversation,
    loadConversations,
    switchConversation,
    deleteConversation,
    isDeletingConversation: (id: string) => isDeletingConversation(state, id),
    
    // 消息管理
    loadHistory: () => loadHistory(state),
    sendMessage,
    retryLastMessage,
    retryFromMessage,
    retryAfterError,
    continueAfterToolExecution,
    cancelStream,
    rejectPendingToolsWithAnnotation,
    editAndRetry,
    deleteMessage,
    deleteSingleMessage,
    clearMessages,

    // Context Inspector
    openContextInspectorPreview,
    openContextInspectorWithData,
    closeContextInspector,

    // Plan Runner
    loadPlanRunnerState,
    createPlanRunner,
    clearPlanRunner,
    startPlanRunner,
    resumePlanRunner,
    pausePlanRunner,
    cancelPlanRunner,
    rerunPlanRunnerFromStep,
    runSinglePlanRunnerStep,

    // 改动后校验
    runPostEditValidationCommand,
    
    // 配置管理
    setConfigId,
    loadCurrentConfig: () => loadCurrentConfig(state),
    
    // 工具
    formatTime,
    getToolResponseById,
    hasToolResponse,
    getActualIndex,
    
    // 检查点
    checkpoints: state.checkpoints,
    mergeUnchangedCheckpoints: state.mergeUnchangedCheckpoints,
    getCheckpointsForMessage,
    hasCheckpoint,
    loadCheckpoints: () => loadCheckpoints(state),
    loadCheckpointConfig: () => loadCheckpointConfig(state),
    setMergeUnchangedCheckpoints: (value: boolean) => setMergeUnchangedCheckpoints(state, value),
    addCheckpoint,
    restoreCheckpoint,
    restoreAndRetry,
    restoreAndEdit,
    restoreAndDelete,
    
    // 工作区
    currentWorkspaceUri: state.currentWorkspaceUri,
    workspaceFilter: state.workspaceFilter,
    setCurrentWorkspaceUri: (uri: string | null) => setCurrentWorkspaceUri(state, uri),
    setWorkspaceFilter,
    
    // 输入框
    inputValue: state.inputValue,
    setInputValue,
    clearInputValue,

    // 固定提示词/技能
    pinnedPrompt: state.pinnedPrompt,
    setPinnedPrompt,

    // 本条消息引用（选中代码片段）
    selectionReferences: state.selectionReferences,
    addSelectionReference,
    removeSelectionReference,
    clearSelectionReferences,

    // 本条消息级上下文覆写
    messageContextOverrides: state.messageContextOverrides,
    setMessageContextOverride,
    clearMessageContextOverrides,
    
    // 上下文总结
    summarizeContext,
    
    // 初始化
    initialize
  }
})
