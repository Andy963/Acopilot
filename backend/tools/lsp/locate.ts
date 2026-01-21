/**
 * locate 工具（占位/配置入口）
 *
 * 该工具本身不做代码修改，主要用于“/locate”定位模式的配置入口。
 * 建议通过聊天输入 `/locate <问题描述>` 触发定位模式：
 * - 使用可选的定位模型（toolsConfig.locate.model）
 * - 限制可用工具集合（只读 + open_file）
 */

import type { Tool } from '../types';

export function createLocateTool(): Tool {
    return {
        declaration: {
            name: 'locate',
            description:
                'Locate mode configuration entry. Use `/locate <issue>` in chat to quickly locate and open relevant files. ' +
                'This tool itself does not perform actions when called by the model.',
            category: 'lsp',
            parameters: {
                type: 'object',
                properties: {
                    note: {
                        type: 'string',
                        description: 'Optional note. Prefer using `/locate` command instead.'
                    }
                }
            }
        },
        handler: async () => {
            return {
                success: true,
                data: {
                    message: 'Use `/locate <issue>` in chat to run locate mode.'
                }
            };
        }
    };
}

export function registerLocate(): Tool {
    return createLocateTool();
}

