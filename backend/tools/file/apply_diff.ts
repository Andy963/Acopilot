/**
 * Apply Diff 工具 - 精确搜索替换文件内容
 * 支持多工作区（Multi-root Workspaces）
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import type { Tool, ToolResult } from '../types';
import { resolveUriWithInfo, getAllWorkspaces } from '../utils';
import { getDiffStorageManager } from '../../modules/conversation';
import { applyReplaceBlock } from './replaceBlock';

/**
 * 单个 diff 块
 */
interface DiffBlock {
    /** 要搜索的内容（必须 100% 精确匹配） */
    search: string;
    /** 替换后的内容 */
    replace: string;
    /** 搜索起始行号（1-based，可选） */
    start_line?: number;
}

/**
 * 创建 apply_diff 工具
 */
export function createApplyDiffTool(): Tool {
    // 获取工作区信息
    const workspaces = getAllWorkspaces();
    const isMultiRoot = workspaces.length > 1;
    
    // 根据工作区数量生成描述
    let pathDescription = 'Path to the file (relative to workspace root)';
    let descriptionSuffix = '';
    
    if (isMultiRoot) {
        pathDescription = `Path to the file, must use "workspace_name/path" format. Available workspaces: ${workspaces.map(w => w.name).join(', ')}`;
        descriptionSuffix = `\n\nMulti-root workspace: Must use "workspace_name/path" format. Available workspaces: ${workspaces.map(w => w.name).join(', ')}`;
    }
    
    return {
        declaration: {
            name: 'apply_diff',
            category: 'file',
            description: `Apply precise search-and-replace diff(s) to a file. The search content must match EXACTLY (including whitespace and indentation).

Parameters:
- path: Path to the file (relative to workspace root)
- diffs: Array of diff objects to apply

Each diff object contains:
- search: The exact content to search for (must match 100%)
- replace: The content to replace with
- start_line: (REQUIRED) The line number (1-based) where search content starts in the original file

Important:
- The 'search' content must match EXACTLY (100% match required)
- The 'start_line' parameter is REQUIRED for accurate diff positioning
- Include enough context to make the search unique
- Diffs are applied in order
- Changes are applied and saved in the background (no editor tabs are opened)

**IMPORTANT**: The \`diffs\` parameter MUST be an array, even for a single diff. Example: \`{"path": "file.txt", "diffs": [{"search": "...", "replace": "...", "start_line": 1}]}\`${descriptionSuffix}`,
            
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: pathDescription
                    },
                    diffs: {
                        type: 'array',
                        description: 'Array of diff objects to apply. MUST be an array even for a single diff.',
                        items: {
                            type: 'object',
                            properties: {
                                search: {
                                    type: 'string',
                                    description: 'The exact content to search for'
                                },
                                replace: {
                                    type: 'string',
                                    description: 'The content to replace with'
                                },
                                start_line: {
                                    type: 'number',
                                    description: 'Line number (1-based) where search content starts in the original file (REQUIRED)'
                                }
                            },
                            required: ['search', 'replace', 'start_line']
                        }
                    }
                },
                required: ['path', 'diffs']
            }
        },
        handler: async (args, toolContext): Promise<ToolResult> => {
            const filePath = args.path as string;
            const diffs = args.diffs as DiffBlock[] | undefined;
            
            if (!filePath || typeof filePath !== 'string') {
                return { success: false, error: 'Path is required' };
            }
            
            if (!diffs || !Array.isArray(diffs) || diffs.length === 0) {
                return { success: false, error: 'Diffs array is required and must not be empty' };
            }
            
            const { uri, workspace, error } = resolveUriWithInfo(filePath);
            if (!uri) {
                return { success: false, error: error || 'No workspace folder open' };
            }
            
            const absolutePath = uri.fsPath;
            if (!fs.existsSync(absolutePath)) {
                return { success: false, error: `File not found: ${filePath}` };
            }
            
            try {
                const openedDoc = vscode.workspace.textDocuments.find(d => d.uri.fsPath === absolutePath);
                const originalContent = openedDoc ? openedDoc.getText() : fs.readFileSync(absolutePath, 'utf8');
                let currentContent = originalContent;
                
                // 记录每个 diff 的应用结果
                const diffResults: Array<{
                    index: number;
                    success: boolean;
                    error?: string;
                    matchedLine?: number;
                }> = [];
                
                // 依次尝试应用每个 diff
                for (let i = 0; i < diffs.length; i++) {
                    const diff = diffs[i];
                    
                    if (!diff.search || diff.replace === undefined) {
                        diffResults.push({
                            index: i,
                            success: false,
                            error: `Diff at index ${i} is missing 'search' or 'replace' field`
                        });
                        continue;
                    }
                    
                    const result = applyReplaceBlock(currentContent, diff.search, diff.replace, {
                        startLine: diff.start_line
                    });
                    
                    diffResults.push({
                        index: i,
                        success: result.success,
                        error: result.error,
                        matchedLine: result.matchedLine
                    });
                    
                    if (result.success) {
                        currentContent = result.result;
                    }
                }
                
                const appliedCount = diffResults.filter(r => r.success).length;
                const failedCount = diffResults.length - appliedCount;
                
                // 收集失败的 diff 信息供 AI 参考
                const failedDiffs = diffResults
                    .filter(r => !r.success)
                    .map(r => ({
                        index: r.index,
                        error: r.error
                    }));
                
                // 如果没有任何一个 diff 成功应用，则返回失败
                if (appliedCount === 0 && diffs.length > 0) {
                    const firstError = diffResults.find(r => !r.success)?.error || 'All diffs failed';
                    return {
                        success: false,
                        error: `Failed to apply any diffs: ${firstError}`,
                        data: {
                            file: filePath,
                            message: `Failed to apply any diffs to ${filePath}.`,
                            // 包含失败详情供 AI 修复
                            failedDiffs,
                            appliedCount: 0,
                            totalCount: diffs.length,
                            failedCount: diffs.length
                        }
                    };
                }
                
                // 至少有一个 diff 成功应用，创建待审阅的 diff
                // 方案A：使用 WorkspaceEdit 在后台直接应用并保存（不打开任何编辑器 Tab）
                const doc = await vscode.workspace.openTextDocument(uri);
                const currentText = doc.getText();
                if (currentText !== currentContent) {
                    const edit = new vscode.WorkspaceEdit();
                    const fullRange = new vscode.Range(
                        doc.positionAt(0),
                        doc.positionAt(currentText.length)
                    );
                    edit.replace(uri, fullRange, currentContent);
                    await vscode.workspace.applyEdit(edit);
                }

                const saved = await doc.save();
                if (!saved) {
                    // 如果 VSCode API 保存失败，尝试直接写入文件
                    fs.writeFileSync(absolutePath, currentContent, 'utf8');
                }
                
                // 尝试将大内容保存到 DiffStorageManager
                const diffStorageManager = getDiffStorageManager();
                let diffContentId: string | undefined;
                
                if (diffStorageManager) {
                    try {
                        const diffRef = await diffStorageManager.saveGlobalDiff({
                            originalContent,
                            newContent: currentContent,
                            filePath
                        });
                        diffContentId = diffRef.diffId;
                    } catch (e) {
                        console.warn('Failed to save diff content to storage:', e);
                    }
                }
                
                // 简化返回：AI 已经知道 diffs 内容，不需要重复返回
                let message = `Diff applied and saved to ${filePath}`;
                
                if (failedCount > 0) {
                    message = `Partially applied diffs to ${filePath}: ${appliedCount} succeeded, ${failedCount} failed. Saved successfully.`;
                }

                return {
                    success: true,
                    data: {
                        file: filePath,
                        message,
                        status: 'accepted',
                        diffCount: diffs.length,
                        appliedCount: appliedCount,
                        failedCount: failedCount,
                        // 包含失败详情供 AI 修复
                        failedDiffs: failedDiffs.length > 0 ? failedDiffs : undefined,
                        // 仅供前端按需加载用，不发送给 AI
                        diffContentId
                    }
                };
            } catch (error) {
                return {
                    success: false,
                    error: `Failed to apply diff: ${error instanceof Error ? error.message : String(error)}`
                };
            }
        }
    };
}

/**
 * 注册 apply_diff 工具
 */
export function registerApplyDiff(): Tool {
    return createApplyDiffTool();
}
