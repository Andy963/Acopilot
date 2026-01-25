/**
 * 写入文件工具
 *
 * 支持写入单个或多个文件
 * 支持多工作区（Multi-root Workspaces）
 */

import * as vscode from 'vscode';
import * as path from 'path';
import type { Tool, ToolResult } from '../types';
import { resolveUriWithInfo, getAllWorkspaces } from '../utils';
import { getDiffStorageManager } from '../../modules/conversation';

/**
 * 单个文件写入配置
 */
interface WriteFileEntry {
    path: string;
    content: string;
}

/**
 * 单个文件写入结果
 * 简化版：AI 已经知道写入的内容，不需要重复返回
 */
interface WriteResult {
    path: string;
    success: boolean;
    action?: 'created' | 'modified' | 'unchanged';
    status?: 'accepted' | 'rejected' | 'pending';
    error?: string;
    /** 前端按需加载 diff 内容用 */
    diffContentId?: string;
}

/**
 * 写入单个文件
 * @param entry 文件条目
 * @param isMultiRoot 是否是多工作区模式
 */
async function writeSingleFile(entry: WriteFileEntry): Promise<WriteResult> {
    const { path: filePath, content } = entry;
    
    const { uri, error } = resolveUriWithInfo(filePath);
    if (!uri) {
        return {
            path: filePath,
            success: false,
            error: error || 'No workspace folder open'
        };
    }

    const absolutePath = uri.fsPath;

    try {
        // 检查文件是否存在并获取原始内容
        let originalContent = '';
        let fileExists = false;
        
        const openedDoc = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri.toString());
        if (openedDoc) {
            fileExists = true;
            originalContent = openedDoc.getText();
        } else {
            try {
                await vscode.workspace.fs.stat(uri);
                fileExists = true;
                const contentBytes = await vscode.workspace.fs.readFile(uri);
                originalContent = new TextDecoder().decode(contentBytes);
            } catch {
                // 文件不存在，原始内容为空
                fileExists = false;
                originalContent = '';
            }
        }

        // 如果内容相同，无需修改
        if (originalContent === content) {
            return {
                path: filePath,
                success: true,
                action: 'unchanged'
            };
        }

        // 方案A：使用 WorkspaceEdit 在后台直接写入并保存（不打开任何编辑器 Tab）
        const edit = new vscode.WorkspaceEdit();

        // 如果文件不存在，先创建目录+文件
        if (!fileExists) {
            const dirUri = vscode.Uri.file(path.dirname(absolutePath));
            await vscode.workspace.fs.createDirectory(dirUri);
            edit.createFile(uri, { overwrite: true });
            edit.insert(uri, new vscode.Position(0, 0), content);
        } else {
            const doc = await vscode.workspace.openTextDocument(uri);
            const currentText = doc.getText();
            const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(currentText.length));
            edit.replace(uri, fullRange, content);
        }

        await vscode.workspace.applyEdit(edit);

        // 保存文档（尽量只保存当前文件）
        const doc = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri.toString())
            || await vscode.workspace.openTextDocument(uri);
        const saved = await doc.save();
        if (!saved) {
            // 兜底：直接写入文件系统
            await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
        }
        
        // 尝试将内容保存到 DiffStorageManager，供前端按需加载
        const diffStorageManager = getDiffStorageManager();
        let diffContentId: string | undefined;
        
        if (diffStorageManager) {
            try {
                const diffRef = await diffStorageManager.saveGlobalDiff({
                    originalContent,
                    newContent: content,
                    filePath
                });
                diffContentId = diffRef.diffId;
            } catch (e) {
                console.warn('Failed to save diff content to storage:', e);
            }
        }
        
        // 简化返回：AI 已经知道写入的内容，不需要重复返回
        return {
            path: filePath,
            success: true,
            action: fileExists ? 'modified' : 'created',
            status: 'accepted',
            diffContentId
        };
    } catch (error) {
        return {
            path: filePath,
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * 创建写入文件工具
 * 使用 DiffManager 来管理文件修改的审阅流程
 */
export function createWriteFileTool(): Tool {
    // 获取工作区信息
    const workspaces = getAllWorkspaces();
    const isMultiRoot = workspaces.length > 1;
    
    // 数组格式强调说明
    const arrayFormatNote = '\n\n**IMPORTANT**: The `files` parameter MUST be an array, even for a single file. Example: `{"files": [{"path": "file.txt", "content": "..."}]}`, NOT `{"path": "file.txt", "content": "..."}`.';
    
    // 根据工作区数量生成描述
    let description = 'Write content to one or more files. Changes are applied and saved in the background (no editor tabs are opened). A diff preview is available in the UI for review.' + arrayFormatNote;
    let pathDescription = 'File path (relative to workspace root)';
    
    if (isMultiRoot) {
        description += `\n\nMulti-root workspace: Must use "workspace_name/path" format. Available workspaces: ${workspaces.map(w => w.name).join(', ')}`;
        pathDescription = `File path, must use "workspace_name/path" format`;
    }
    
    return {
        declaration: {
            name: 'write_file',
            description,
            category: 'file',
            parameters: {
                type: 'object',
                properties: {
                    files: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                path: {
                                    type: 'string',
                                    description: pathDescription
                                },
                                content: {
                                    type: 'string',
                                    description: 'The content to write to the file'
                                }
                            },
                            required: ['path', 'content']
                        },
                        description: 'Array of files to write, each element containing path and content. MUST be an array even for single file.'
                    }
                },
                required: ['files']
            }
        },
        handler: async (args, toolContext): Promise<ToolResult> => {
            const fileList = args.files as WriteFileEntry[] | undefined;
            
            if (!fileList || !Array.isArray(fileList) || fileList.length === 0) {
                return { success: false, error: 'files is required' };
            }
            
            // 获取工作区信息
            const workspaces = getAllWorkspaces();
            const isMultiRoot = workspaces.length > 1;

            const results: WriteResult[] = [];
            let successCount = 0;
            let failCount = 0;
            let createdCount = 0;
            let modifiedCount = 0;
            let unchangedCount = 0;

            for (const entry of fileList) {
                const result = await writeSingleFile(entry);
                results.push(result);
                
                if (result.success) {
                    successCount++;
                    if (result.action === 'created') createdCount++;
                    else if (result.action === 'modified') modifiedCount++;
                    else if (result.action === 'unchanged') unchangedCount++;
                } else {
                    failCount++;
                }
            }

            const allSuccess = failCount === 0;
            
            // 简化返回：AI 已经知道写入的内容，只需要知道结果
            return {
                success: allSuccess,
                data: {
                    results,
                    successCount,
                    failCount,
                    totalCount: fileList.length
                },
                error: allSuccess ? undefined : `${failCount} files failed to write`
            };
        }
    };
}

/**
 * 注册写入文件工具
 */
export function registerWriteFile(): Tool {
    return createWriteFileTool();
}
