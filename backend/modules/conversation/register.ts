/**
 * 对话管理模块 - 注册文件
 *
 * 将 ConversationManager 的功能注册为模块 API
 */

import type { ModuleDefinition } from '../../core/registry';
import { ConversationManager } from './ConversationManager';
import {
    createConversationAdminApis,
    createConversationMessageApis,
    createConversationSnapshotApis
} from './registerApis';
import type { IStorageAdapter } from './storage';

/**
 * 创建对话管理模块定义
 * @param storage 存储适配器
 */
export function createConversationModule(storage: IStorageAdapter): ModuleDefinition {
    // 创建对话管理器实例
    const manager = new ConversationManager(storage);

    return {
        id: 'conversation',
        name: 'Conversation Manager',
        version: '1.0.5',
        description: 'Provides conversation history management including message operations, snapshots, and statistics',
        apis: [
            ...createConversationMessageApis(manager),
            ...createConversationSnapshotApis(manager),
            ...createConversationAdminApis(manager)
        ]
    };
}
