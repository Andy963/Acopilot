/**
 * 获取错误诊断工具
 *
 * 直接从 VS Code diagnostics 获取编译/类型/语法等错误与警告信息，
 * 避免运行命令再解析输出。
 */

import * as vscode from 'vscode';
import type { Tool, ToolResult } from '../types';
import { getAllWorkspaces, resolveUriWithInfo, toRelativePath } from '../utils';

type SeverityString = 'error' | 'warning' | 'info' | 'hint';
type SeverityFilter = 'error' | 'warning' | 'all';

interface DiagnosticInfo {
    path: string;
    line: number;       // 1-based
    column: number;     // 1-based
    endLine: number;    // 1-based
    endColumn: number;  // 1-based
    severity: SeverityString;
    message: string;
    source?: string;
    code?: string | number;
    lineText?: string;
}

interface FileDiagnostics {
    path: string;
    totalDiagnostics: number;
    errorCount: number;
    warningCount: number;
    truncated: boolean;
    diagnostics: DiagnosticInfo[];
}

interface InvalidPathInfo {
    path: string;
    error: string;
}

interface GetErrorsResult {
    totalCount: number;
    errorCount: number;
    warningCount: number;
    matchedTotalCount: number;
    matchedErrorCount: number;
    matchedWarningCount: number;
    fileCount: number;
    files: FileDiagnostics[];
    truncated?: {
        maxFiles: number;
        maxDiagnostics: number;
        maxPerFile: number;
    };
    invalidPaths?: InvalidPathInfo[];
    message?: string;
}

function normalizeRelPath(p: string): string {
    return String(p || '').replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+$/, '');
}

function getSeverityString(severity: vscode.DiagnosticSeverity): SeverityString {
    switch (severity) {
        case vscode.DiagnosticSeverity.Error:
            return 'error';
        case vscode.DiagnosticSeverity.Warning:
            return 'warning';
        case vscode.DiagnosticSeverity.Information:
            return 'info';
        case vscode.DiagnosticSeverity.Hint:
            return 'hint';
    }
}

function shouldIncludeSeverity(severity: SeverityString, filter: SeverityFilter): boolean {
    if (filter === 'all') return true;
    if (filter === 'error') return severity === 'error';
    // warning: include warnings + errors
    return severity === 'error' || severity === 'warning';
}

type TargetFilter = {
    kind: 'file' | 'dir';
    rel: string;
    original: string;
};

function matchesTargets(relPath: string, targets: TargetFilter[]): boolean {
    if (targets.length === 0) return true;
    const normalized = normalizeRelPath(relPath);
    for (const t of targets) {
        const targetRel = normalizeRelPath(t.rel);
        if (!targetRel) continue;
        if (t.kind === 'file') {
            if (normalized === targetRel) return true;
            continue;
        }
        // dir
        if (normalized === targetRel || normalized.startsWith(`${targetRel}/`)) {
            return true;
        }
    }
    return false;
}

type RawDiagnostic = {
    uri: vscode.Uri;
    range: vscode.Range;
    severity: SeverityString;
    message: string;
    source?: string;
    code?: string | number;
};

export function createGetErrorsTool(): Tool {
    const workspaces = getAllWorkspaces();
    const isMultiRoot = workspaces.length > 1;

    let description = `Get compiler errors, warnings, and diagnostics from the editor.

This tool retrieves real-time diagnostics from language servers (TypeScript, ESLint, etc.) without running build commands.

Use cases:
- Check if changes introduced errors
- Find all type errors in a file or folder
- Get lint warnings before committing

If no paths are specified, returns diagnostics for the entire workspace.`;

    if (isMultiRoot) {
        description += `\n\nMulti-root workspace: Use "workspace_name/path" format. Available workspaces: ${workspaces.map(w => w.name).join(', ')}`;
    }

    const pathItemsDescription = isMultiRoot
        ? `File or folder path, use "workspace_name/path" format. Available workspaces: ${workspaces.map(w => w.name).join(', ')}`
        : 'File or folder path (relative to workspace root)';

    return {
        declaration: {
            name: 'get_errors',
            description,
            category: 'lsp',
            parameters: {
                type: 'object',
                properties: {
                    paths: {
                        type: 'array',
                        items: { type: 'string' },
                        description: `Optional list of file/folder paths to filter diagnostics. ${pathItemsDescription}. If omitted, checks entire workspace.`
                    },
                    severity: {
                        type: 'string',
                        enum: ['error', 'warning', 'all'],
                        description: 'Filter by severity. "warning" includes both warnings and errors. Default: "all".'
                    },
                    maxFiles: {
                        type: 'number',
                        description: 'Max files to return. -1 means unlimited. Default: 20.'
                    },
                    maxDiagnostics: {
                        type: 'number',
                        description: 'Max diagnostics to return (across all files). -1 means unlimited. Default: 200.'
                    },
                    maxPerFile: {
                        type: 'number',
                        description: 'Max diagnostics per file. -1 means unlimited. Default: 50.'
                    },
                    includeLineText: {
                        type: 'boolean',
                        description: 'Include the diagnostic line text. Default: true.'
                    }
                },
                required: []
            }
        },
        handler: async (args, context): Promise<ToolResult> => {
            const abortSignal = (context as any)?.abortSignal as AbortSignal | undefined;

            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                return { success: false, error: 'No workspace folder open' };
            }

            const severityFilter: SeverityFilter =
                args.severity === 'error' || args.severity === 'warning' || args.severity === 'all'
                    ? (args.severity as SeverityFilter)
                    : 'all';

            const maxFiles = typeof args.maxFiles === 'number' ? args.maxFiles : 20;
            const maxDiagnostics = typeof args.maxDiagnostics === 'number' ? args.maxDiagnostics : 200;
            const maxPerFile = typeof args.maxPerFile === 'number' ? args.maxPerFile : 50;
            const includeLineText = args.includeLineText !== false;

            const inputPaths = Array.isArray(args.paths) ? (args.paths as unknown[]).map(p => String(p || '').trim()).filter(Boolean) : [];

            const targets: TargetFilter[] = [];
            const invalidPaths: InvalidPathInfo[] = [];

            for (const p of inputPaths) {
                const resolved = resolveUriWithInfo(p);
                if (!resolved.uri) {
                    invalidPaths.push({ path: p, error: resolved.error || 'Could not resolve file path' });
                    continue;
                }

                let kind: 'file' | 'dir' = 'file';
                try {
                    const stat = await vscode.workspace.fs.stat(resolved.uri);
                    if (stat.type === vscode.FileType.Directory) {
                        kind = 'dir';
                    }
                } catch {
                    // If the path does not exist, treat it as a file filter.
                    kind = 'file';
                }

                const rel = normalizeRelPath(toRelativePath(resolved.uri, isMultiRoot));
                targets.push({ kind, rel, original: p });
            }

            if (inputPaths.length > 0 && targets.length === 0) {
                return {
                    success: false,
                    error: invalidPaths.length > 0 ? invalidPaths.map(i => `${i.path}: ${i.error}`).join('; ') : 'No valid paths provided'
                };
            }

            const allDiagnostics = vscode.languages.getDiagnostics();
            const fileMap = new Map<string, { uri: vscode.Uri; raw: RawDiagnostic[] }>();

            let matchedTotalCount = 0;
            let matchedErrorCount = 0;
            let matchedWarningCount = 0;

            for (const [uri, diagnostics] of allDiagnostics) {
                if (abortSignal?.aborted) {
                    return { success: false, cancelled: true, error: 'User cancelled diagnostics collection.' };
                }

                if (!diagnostics || diagnostics.length === 0) continue;

                const inWorkspace = Boolean(vscode.workspace.getWorkspaceFolder(uri));
                if (targets.length === 0 && !inWorkspace) {
                    continue;
                }

                const relPath = normalizeRelPath(toRelativePath(uri, isMultiRoot));
                if (!matchesTargets(relPath, targets)) {
                    continue;
                }

                const raw: RawDiagnostic[] = [];
                for (const diag of diagnostics) {
                    const sev = getSeverityString(diag.severity);
                    if (!shouldIncludeSeverity(sev, severityFilter)) continue;

                    raw.push({
                        uri,
                        range: diag.range,
                        severity: sev,
                        message: diag.message,
                        source: diag.source,
                        code: typeof diag.code === 'object' ? (diag.code as any).value : (diag.code as any)
                    });

                    matchedTotalCount++;
                    if (sev === 'error') matchedErrorCount++;
                    if (sev === 'warning') matchedWarningCount++;
                }

                if (raw.length === 0) continue;

                fileMap.set(relPath, { uri, raw });
            }

            const severityOrder: Record<SeverityString, number> = {
                error: 0,
                warning: 1,
                info: 2,
                hint: 3
            };

            const fileEntries = Array.from(fileMap.entries()).map(([path, v]) => {
                let errors = 0;
                let warnings = 0;
                for (const d of v.raw) {
                    if (d.severity === 'error') errors++;
                    else if (d.severity === 'warning') warnings++;
                }
                return { path, uri: v.uri, raw: v.raw, matchedErrorCount: errors, matchedWarningCount: warnings };
            });

            fileEntries.sort((a, b) => {
                if (a.matchedErrorCount !== b.matchedErrorCount) return b.matchedErrorCount - a.matchedErrorCount;
                if (a.matchedWarningCount !== b.matchedWarningCount) return b.matchedWarningCount - a.matchedWarningCount;
                return a.path.localeCompare(b.path);
            });

            const fileTruncated = maxFiles !== -1 && fileEntries.length > maxFiles;
            const selectedFiles = maxFiles === -1 ? fileEntries : fileEntries.slice(0, Math.max(0, maxFiles));

            // Prepare documents lazily for line text extraction
            const docCache = new Map<string, vscode.TextDocument>();
            const getDoc = async (uri: vscode.Uri): Promise<vscode.TextDocument | undefined> => {
                const key = uri.toString();
                const cached = docCache.get(key);
                if (cached) return cached;
                try {
                    const doc = await vscode.workspace.openTextDocument(uri);
                    docCache.set(key, doc);
                    return doc;
                } catch {
                    return undefined;
                }
            };

            const files: FileDiagnostics[] = [];
            let totalCount = 0;
            let errorCount = 0;
            let warningCount = 0;
            let diagnosticTruncated = false;

            for (const entry of selectedFiles) {
                if (abortSignal?.aborted) {
                    return { success: false, cancelled: true, error: 'User cancelled diagnostics collection.' };
                }

                // Sort diagnostics in a stable, useful order: severity -> line -> column
                const sorted = [...entry.raw].sort((a, b) => {
                    const s = severityOrder[a.severity] - severityOrder[b.severity];
                    if (s !== 0) return s;
                    if (a.range.start.line !== b.range.start.line) return a.range.start.line - b.range.start.line;
                    return a.range.start.character - b.range.start.character;
                });

                const totalDiagnostics = sorted.length;

                const cappedByFile = maxPerFile === -1 ? sorted : sorted.slice(0, Math.max(0, maxPerFile));
                let capped = cappedByFile;

                if (maxDiagnostics !== -1) {
                    const remaining = Math.max(0, maxDiagnostics - totalCount);
                    if (remaining <= 0) {
                        diagnosticTruncated = true;
                        break;
                    }
                    if (capped.length > remaining) {
                        capped = capped.slice(0, remaining);
                        diagnosticTruncated = true;
                    }
                }

                const doc = includeLineText ? await getDoc(entry.uri) : undefined;

                const diagnostics: DiagnosticInfo[] = [];
                for (const d of capped) {
                    const start = d.range.start;
                    const end = d.range.end;
                    const info: DiagnosticInfo = {
                        path: entry.path,
                        line: start.line + 1,
                        column: start.character + 1,
                        endLine: end.line + 1,
                        endColumn: end.character + 1,
                        severity: d.severity,
                        message: d.message,
                        source: d.source,
                        code: d.code
                    };

                    if (doc) {
                        try {
                            info.lineText = doc.lineAt(start.line).text.trim();
                        } catch {
                            // ignore
                        }
                    }

                    diagnostics.push(info);
                    totalCount++;
                    if (d.severity === 'error') errorCount++;
                    if (d.severity === 'warning') warningCount++;
                }

                const truncated = diagnostics.length < totalDiagnostics;
                files.push({
                    path: entry.path,
                    totalDiagnostics,
                    errorCount: entry.matchedErrorCount,
                    warningCount: entry.matchedWarningCount,
                    truncated,
                    diagnostics
                });
            }

            const result: GetErrorsResult = {
                totalCount,
                errorCount,
                warningCount,
                matchedTotalCount,
                matchedErrorCount,
                matchedWarningCount,
                fileCount: files.length,
                files
            };

            if (invalidPaths.length > 0) {
                result.invalidPaths = invalidPaths;
            }

            if (fileTruncated || diagnosticTruncated || maxPerFile !== -1) {
                result.truncated = {
                    maxFiles,
                    maxDiagnostics,
                    maxPerFile
                };
            }

            if (files.length === 0) {
                result.message = 'No diagnostics found for the given filter.';
            } else if (fileTruncated || diagnosticTruncated) {
                result.message = 'Diagnostics truncated by limits. Adjust maxFiles/maxDiagnostics/maxPerFile to see more.';
            }

            return { success: true, data: result };
        }
    };
}

export function registerGetErrors(): Tool {
    return createGetErrorsTool();
}
