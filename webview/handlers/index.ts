/**
 * 消息处理器统一导出
 */

import type { MessageHandler } from '../types';

import { registerConversationHandlers } from './ConversationHandlers';
import { registerConfigHandlers } from './ConfigHandlers';
import { registerSettingsHandlers } from './SettingsHandlers';
import { registerCheckpointHandlers } from './CheckpointHandlers';
import { registerToolHandlers } from './ToolHandlers';
<<<<<<< HEAD
=======
import { registerMcpHandlers } from './McpHandlers';
>>>>>>> f327a97 (merge: dev into main for v1.2.0)
import { registerDependencyHandlers } from './DependencyHandlers';
import { registerStoragePathHandlers } from './StoragePathHandlers';
import { registerContextHandlers } from './ContextHandlers';
import { registerFileHandlers } from './FileHandlers';
import { registerDiffHandlers } from './DiffHandlers';
import { registerPatchHandlers } from './PatchHandlers';
import { registerGitHandlers } from './GitHandlers';
import { registerChatHandlers } from './ChatHandlers';
import { registerValidationHandlers } from './ValidationHandlers';

// 重新导出各个模块
export * from './ConversationHandlers';
export * from './ConfigHandlers';
export * from './SettingsHandlers';
export * from './CheckpointHandlers';
export * from './ToolHandlers';
<<<<<<< HEAD
=======
export * from './McpHandlers';
>>>>>>> f327a97 (merge: dev into main for v1.2.0)
export * from './DependencyHandlers';
export * from './StoragePathHandlers';
export * from './ContextHandlers';
export * from './FileHandlers';
export * from './DiffHandlers';
export * from './PatchHandlers';
export * from './GitHandlers';
export * from './ChatHandlers';
export * from './ValidationHandlers';

/**
 * 创建并注册所有消息处理器
 */
export function createMessageHandlerRegistry(): Map<string, MessageHandler> {
  const registry = new Map<string, MessageHandler>();
  
  // 注册各个模块的处理器
  registerConversationHandlers(registry);
  registerConfigHandlers(registry);
  registerSettingsHandlers(registry);
  registerCheckpointHandlers(registry);
  registerToolHandlers(registry);
<<<<<<< HEAD
=======
  registerMcpHandlers(registry);
>>>>>>> f327a97 (merge: dev into main for v1.2.0)
  registerDependencyHandlers(registry);
  registerStoragePathHandlers(registry);
  registerContextHandlers(registry);
  registerFileHandlers(registry);
  registerDiffHandlers(registry);
  registerPatchHandlers(registry);
  registerGitHandlers(registry);
  registerChatHandlers(registry);
  registerValidationHandlers(registry);
  
  return registry;
}
