import type { Message } from './message'

// ============ Context Inspector ============

export interface ContextInspectorModule {
  title: string
  contentPreview: string
  charCount: number
  truncated: boolean
}

export interface ContextInspectorTools {
  toolMode: 'function_call' | 'xml' | 'json'
  total: number
  mcp: number
  definitionPreview?: string
  definitionCharCount?: number
  definitionTruncated?: boolean
}

export interface ContextInspectorTrim {
  fullHistoryCount: number
  trimmedHistoryCount: number
  trimStartIndex: number
  lastSummaryIndex: number
  effectiveStartIndex: number
}

export interface ContextInjectedPinnedFile {
  id?: string
  path: string
  workspace?: string
  exists?: boolean
  included?: boolean
}

export interface ContextInjectedPinnedFiles {
  totalEnabled: number
  included: number
  files: ContextInjectedPinnedFile[]
}

export interface ContextInjectedPinnedPrompt {
  mode: 'none' | 'skill' | 'custom'
  skillId?: string
  skillName?: string
  customPromptCharCount?: number
}

export interface ContextInjectedAttachment {
  id?: string
  name: string
  type?: string
  mimeType?: string
  size?: number
  url?: string
}

export interface ContextInjectedAttachments {
  count: number
  items: ContextInjectedAttachment[]
}

export interface ContextInjectedPinnedSelection {
  id?: string
  path: string
  startLine?: number
  endLine?: number
  languageId?: string
  charCount?: number
  truncated?: boolean
}

export interface ContextInjectedPinnedSelections {
  count: number
  items: ContextInjectedPinnedSelection[]
}

export interface ContextInjectedInfo {
  pinnedFiles?: ContextInjectedPinnedFiles
  pinnedPrompt?: ContextInjectedPinnedPrompt
  attachments?: ContextInjectedAttachments
  pinnedSelections?: ContextInjectedPinnedSelections
}

export interface ContextInspectorData {
  generatedAt: number
  conversationId?: string
  configId: string
  providerType: string
  model: string
  estimatedTotalTokens?: number
  maxContextTokens?: number
  tools: ContextInspectorTools
  systemInstructionPreview: string
  systemInstructionCharCount: number
  systemInstructionTruncated: boolean
  modules: ContextInspectorModule[]
  injected?: ContextInjectedInfo
  trim?: ContextInspectorTrim
}

export interface ContextInjectionOverrides {
  includeWorkspaceFiles?: boolean
  includeOpenTabs?: boolean
  includeActiveEditor?: boolean
  includeDiagnostics?: boolean
  includePinnedFiles?: boolean
  includePinnedPrompt?: boolean
  includeTools?: boolean
  toolAllowList?: string[]
  modelOverride?: string
  mode?: 'locate'
}

// ============ 错误类型 ============

export interface ErrorInfo {
  code: string
  message: string
  details?: any
}

// ============ UI 状态类型 ============

export type ModalType = 'settings' | 'history' | 'attachment' | null

export interface AppState {
  loading: boolean
  error: ErrorInfo | null
  modalType: ModalType
  currentSession: string | null
}

// ============ 事件类型 ============

export interface ChatEvent {
  type: 'send' | 'receive' | 'error' | 'stream'
  message?: Message
  error?: ErrorInfo
}

// ============ 工具函数类型 ============

export type MessageFormatter = (message: Message) => string
export type AttachmentValidator = (file: File) => boolean | string

// ============ 常量 ============

export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024 // 10MB
export const MAX_MESSAGE_LENGTH = 10000
export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
export const SUPPORTED_VIDEO_TYPES = ['video/mp4', 'video/webm']
export const SUPPORTED_AUDIO_TYPES = ['audio/mp3', 'audio/wav', 'audio/ogg']

// ============ 检查点相关类型 ============

/**
 * 检查点记录
 *
 * 与对话消息索引关联的代码库快照记录
 */
export interface CheckpointRecord {
  /** 检查点唯一 ID */
  id: string

  /** 关联的对话 ID */
  conversationId: string

  /**
   * 关联的消息索引
   *
   * 表示此检查点是在处理该索引消息时创建的
   */
  messageIndex: number

  /** 触发备份的工具名称 */
  toolName: string

  /**
   * 备份阶段
   * - before: 工具执行前
   * - after: 工具执行后
   */
  phase: 'before' | 'after'

  /** 创建时间戳 */
  timestamp: number

  /** 备份目录名 */
  backupDir: string

  /** 备份的文件数量 */
  fileCount: number

  /** 内容签名（用于比较两个检查点是否内容一致） */
  contentHash: string

  /** 描述信息 */
  description?: string
}

// ============ 模型相关类型 ============

/**
 * 模型信息
 */
export interface ModelInfo {
  /** 模型 ID */
  id: string

  /** 模型名称 */
  name?: string

  /** 模型描述 */
  description?: string

  /** 上下文窗口大小 */
  contextWindow?: number

  /** 最大输出token */
  maxOutputTokens?: number
}
export const SUPPORTED_DOCUMENT_TYPES = ['application/pdf', 'text/plain', 'application/json']

// ============ MCP 相关类型 ============

/**
 * MCP 服务器传输类型
 */
export type McpTransportType = 'stdio' | 'sse' | 'streamable-http'

/**
 * MCP 服务器状态
 */
export type McpServerStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

/**
 * Stdio 传输配置
 */
export interface StdioTransportConfig {
  type: 'stdio'
  command: string
  args?: string[]
  env?: Record<string, string>
}

/**
 * SSE 传输配置
 */
export interface SseTransportConfig {
  type: 'sse'
  url: string
  headers?: Record<string, string>
}

/**
 * Streamable HTTP 传输配置
 */
export interface StreamableHttpTransportConfig {
  type: 'streamable-http'
  url: string
  headers?: Record<string, string>
}

/**
 * MCP 传输配置
 */
export type McpTransportConfig = StdioTransportConfig | SseTransportConfig | StreamableHttpTransportConfig

/**
 * MCP 服务器配置
 */
export interface McpServerConfig {
  id: string
  name: string
  description?: string
  transport: McpTransportConfig
  enabled: boolean
  autoConnect: boolean
  timeout?: number
  /**
   * 是否清理 JSON Schema
   *
   * 如果为 true，会移除 JSON Schema 中不兼容的字段（如 $schema, additionalProperties）
   * 某些 API（如 Gemini）不支持这些字段
   *
   * 默认为 true
   */
  cleanSchema?: boolean
  createdAt: number
  updatedAt: number
}

/**
 * MCP 工具定义
 */
export interface McpToolDefinition {
  name: string
  description?: string
  inputSchema: {
    type: 'object'
    properties?: Record<string, unknown>
    required?: string[]
    [key: string]: unknown
  }
}

/**
 * MCP 资源定义
 */
export interface McpResourceDefinition {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

/**
 * MCP 提示模板定义
 */
export interface McpPromptDefinition {
  name: string
  description?: string
  arguments?: Array<{
    name: string
    description?: string
    required?: boolean
  }>
}

/**
 * MCP 服务器能力
 */
export interface McpServerCapabilities {
  tools?: McpToolDefinition[]
  resources?: McpResourceDefinition[]
  prompts?: McpPromptDefinition[]
  sampling?: boolean
  logging?: boolean
}

/**
 * MCP 服务器运行时信息
 */
export interface McpServerInfo {
  config: McpServerConfig
  status: McpServerStatus
  capabilities?: McpServerCapabilities
  protocolVersion?: string
  serverVersion?: string
  serverDescription?: string
  lastError?: string
  connectedAt?: number
}

/**
 * 创建 MCP 服务器输入
 */
export type CreateMcpServerInput = Omit<McpServerConfig, 'id' | 'createdAt' | 'updatedAt'>

/**
 * 更新 MCP 服务器输入
 */
export type UpdateMcpServerInput = Partial<Omit<McpServerConfig, 'id' | 'createdAt' | 'updatedAt'>>
