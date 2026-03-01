import type { ApiDefinition } from '../../../core/registry';
import type { ConversationManager } from '../ConversationManager';

export function createConversationMessageApis(manager: ConversationManager): ApiDefinition[] {
    return [
        // ========== 消息操作 ==========
        {
            name: 'addMessage',
            description: '添加消息到对话历史',
            parameters: [
                {
                    name: 'conversationId',
                    type: 'string',
                    required: true,
                    description: '对话 ID'
                },
                {
                    name: 'role',
                    type: 'string',
                    required: true,
                    description: '消息角色 (user/model)'
                },
                {
                    name: 'parts',
                    type: 'array',
                    required: true,
                    description: '消息内容部分'
                }
            ],
            returnType: 'void',
            handler: async (params) => {
                const { conversationId, role, parts } = params;
                await manager.addMessage(
                    conversationId as string,
                    role as 'user' | 'model',
                    parts as any[]
                );
            }
        },

        {
            name: 'getMessages',
            description: '获取对话历史中的所有消息',
            parameters: [
                {
                    name: 'conversationId',
                    type: 'string',
                    required: true,
                    description: '对话 ID'
                }
            ],
            returnType: 'Content[]',
            handler: async (params) => {
                return await manager.getMessages(params.conversationId as string);
            }
        },

        {
            name: 'getHistoryForAPI',
            description: '获取适合 API 调用的对话历史（可选择是否包含思考内容，不含 token 字段）',
            parameters: [
                {
                    name: 'conversationId',
                    type: 'string',
                    required: true,
                    description: '对话 ID'
                },
                {
                    name: 'includeThoughts',
                    type: 'boolean',
                    required: false,
                    description: '是否包含思考内容（默认 false）'
                }
            ],
            returnType: 'Content[]',
            handler: async (params) => {
                return await manager.getHistoryForAPI(
                    params.conversationId as string,
                    params.includeThoughts as boolean | undefined
                );
            }
        },

        {
            name: 'updateMessage',
            description: '更新指定消息',
            parameters: [
                {
                    name: 'conversationId',
                    type: 'string',
                    required: true,
                    description: '对话 ID'
                },
                {
                    name: 'messageIndex',
                    type: 'number',
                    required: true,
                    description: '消息索引'
                },
                {
                    name: 'updates',
                    type: 'object',
                    required: true,
                    description: '要更新的字段'
                }
            ],
            returnType: 'void',
            handler: async (params) => {
                await manager.updateMessage(
                    params.conversationId as string,
                    params.messageIndex as number,
                    params.updates as any
                );
            }
        },

        {
            name: 'deleteMessage',
            description: '删除指定消息',
            parameters: [
                {
                    name: 'conversationId',
                    type: 'string',
                    required: true,
                    description: '对话 ID'
                },
                {
                    name: 'messageIndex',
                    type: 'number',
                    required: true,
                    description: '消息索引'
                }
            ],
            returnType: 'void',
            handler: async (params) => {
                await manager.deleteMessage(
                    params.conversationId as string,
                    params.messageIndex as number
                );
            }
        },

        {
            name: 'insertMessage',
            description: '在指定位置插入消息',
            parameters: [
                {
                    name: 'conversationId',
                    type: 'string',
                    required: true,
                    description: '对话 ID'
                },
                {
                    name: 'position',
                    type: 'number',
                    required: true,
                    description: '插入位置'
                },
                {
                    name: 'role',
                    type: 'string',
                    required: true,
                    description: '消息角色'
                },
                {
                    name: 'parts',
                    type: 'array',
                    required: true,
                    description: '消息内容部分'
                }
            ],
            returnType: 'void',
            handler: async (params) => {
                await manager.insertMessage(
                    params.conversationId as string,
                    params.position as number,
                    params.role as 'user' | 'model',
                    params.parts as any[]
                );
            }
        },

        // ========== 批量操作 ==========
        {
            name: 'deleteMessagesInRange',
            description: '删除指定范围的消息',
            parameters: [
                {
                    name: 'conversationId',
                    type: 'string',
                    required: true,
                    description: '对话 ID'
                },
                {
                    name: 'startIndex',
                    type: 'number',
                    required: true,
                    description: '起始索引（包含）'
                },
                {
                    name: 'endIndex',
                    type: 'number',
                    required: true,
                    description: '结束索引（包含）'
                }
            ],
            returnType: 'void',
            handler: async (params) => {
                await manager.deleteMessagesInRange(
                    params.conversationId as string,
                    params.startIndex as number,
                    params.endIndex as number
                );
            }
        },

        {
            name: 'clearHistory',
            description: '清空对话历史',
            parameters: [
                {
                    name: 'conversationId',
                    type: 'string',
                    required: true,
                    description: '对话 ID'
                }
            ],
            returnType: 'void',
            handler: async (params) => {
                await manager.clearHistory(params.conversationId as string);
            }
        },

        // ========== 查询和过滤 ==========
        {
            name: 'findMessages',
            description: '查找符合条件的消息',
            parameters: [
                {
                    name: 'conversationId',
                    type: 'string',
                    required: true,
                    description: '对话 ID'
                },
                {
                    name: 'filter',
                    type: 'object',
                    required: true,
                    description: '过滤条件'
                }
            ],
            returnType: 'MessagePosition[]',
            handler: async (params) => {
                return await manager.findMessages(
                    params.conversationId as string,
                    params.filter as any
                );
            }
        },

        {
            name: 'getMessagesByRole',
            description: '获取指定角色的所有消息',
            parameters: [
                {
                    name: 'conversationId',
                    type: 'string',
                    required: true,
                    description: '对话 ID'
                },
                {
                    name: 'role',
                    type: 'string',
                    required: true,
                    description: '消息角色'
                }
            ],
            returnType: 'Content[]',
            handler: async (params) => {
                return await manager.getMessagesByRole(
                    params.conversationId as string,
                    params.role as 'user' | 'model'
                );
            }
        }
    ];
}
