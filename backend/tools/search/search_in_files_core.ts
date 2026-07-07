/**
 * Search-in-files implementation helpers.
 *
 * Keep the tool entrypoint (`search_in_files.ts`) focused on argument parsing and orchestration.
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { getGlobalSettingsManager } from '../../core/settingsContext';
import { getDiffStorageManager } from '../../modules/conversation';
import { toRelativePath } from '../utils';

/**
 * Default exclude pattern.
 */
const DEFAULT_EXCLUDE = '**/node_modules/**';

/**
 * Get exclude pattern from user settings, fallback to default.
 *
 * Multiple patterns are merged using `{...}` glob syntax.
 */
export function getExcludePattern(toolName: 'search_in_files' | 'replace_in_files' = 'search_in_files'): string {
    const settingsManager = getGlobalSettingsManager();
    if (settingsManager) {
        const config = toolName === 'replace_in_files'
            ? settingsManager.getReplaceInFilesConfig()
            : settingsManager.getSearchInFilesConfig();
        if (config.excludePatterns && config.excludePatterns.length > 0) {
            if (config.excludePatterns.length === 1) {
                return config.excludePatterns[0];
            }
            return `{${config.excludePatterns.join(',')}}`;
        }
    }
    return DEFAULT_EXCLUDE;
}

/**
 * Escape a string for literal use in a RegExp.
 */
export function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Search match.
 */
export interface SearchMatch {
    file: string;
    workspace?: string;
    line: number;
    column: number;
    match: string;
    context: string;
}

/**
 * Replace result per file.
 */
export interface ReplaceResult {
    file: string;
    workspace?: string;
    replacements: number;
    diffContentId?: string;
}

/**
 * Search in a single directory (search-only mode).
 */
export async function searchInDirectory(
    searchRoot: vscode.Uri,
    filePattern: string,
    searchRegex: RegExp,
    maxResults: number,
    workspaceName: string | null,
    excludePattern: string
): Promise<SearchMatch[]> {
    const results: SearchMatch[] = [];

    const pattern = new vscode.RelativePattern(searchRoot, filePattern);
    const files = await vscode.workspace.findFiles(pattern, excludePattern, 1000);

    for (const fileUri of files) {
        if (results.length >= maxResults) {
            break;
        }

        try {
            const content = await vscode.workspace.fs.readFile(fileUri);
            const text = new TextDecoder().decode(content);
            const lines = text.split('\n');

            for (let i = 0; i < lines.length; i++) {
                if (results.length >= maxResults) {
                    break;
                }

                const line = lines[i];
                let match;
                searchRegex.lastIndex = 0;

                while ((match = searchRegex.exec(line)) !== null) {
                    if (results.length >= maxResults) {
                        break;
                    }

                    const contextLines = [];
                    if (i > 0) {
                        contextLines.push(`${i}: ${lines[i - 1]}`);
                    }
                    contextLines.push(`${i + 1}: ${line}`);
                    if (i < lines.length - 1) {
                        contextLines.push(`${i + 2}: ${lines[i + 1]}`);
                    }

                    const relativePath = toRelativePath(fileUri, workspaceName !== null);

                    results.push({
                        file: relativePath,
                        workspace: workspaceName || undefined,
                        line: i + 1,
                        column: match.index + 1,
                        match: match[0],
                        context: contextLines.join('\n')
                    });
                }
            }
        } catch {
            // Skip unreadable files.
        }
    }

    return results;
}

/**
 * Search and replace in a single directory.
 */
export async function searchAndReplaceInDirectory(
    searchRoot: vscode.Uri,
    filePattern: string,
    searchRegex: RegExp,
    replacement: string,
    maxFiles: number,
    workspaceName: string | null,
    excludePattern: string,
    dryRun: boolean
): Promise<{
    matches: SearchMatch[];
    replacements: ReplaceResult[];
    totalReplacements: number;
}> {
    const matches: SearchMatch[] = [];
    const replacements: ReplaceResult[] = [];
    let totalReplacements = 0;

    const pattern = new vscode.RelativePattern(searchRoot, filePattern);
    const files = await vscode.workspace.findFiles(pattern, excludePattern, 1000);

    let processedFiles = 0;

    for (const fileUri of files) {
        if (processedFiles >= maxFiles) {
            break;
        }

        try {
            const content = await vscode.workspace.fs.readFile(fileUri);
            const originalText = new TextDecoder().decode(content);
            const lines = originalText.split('\n');

            searchRegex.lastIndex = 0;
            if (!searchRegex.test(originalText)) {
                continue;
            }

            processedFiles++;

            const relativePath = toRelativePath(fileUri, workspaceName !== null);

            let fileReplacementCount = 0;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                let match;
                searchRegex.lastIndex = 0;

                while ((match = searchRegex.exec(line)) !== null) {
                    const contextLines = [];
                    if (i > 0) {
                        contextLines.push(`${i}: ${lines[i - 1]}`);
                    }
                    contextLines.push(`${i + 1}: ${line}`);
                    if (i < lines.length - 1) {
                        contextLines.push(`${i + 2}: ${lines[i + 1]}`);
                    }

                    matches.push({
                        file: relativePath,
                        workspace: workspaceName || undefined,
                        line: i + 1,
                        column: match.index + 1,
                        match: match[0],
                        context: contextLines.join('\n')
                    });

                    fileReplacementCount++;
                }
            }

            searchRegex.lastIndex = 0;
            const newText = originalText.replace(searchRegex, replacement);

            if (newText !== originalText) {
                totalReplacements += fileReplacementCount;

                let diffContentId: string | undefined;

                if (!dryRun) {
                    await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(newText));

                    const diffStorageManager = getDiffStorageManager();
                    if (diffStorageManager) {
                        try {
                            const diffRef = await diffStorageManager.saveGlobalDiff({
                                originalContent: originalText,
                                newContent: newText,
                                filePath: relativePath
                            });
                            diffContentId = diffRef.diffId;
                        } catch (e) {
                            console.warn('Failed to save diff content:', e);
                        }
                    }
                }

                replacements.push({
                    file: relativePath,
                    workspace: workspaceName || undefined,
                    replacements: fileReplacementCount,
                    diffContentId
                });
            }
        } catch {
            // Skip unreadable/unwritable files.
        }
    }

    return { matches, replacements, totalReplacements };
}

/**
 * Given a workspace root and a relative path, determine whether the path refers to a directory or a single file.
 *
 * If `relativePath` points to an existing file:
 * - `searchRoot` becomes the containing directory
 * - `effectivePattern` becomes the single filename
 *
 * Otherwise treat it as a directory:
 * - `searchRoot = rootUri + relativePath`
 * - `effectivePattern = filePattern`
 */
export async function getSearchRootAndPattern(
    rootUri: vscode.Uri,
    relativePath: string,
    filePattern: string
): Promise<{ searchRoot: vscode.Uri; effectivePattern: string }> {
    if (!relativePath || relativePath === '.' || relativePath === './') {
        return { searchRoot: rootUri, effectivePattern: filePattern };
    }

    const fullUri = vscode.Uri.joinPath(rootUri, relativePath);

    try {
        const stat = await vscode.workspace.fs.stat(fullUri);
        if (stat.type === vscode.FileType.File) {
            const fsPath = fullUri.fsPath;
            const dirPath = path.dirname(fsPath);
            const fileName = path.basename(fsPath);
            return {
                searchRoot: vscode.Uri.file(dirPath),
                effectivePattern: fileName
            };
        }
    } catch {
        // If stat fails (non-existent or permission issues), fall back to directory mode.
    }

    return {
        searchRoot: fullUri,
        effectivePattern: filePattern
    };
}

