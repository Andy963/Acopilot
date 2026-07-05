import type { Content, ContentPart, UsageMetadata } from './message'
import type { CheckpointRecord, ContextInjectionOverrides, ErrorInfo } from './ui'

// ============ 工具相关类型 ============

/**
 * 工具调用信息
 */
export interface ToolCall {
  id: string
  name: string
  args: Record<string, unknown>
  status?: 'pending' | 'running' | 'success' | 'error'
}

/**
 * 工具执行结果
 */
export interface ToolResult {
  id: string
  name: string
  result: Record<string, unknown>
  error?: string
  duration?: number
}

/**
 * 工具使用信息 - 用于在消息中显示
 */
export interface ToolUsage {
  id: string
  name: string
  args: Record<string, unknown>
  result?: Record<string, unknown>
  error?: string
  duration?: number
  status?: 'pending' | 'running' | 'success' | 'error' | 'warning'
  awaitingConfirmation?: boolean
}

// ============ 附件相关类型 ============

export type AttachmentType = 'image' | 'video' | 'audio' | 'document' | 'code'

export interface Attachment {
  id: string
  name: string
  type: AttachmentType
  size: number
  url?: string
  data?: string  // base64 或其他数据
  mimeType: string
  thumbnail?: string
  metadata?: AttachmentMetadata
}

export interface AttachmentMetadata {
  width?: number
  height?: number
  duration?: number
  language?: string
  [key: string]: any
}

// ============ 会话相关类型 ============

export interface Session {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messageCount: number
  preview?: string
  metadata?: SessionMetadata
}

export interface SessionMetadata {
  model?: string
  tags?: string[]
  [key: string]: any
}

// ============ 配置相关类型 ============

export interface ChatConfig {
  model: string
  provider: 'gemini' | 'openai' | 'openai-responses' | 'anthropic' | 'custom'
  apiKey?: string
  baseUrl?: string
  temperature?: number
  maxTokens?: number
  topP?: number
  stream?: boolean
}

export interface UIConfig {
  theme: 'auto' | 'light' | 'dark'
  fontSize: number
  codeTheme: string
  enableAnimations: boolean
  compactMode: boolean
}

// ============ VSCode 通信类型 ============

export interface VSCodeMessage<T = any> {
  type: string
  requestId?: string
  data: T
}

export interface VSCodeRequest {
  type: 'chat' | 'chatStream' | 'retry' | 'retryStream' | 'editAndRetry' | 'editAndRetryStream' |
  'deleteMessage' | 'getHistory' | 'getConfig' | 'updateConfig'
  data: any
  requestId: string
}

export interface VSCodeResponse<T = any> {
  type: string
  requestId: string
  success: boolean
  data?: T
  error?: ErrorInfo
}

// ============ Chat API 请求类型 ============

export type ChatMode = 'chat' | 'plan' | 'agent'

export interface ChatRequest {
  conversationId: string
  configId: string
  message: string
  chatMode?: ChatMode
  contextOverrides?: ContextInjectionOverrides
}

export interface RetryRequest {
  conversationId: string
  configId: string
}

export interface EditAndRetryRequest {
  conversationId: string
  messageIndex: number
  newMessage: string
  configId: string
}

export interface DeleteMessageRequest {
  conversationId: string
  targetIndex: number
}

// ============ Chat API 响应类型 ============

export interface ChatSuccessResponse {
  success: true
  content: Content
}

export interface ChatErrorResponse {
  success: false
  error: ErrorInfo
}

/**
 * 后端 StreamChunk 格式（来自 ChannelManager）
 */
export interface BackendStreamChunk {
  delta: ContentPart[]
  done: boolean
  usage?: UsageMetadata
  finishReason?: string
  /** 模型版本（仅最后一个块包含） */
  modelVersion?: string
}

/**
 * 工具执行结果
 */
export interface ToolExecutionResult {
  id?: string
  name: string
  result: Record<string, unknown>
}

/**
 * 待确认的工具调用
 */
export interface PendingToolCall {
  /** 工具调用 ID */
  id: string
  /** 工具名称 */
  name: string
  /** 工具参数 */
  args: Record<string, unknown>
}

/**
 * 前端接收的流式消息格式
 */
export interface StreamChunk {
  type: 'chunk' | 'complete' | 'error' | 'toolIteration' | 'cancelled' | 'checkpoints' | 'awaitingConfirmation' | 'toolsExecuting' | 'contextInfo'
  conversationId: string
  chunk?: BackendStreamChunk
  content?: Content
  error?: ErrorInfo
  /** 是否为工具迭代（工具调用后还有后续消息） */
  toolIteration?: boolean
  /** 工具执行结果列表 */
  toolResults?: ToolExecutionResult[]
  /** 创建的检查点列表 */
  checkpoints?: CheckpointRecord[]
  /** 等待确认的工具调用列表（当 type 为 'awaitingConfirmation' 时） */
  pendingToolCalls?: PendingToolCall[]
  /** 标记工具即将开始执行（用于在工具执行前先发送计时信息） */
  toolsExecuting?: boolean
  /** Context snapshot payload when `type` is `contextInfo`. */
  contextSnapshot?: any
}
