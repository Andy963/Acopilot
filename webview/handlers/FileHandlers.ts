import type { MessageHandler } from '../types';

import { revealConversationInExplorer } from './file/conversationFileHandlers';
import { summarizeContext } from './file/contextHandlers';
import { showNotification } from './file/notificationHandlers';
import {
  openWorkspaceFile,
  openWorkspaceFileAtLocation,
  previewAttachment,
  readWorkspaceImage,
  saveImageToPath
} from './file/attachmentHandlers';
import {
  addPinnedFile,
  checkPinnedFilesExistence,
  getPinnedFilesConfig,
  removePinnedFile,
  setPinnedFileEnabled,
  updatePinnedFilesConfig,
  validatePinnedFile
} from './file/pinnedFilesHandlers';
import { getRelativePath, getWorkspaceUri } from './file/workspaceHandlers';
import { searchWorkspaceFiles } from './file/workspaceSearchHandlers';

export * from './file/attachmentHandlers';
export * from './file/conversationFileHandlers';
export * from './file/contextHandlers';
export * from './file/notificationHandlers';
export * from './file/pinnedFilesHandlers';
export * from './file/workspaceHandlers';
export * from './file/workspaceSearchHandlers';

/**
 * 注册文件处理器
 */
export function registerFileHandlers(registry: Map<string, MessageHandler>): void {
  // 工作区信息
  registry.set('getWorkspaceUri', getWorkspaceUri);
  registry.set('getRelativePath', getRelativePath);
  
  // 固定文件管理
  registry.set('getPinnedFilesConfig', getPinnedFilesConfig);
  registry.set('checkPinnedFilesExistence', checkPinnedFilesExistence);
  registry.set('updatePinnedFilesConfig', updatePinnedFilesConfig);
  registry.set('addPinnedFile', addPinnedFile);
  registry.set('removePinnedFile', removePinnedFile);
  registry.set('setPinnedFileEnabled', setPinnedFileEnabled);
  registry.set('validatePinnedFile', validatePinnedFile);
  
  // 附件和图片
  registry.set('previewAttachment', previewAttachment);
  registry.set('readWorkspaceImage', readWorkspaceImage);
  registry.set('openWorkspaceFile', openWorkspaceFile);
  registry.set('openWorkspaceFileAtLocation', openWorkspaceFileAtLocation);
  registry.set('saveImageToPath', saveImageToPath);
  
  // 对话文件
  registry.set('conversation.revealInExplorer', revealConversationInExplorer);
  
  // 上下文总结
  registry.set('summarizeContext', summarizeContext);
  
  // 工作区文件搜索
  registry.set('searchWorkspaceFiles', searchWorkspaceFiles);
  
  // 通知
  registry.set('showNotification', showNotification);
}
