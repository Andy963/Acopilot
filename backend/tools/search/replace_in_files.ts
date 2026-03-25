/**
 * Replace content in workspace files.
 *
 * - Supports multi-root workspaces
 * - Supports regular expression search
 * - Saves changes to disk when dryRun is false
 */

import type { Tool, ToolResult } from '../types';
import { getAllWorkspaces, parseWorkspacePath } from '../utils';
import type { ReplaceResult, SearchMatch } from './search_in_files_core';
import {
  escapeRegex,
  getExcludePattern,
  getSearchRootAndPattern,
  searchAndReplaceInDirectory,
} from './search_in_files_core';

export function createReplaceInFilesTool(): Tool {
  const workspaces = getAllWorkspaces();
  const isMultiRoot = workspaces.length > 1;

  let pathDescription =
    'Replace path relative to workspace root. Use "dir/" (trailing slash) for directories, or "dir/file.ext" for a single file. Default "." targets the entire workspace.';
  if (isMultiRoot) {
    pathDescription = `Replace path, use "workspace_name/path" format. Use "workspace_name/dir/" (trailing slash) for directories, or "workspace_name/file.ext" for a single file. Use "." to target all workspaces. Available workspaces: ${workspaces.map((w) => w.name).join(', ')}`;
  }

  return {
    declaration: {
      name: 'replace_in_files',
      description: isMultiRoot
        ? `Replace content in multiple workspace files. Supports regular expressions. Use "workspace_name/dir/" (trailing slash) for directories, or "workspace_name/file.ext" for a single file. Use "." to target all workspaces. Available workspaces: ${workspaces.map((w) => w.name).join(', ')}`
        : 'Replace content in workspace files. Supports regular expressions. Use "dir/" (trailing slash) for directories, or "dir/file.ext" for a single file. Saves changes to disk when dryRun is false.',
      category: 'search',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search keyword or regular expression',
          },
          replace: {
            type: 'string',
            description:
              'Replacement string. Supports regex capture groups like $1, $2 when isRegex is true.',
          },
          path: {
            type: 'string',
            description: pathDescription,
            default: '.',
          },
          pattern: {
            type: 'string',
            description: 'File matching pattern, e.g., "*.ts" or "**/*.js"',
            default: '**/*',
          },
          isRegex: {
            type: 'boolean',
            description: 'Whether to treat query as a regular expression',
            default: false,
          },
          dryRun: {
            type: 'boolean',
            description: 'If true, only preview replacements without actually modifying files',
            default: false,
          },
          maxFiles: {
            type: 'number',
            description: 'Maximum number of files to process',
            default: 50,
          },
        },
        required: ['query', 'replace'],
      },
    },
    handler: async (args): Promise<ToolResult> => {
      const query = args.query as string;
      const replacement = args.replace as string;
      const replacePath = (args.path as string) || '.';
      const filePattern = (args.pattern as string) || '**/*';
      const isRegex = (args.isRegex as boolean) || false;
      const dryRun = (args.dryRun as boolean) || false;
      const maxFiles = (args.maxFiles as number) || 50;

      if (!query) {
        return { success: false, error: 'query is required' };
      }

      if (replacement === undefined || replacement === null || typeof replacement !== 'string') {
        return { success: false, error: 'replace is required (string)' };
      }

      const workspaces = getAllWorkspaces();
      if (workspaces.length === 0) {
        return { success: false, error: 'No workspace folder open' };
      }

      try {
        const flags = 'g';
        const searchRegex = isRegex ? new RegExp(query, flags) : new RegExp(escapeRegex(query), flags);

        const excludePattern = getExcludePattern();
        const { workspace: targetWorkspace, relativePath, isExplicit } = parseWorkspacePath(replacePath);

        let allMatches: SearchMatch[] = [];
        let allReplacements: ReplaceResult[] = [];
        let totalReplacements = 0;

        if (isExplicit && targetWorkspace) {
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
        } else if (replacePath === '.' && workspaces.length > 1) {
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
          const root = targetWorkspace?.uri || workspaces[0].uri;
          const { searchRoot, effectivePattern } = await getSearchRootAndPattern(root, relativePath, filePattern);
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
            isReplaceMode: true,
            matches: allMatches.map((m) => ({
              file: m.file,
              workspace: m.workspace,
              line: m.line,
              column: m.column,
              match: m.match,
            })),
            results: allReplacements,
            filesModified: allReplacements.length,
            totalReplacements,
            multiRoot: workspaces.length > 1,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Replace failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  };
}

export function registerReplaceInFiles(): Tool {
  return createReplaceInFilesTool();
}

