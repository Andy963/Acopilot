import type { ApiDefinition } from '../../../core/registry';
import type { ConversationManager } from '../ConversationManager';

export function createConversationAdminApis(manager: ConversationManager): ApiDefinition[] {
    return [
        // ========== 对话管理 ==========
        {
            name: 'createConversation',
            description: '创建新对话',
            parameters: [
                {
                    name: 'conversationId',
                    type: 'string',
                    required: true,
                    description: '对话 ID'
                },
                {
                    name: 'title',
                    type: 'string',
                    required: false,
                    description: '对话标题'
                },
                {
                    name: 'workspaceUri',
                    type: 'string',
                    required: false,
                    description: '工作区 URI'
                }
            ],
            returnType: 'void',
            handler: async (params) => {
                await manager.createConversation(
                    params.conversationId as string,
                    params.title as string | undefined,
                    params.workspaceUri as string | undefined
                );
            }
        },

        {
            name: 'deleteConversation',
            description: '删除对话',
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
                await manager.deleteConversation(params.conversationId as string);
            }
        },

        {
            name: 'listConversations',
            description: '列出所有对话',
            parameters: [],
            returnType: 'string[]',
            handler: async () => {
                return await manager.listConversations();
            }
        },

        {
            name: 'setTitle',
            description: '设置对话标题',
            parameters: [
                {
                    name: 'conversationId',
                    type: 'string',
                    required: true,
                    description: '对话 ID'
                },
                {
                    name: 'title',
                    type: 'string',
                    required: true,
                    description: '对话标题'
                }
            ],
            returnType: 'void',
            handler: async (params) => {
                await manager.setTitle(
                    params.conversationId as string,
                    params.title as string
                );
            }
        },

        {
            name: 'setWorkspaceUri',
            description: '设置对话的工作区 URI',
            parameters: [
                {
                    name: 'conversationId',
                    type: 'string',
                    required: true,
                    description: '对话 ID'
                },
                {
                    name: 'workspaceUri',
                    type: 'string',
                    required: true,
                    description: '工作区 URI'
                }
            ],
            returnType: 'void',
            handler: async (params) => {
                await manager.setWorkspaceUri(
                    params.conversationId as string,
                    params.workspaceUri as string
                );
            }
        },

        // ========== 工具调用管理 ==========
        {
            name: 'rejectToolCalls',
            description: '标记指定消息中的工具调用为拒绝状态',
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
                    name: 'toolCallIds',
                    type: 'array',
                    required: false,
                    description: '要标记为拒绝的工具调用 ID 列表（如果为空，则标记所有未执行的工具）'
                }
            ],
            returnType: 'void',
            handler: async (params) => {
                await manager.rejectToolCalls(
                    params.conversationId as string,
                    params.messageIndex as number,
                    params.toolCallIds as string[] | undefined
                );
            }
        }
    ];
}
