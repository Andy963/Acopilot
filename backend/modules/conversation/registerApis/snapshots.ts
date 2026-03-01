import type { ApiDefinition } from '../../../core/registry';
import type { ConversationManager } from '../ConversationManager';

export function createConversationSnapshotApis(manager: ConversationManager): ApiDefinition[] {
    return [
        // ========== 快照管理 ==========
        {
            name: 'createSnapshot',
            description: '创建当前对话的快照',
            parameters: [
                {
                    name: 'conversationId',
                    type: 'string',
                    required: true,
                    description: '对话 ID'
                },
                {
                    name: 'name',
                    type: 'string',
                    required: false,
                    description: '快照名称'
                },
                {
                    name: 'description',
                    type: 'string',
                    required: false,
                    description: '快照描述'
                }
            ],
            returnType: 'HistorySnapshot',
            handler: async (params) => {
                return await manager.createSnapshot(
                    params.conversationId as string,
                    params.name as string | undefined,
                    params.description as string | undefined
                );
            }
        },

        {
            name: 'restoreSnapshot',
            description: '恢复快照',
            parameters: [
                {
                    name: 'conversationId',
                    type: 'string',
                    required: true,
                    description: '对话 ID'
                },
                {
                    name: 'snapshotId',
                    type: 'string',
                    required: true,
                    description: '快照 ID'
                }
            ],
            returnType: 'void',
            handler: async (params) => {
                await manager.restoreSnapshot(
                    params.conversationId as string,
                    params.snapshotId as string
                );
            }
        },

        {
            name: 'deleteSnapshot',
            description: '删除快照',
            parameters: [
                {
                    name: 'snapshotId',
                    type: 'string',
                    required: true,
                    description: '快照 ID'
                }
            ],
            returnType: 'void',
            handler: async (params) => {
                await manager.deleteSnapshot(params.snapshotId as string);
            }
        },

        // ========== 统计信息 ==========
        {
            name: 'getStats',
            description: '获取对话统计信息',
            parameters: [
                {
                    name: 'conversationId',
                    type: 'string',
                    required: true,
                    description: '对话 ID'
                }
            ],
            returnType: 'ConversationStats',
            handler: async (params) => {
                return await manager.getStats(params.conversationId as string);
            }
        },

        // ========== 元数据管理 ==========
        {
            name: 'setCustomMetadata',
            description: '设置对话自定义元数据',
            parameters: [
                {
                    name: 'conversationId',
                    type: 'string',
                    required: true,
                    description: '对话 ID'
                },
                {
                    name: 'key',
                    type: 'string',
                    required: true,
                    description: '元数据键'
                },
                {
                    name: 'value',
                    type: 'any',
                    required: true,
                    description: '元数据值'
                }
            ],
            returnType: 'void',
            handler: async (params) => {
                await manager.setCustomMetadata(
                    params.conversationId as string,
                    params.key as string,
                    params.value
                );
            }
        },

        {
            name: 'getCustomMetadata',
            description: '获取对话自定义元数据',
            parameters: [
                {
                    name: 'conversationId',
                    type: 'string',
                    required: true,
                    description: '对话 ID'
                },
                {
                    name: 'key',
                    type: 'string',
                    required: true,
                    description: '元数据键'
                }
            ],
            returnType: 'any',
            handler: async (params) => {
                return await manager.getCustomMetadata(
                    params.conversationId as string,
                    params.key as string
                );
            }
        },

        {
            name: 'getConversationMetadata',
            description: '获取完整的对话元数据',
            parameters: [
                {
                    name: 'conversationId',
                    type: 'string',
                    required: true,
                    description: '对话 ID'
                }
            ],
            returnType: 'ConversationMetadata | null',
            handler: async (params) => {
                return await manager.getMetadata(params.conversationId as string);
            }
        }
    ];
}
