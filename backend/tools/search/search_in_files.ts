/**
 * Search content in workspace files.
 *
 * - Supports multi-root workspaces
 * - Supports regular expression search
 * - Read-only: never modifies files
 */

import type { Tool, ToolResult } from '../types';
import { getAllWorkspaces, parseWorkspacePath } from '../utils';
import type { SearchMatch } from './search_in_files_core';
import {
    escapeRegex,
    getExcludePattern,
    getSearchRootAndPattern,
    searchInDirectory
} from './search_in_files_core';

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
                ? `Search content in multiple workspace files. Supports regular expressions. Read-only: does not modify files. Use "workspace_name/dir/" (trailing slash) for directories, or "workspace_name/file.ext" for a single file. Use "." to search all workspaces. Available workspaces: ${workspaces.map(w => w.name).join(', ')}`
                : 'Search content in workspace files. Supports regular expressions. Read-only: does not modify files. Use "dir/" (trailing slash) for directories, or "dir/file.ext" for a single file. Returns matching files and context.',
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
                    maxResults: {
                        type: 'number',
                        description: 'Maximum number of match results (for search only mode)',
                        default: 100
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
            const maxResults = (args.maxResults as number) || 100;

            if (args.replace !== undefined) {
                return { success: false, error: 'search_in_files is read-only. Use replace_in_files for replacements.' };
            }

            if (!query) {
                return { success: false, error: 'query is required' };
            }

            const workspaces = getAllWorkspaces();
            if (workspaces.length === 0) {
                return { success: false, error: 'No workspace folder open' };
            }

            try {
                const flags = 'gim';
                const searchRegex = isRegex
                    ? new RegExp(query, flags)
                    : new RegExp(escapeRegex(query), flags);

                const excludePattern = getExcludePattern();
                const { workspace: targetWorkspace, relativePath, isExplicit } = parseWorkspacePath(searchPath);

                let allResults: SearchMatch[] = [];

                if (isExplicit && targetWorkspace) {
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
                        multiRoot: workspaces.length > 1,
                    },
                };
            } catch (error) {
                return {
                    success: false,
                    error: `Search failed: ${error instanceof Error ? error.message : String(error)}`,
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
