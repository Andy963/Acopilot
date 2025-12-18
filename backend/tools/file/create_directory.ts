/**
 * 创建目录工具
 *
 * 支持创建单个或多个目录
 * 支持多工作区（Multi-root Workspaces）
 */

import * as vscode from 'vscode';
import type { Tool, ToolResult } from '../types';
import { resolveUri, getAllWorkspaces } from '../utils';

/**
 * 单个目录创建结果
 */
interface CreateResult {
    path: string;
    success: boolean;
    error?: string;
}

/**
 * 创建单个目录
 */
async function createSingleDirectory(dirPath: string): Promise<CreateResult> {
    const uri = resolveUri(dirPath);
    if (!uri) {
        return {
            path: dirPath,
            success: false,
            error: 'No workspace folder open'
        };
    }

    try {
        await vscode.workspace.fs.createDirectory(uri);
        return {
            path: dirPath,
            success: true
        };
    } catch (error) {
        return {
            path: dirPath,
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * 创建创建目录工具
 */
export function createCreateDirectoryTool(): Tool {
    // 获取工作区信息
    const workspaces = getAllWorkspaces();
    const isMultiRoot = workspaces.length > 1;
    
    // 根据工作区数量生成描述
    let description = 'Create one or more directories in the workspace (parent directories will be created automatically)';
    let pathsDescription = 'List of directory paths (relative to workspace root)';
    
    if (isMultiRoot) {
        description += `\n\nMulti-root workspace: Must use "workspace_name/path" format. Available workspaces: ${workspaces.map(w => w.name).join(', ')}`;
        pathsDescription = `List of directory paths, must use "workspace_name/path" format`;
    }
    
    return {
        declaration: {
            name: 'create_directory',
            description,
            category: 'file',
            parameters: {
                type: 'object',
                properties: {
                    paths: {
                        type: 'array',
                        items: {
                            type: 'string'
                        },
                        description: pathsDescription
                    }
                },
                required: ['paths']
            }
        },
        handler: async (args): Promise<ToolResult> => {
            const pathList = args.paths as string[];
            if (!pathList || !Array.isArray(pathList) || pathList.length === 0) {
                return { success: false, error: 'paths is required' };
            }

            const results: CreateResult[] = [];
            let successCount = 0;
            let failCount = 0;

            for (const dirPath of pathList) {
                const result = await createSingleDirectory(dirPath);
                results.push(result);
                
                if (result.success) {
                    successCount++;
                } else {
                    failCount++;
                }
            }

            const allSuccess = failCount === 0;
            return {
                success: allSuccess,
                data: {
                    results,
                    successCount,
                    failCount,
                    totalCount: pathList.length
                },
                error: allSuccess ? undefined : `${failCount} directories failed to create`
            };
        }
    };
}

/**
 * 注册创建目录工具
 */
export function registerCreateDirectory(): Tool {
    return createCreateDirectoryTool();
}