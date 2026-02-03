/**
 * 在文件中搜索（和替换）内容工具
 *
 * 支持多工作区（Multi-root Workspaces）
 * 支持正则表达式搜索和替换
 */

import type { Tool, ToolResult } from '../types';
import { getAllWorkspaces, parseWorkspacePath } from '../utils';
import type { ReplaceResult, SearchMatch } from './search_in_files_core';
import {
    escapeRegex,
    getExcludePattern,
    getSearchRootAndPattern,
    searchAndReplaceInDirectory,
    searchInDirectory
} from './search_in_files_core';
import { normalizeReplacementArg } from './search_in_files_utils';

/**
 * 创建搜索文件内容工具
 */
export function createSearchInFilesTool(): Tool {
    // 获取工作区信息用于描述
    const workspaces = getAllWorkspaces();
    const isMultiRoot = workspaces.length > 1;
    
    let pathDescription = 'Search path relative to workspace root. Use "dir/" (trailing slash) for directories, or "dir/file.ext" for a single file. Default "." searches the entire workspace.';
    if (isMultiRoot) {
        pathDescription = `Search path, use "workspace_name/path" format. Use "workspace_name/dir/" (trailing slash) for directories, or "workspace_name/file.ext" for a single file. Use "." to search all workspaces. Available workspaces: ${workspaces.map(w => w.name).join(', ')}`;
    }
    
    return {
        declaration: {
            name: 'search_in_files',
            description: isMultiRoot
                ? `Search (and optionally replace) content in multiple workspace files. Supports regular expressions. Use "workspace_name/dir/" (trailing slash) for directories, or "workspace_name/file.ext" for a single file. Use "." to search all workspaces. Available workspaces: ${workspaces.map(w => w.name).join(', ')}`
                : 'Search (and optionally replace) content in workspace files. Supports regular expressions. Use "dir/" (trailing slash) for directories, or "dir/file.ext" for a single file. Returns matching files and context. If "replace" is provided, performs replacement and saves changes.',
            category: 'search',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Search keyword or regular expression'
                    },
                    path: {
                        type: 'string',
                        description: pathDescription,
                        default: '.'
                    },
                    pattern: {
                        type: 'string',
                        description: 'File matching pattern, e.g., "*.ts" or "**/*.js"',
                        default: '**/*'
                    },
                    isRegex: {
                        type: 'boolean',
                        description: 'Whether to treat query as a regular expression',
                        default: false
                    },
                    replace: {
                        type: 'string',
                        description: 'Replacement string. If provided, matching content will be replaced. Supports regex capture groups like $1, $2 when isRegex is true.'
                    },
                    dryRun: {
                        type: 'boolean',
                        description: 'If true, only preview replacements without actually modifying files',
                        default: false
                    },
                    maxResults: {
                        type: 'number',
                        description: 'Maximum number of match results (for search only mode)',
                        default: 100
                    },
                    maxFiles: {
                        type: 'number',
                        description: 'Maximum number of files to process (for replace mode)',
                        default: 50
                    }
                },
                required: ['query']
            }
        },
	        handler: async (args): Promise<ToolResult> => {
	            const query = args.query as string;
	            const searchPath = (args.path as string) || '.';
	            const filePattern = (args.pattern as string) || '**/*';
	            const isRegex = (args.isRegex as boolean) || false;
	            const replacement = normalizeReplacementArg(args.replace);
	            const dryRun = (args.dryRun as boolean) || false;
	            const maxResults = (args.maxResults as number) || 100;
	            const maxFiles = (args.maxFiles as number) || 50;

            if (!query) {
                return { success: false, error: 'query is required' };
            }

            const workspaces = getAllWorkspaces();
            if (workspaces.length === 0) {
                return { success: false, error: 'No workspace folder open' };
            }

	            const isReplaceMode = replacement !== undefined;

            try {
                // 创建搜索正则表达式
                // 对于搜索模式，使用 'gim' 标志（全局、不区分大小写、多行）
                // 对于替换模式，使用 'g' 标志（全局匹配）确保替换所有匹配项
                const flags = isReplaceMode ? 'g' : 'gim';
                const searchRegex = isRegex
                    ? new RegExp(query, flags)
                    : new RegExp(escapeRegex(query), flags);
                
                // 获取排除模式
                const excludePattern = getExcludePattern();
                
                // 解析路径，确定搜索范围
                const { workspace: targetWorkspace, relativePath, isExplicit } = parseWorkspacePath(searchPath);
                
                if (isReplaceMode) {
                    // 替换模式
                    let allMatches: SearchMatch[] = [];
                    let allReplacements: ReplaceResult[] = [];
                    let totalReplacements = 0;
                    
                    if (isExplicit && targetWorkspace) {
                        // 显式指定了工作区，只搜索该工作区
                        const { searchRoot, effectivePattern } = await getSearchRootAndPattern(
                            targetWorkspace.uri,
                            relativePath,
                            filePattern
                        );
                        const result = await searchAndReplaceInDirectory(
                            searchRoot,
                            effectivePattern,
                            searchRegex,
                            replacement,
                            maxFiles,
                            workspaces.length > 1 ? targetWorkspace.name : null,
                            excludePattern,
                            dryRun
                        );
                        allMatches = result.matches;
                        allReplacements = result.replacements;
                        totalReplacements = result.totalReplacements;
                    } else if (searchPath === '.' && workspaces.length > 1) {
                        // 搜索所有工作区
                        let remainingFiles = maxFiles;
                        for (const ws of workspaces) {
                            if (remainingFiles <= 0) break;
                            
                            const result = await searchAndReplaceInDirectory(
                                ws.uri,
                                filePattern,
                                searchRegex,
                                replacement,
                                remainingFiles,
                                ws.name,
                                excludePattern,
                                dryRun
                            );
                            allMatches.push(...result.matches);
                            allReplacements.push(...result.replacements);
                            totalReplacements += result.totalReplacements;
                            remainingFiles -= result.replacements.length;
                        }
                    } else {
                        // 单工作区或未指定，使用默认
                        const root = targetWorkspace?.uri || workspaces[0].uri;
                        const { searchRoot, effectivePattern } = await getSearchRootAndPattern(
                            root,
                            relativePath,
                            filePattern
                        );
                        const result = await searchAndReplaceInDirectory(
                            searchRoot,
                            effectivePattern,
                            searchRegex,
                            replacement,
                            maxFiles,
                            workspaces.length > 1 ? (targetWorkspace?.name || workspaces[0].name) : null,
                            excludePattern,
                            dryRun
                        );
                        allMatches = result.matches;
                        allReplacements = result.replacements;
                        totalReplacements = result.totalReplacements;
                    }
                    
                    return {
                        success: true,
                        data: {
                            matches: allMatches.map(m => ({
                                file: m.file,
                                workspace: m.workspace,
                                line: m.line,
                                column: m.column,
                                match: m.match
                                // 替换模式下不返回 context，减小体积，前端已有 diff 视图
                            })),
                            results: allReplacements,
                            filesModified: allReplacements.length,
                            totalReplacements,
                            multiRoot: workspaces.length > 1
                        }
                    };
                } else {
                    // 仅搜索模式
                    let allResults: SearchMatch[] = [];
                    
                    if (isExplicit && targetWorkspace) {
                        // 显式指定了工作区，只搜索该工作区
                        const { searchRoot, effectivePattern } = await getSearchRootAndPattern(
                            targetWorkspace.uri,
                            relativePath,
                            filePattern
                        );
                        allResults = await searchInDirectory(
                            searchRoot,
                            effectivePattern,
                            searchRegex,
                            maxResults,
                            workspaces.length > 1 ? targetWorkspace.name : null,
                            excludePattern
                        );
                    } else if (searchPath === '.' && workspaces.length > 1) {
                        // 搜索所有工作区
                        for (const ws of workspaces) {
                            if (allResults.length >= maxResults) break;
                            
                            const remaining = maxResults - allResults.length;
                            const wsResults = await searchInDirectory(
                                ws.uri,
                                filePattern,
                                searchRegex,
                                remaining,
                                ws.name,
                                excludePattern
                            );
                            allResults.push(...wsResults);
                        }
                    } else {
                        // 单工作区或未指定，使用默认
                        const root = targetWorkspace?.uri || workspaces[0].uri;
                        const { searchRoot, effectivePattern } = await getSearchRootAndPattern(
                            root,
                            relativePath,
                            filePattern
                        );
                        allResults = await searchInDirectory(
                            searchRoot,
                            effectivePattern,
                            searchRegex,
                            maxResults,
                            workspaces.length > 1 ? (targetWorkspace?.name || workspaces[0].name) : null,
                            excludePattern
                        );
                    }

                    return {
                        success: true,
                        data: {
                            results: allResults,
                            count: allResults.length,
                            truncated: allResults.length >= maxResults,
                            multiRoot: workspaces.length > 1
                        }
                    };
                }
            } catch (error) {
                return {
                    success: false,
                    error: `Search failed: ${error instanceof Error ? error.message : String(error)}`
                };
            }
        }
    };
}

/**
 * 注册搜索文件内容工具
 */
export function registerSearchInFiles(): Tool {
    return createSearchInFilesTool();
}
