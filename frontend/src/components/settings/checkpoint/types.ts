export interface CheckpointMessageType {
  name: string
  displayName: string
  description: string
}

export interface MessageCheckpointConfig {
  beforeMessages: string[]
  afterMessages: string[]
  modelOuterLayerOnly?: boolean
  mergeUnchangedCheckpoints?: boolean
}

export interface CheckpointConfig {
  enabled: boolean
  beforeTools: string[]
  afterTools: string[]
  messageCheckpoint?: MessageCheckpointConfig
  maxCheckpoints: number
  cleanupExpiredConversationsOnStartup?: boolean
  expiredConversationRetentionDays?: number
  customIgnorePatterns?: string[]
}

export interface ToolInfo {
  name: string
  description: string
  category?: string
}

export interface ConversationWithCheckpoints {
  conversationId: string
  title: string
  checkpointCount: number
  totalSize: number
  createdAt?: number
  updatedAt?: number
}
