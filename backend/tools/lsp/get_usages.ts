/**
 * 统一 Usages 工具
 *
 * 一次调用获取某个符号的：
 * - definition（定义）
 * - references（引用）
 * - implementations（实现）
 */

import * as vscode from 'vscode';
import type { Tool, ToolResult } from '../types';
import { getAllWorkspaces, resolveUri, toRelativePath } from '../utils';

type UsageType = 'definition' | 'implementation' | 'reference';

interface UsageLocation {
    path: string;
    line: number;       // 1-based
    column: number;     // 1-based
    type: UsageType;
    content: string;    // 带行号的代码片段（可包含上下文）
}

interface GetUsagesResult {
    symbol?: string;
    position: {
        path: string;
        line: number;
        column: number;
    };
    available: {
        total: number;
        definitionCount: number;
        implementationCount: number;
        referenceCount: number;
    };
    returned: {
        total: number;
        definitionCount: number;
        implementationCount: number;
        referenceCount: number;
    };
    truncated: boolean;
    results: UsageLocation[];
    message?: string;
}

type ResolvedLocation = {
    uri: vscode.Uri;
    range: vscode.Range;
};

function toResolvedLocation(loc: vscode.Location | vscode.LocationLink): ResolvedLocation {
    if ('targetUri' in loc) {
        // LocationLink
        return {
            uri: loc.targetUri,
            range: loc.targetRange ?? loc.targetSelectionRange
        };
    }
    // Location
    return { uri: loc.uri, range: loc.range };
}

function locationKey(loc: ResolvedLocation): string {
    return `${loc.uri.toString()}:${loc.range.start.line}:${loc.range.start.character}`;
}

function normalizeLineEndings(text: string): string {
    return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function formatSnippet(doc: vscode.TextDocument, focusLine0: number, contextLines: number): string {
    const totalLines = doc.lineCount;
    const ctx = Math.max(0, Math.floor(contextLines));
    const startLine = Math.max(0, focusLine0 - ctx);
    const endLine = Math.min(totalLines - 1, focusLine0 + ctx);

    const lines: string[] = [];
    for (let i = startLine; i <= endLine; i++) {
        const marker = i === focusLine0 ? '>' : ' ';
        const lineNum = i + 1;
        const lineText = doc.lineAt(i).text;
        lines.push(`${marker}${lineNum.toString().padStart(4)} | ${lineText}`);
    }
    return normalizeLineEndings(lines.join('\n'));
}

export function createGetUsagesTool(): Tool {
    const workspaces = getAllWorkspaces();
    const isMultiRoot = workspaces.length > 1;

    let description = `Find all usages of a symbol including its definition, references, and implementations in ONE call.

This tool combines:
- Definition: Where the symbol is defined
- References: Places where the symbol is used
- Implementations: For interfaces/abstract classes, where they are implemented

Use this instead of separate goto_definition + find_references calls to reduce tool invocations.`;

    if (isMultiRoot) {
        description += `\n\nMulti-root workspace: Use "workspace_name/path" format. Available workspaces: ${workspaces.map(w => w.name).join(', ')}`;
    }

    const pathDescription = isMultiRoot
        ? `File path, use "workspace_name/path" format. Available workspaces: ${workspaces.map(w => w.name).join(', ')}`
        : 'File path (relative to workspace root)';

    return {
        declaration: {
            name: 'get_usages',
            description,
            category: 'lsp',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: pathDescription
                    },
                    line: {
                        type: 'number',
                        description: 'Line number (1-based) where the symbol is located'
                    },
                    column: {
                        type: 'number',
                        description: 'Column number (1-based). Default: 1'
                    },
                    symbol: {
                        type: 'string',
                        description: 'Symbol name (optional, for documentation purposes)'
                    },
                    context: {
                        type: 'number',
                        description: 'Number of context lines to include before and after each result. Default: 0.'
                    },
                    maxResults: {
                        type: 'number',
                        description: 'Maximum number of results to return. Default: 100.'
                    }
                },
                required: ['path', 'line']
            }
        },
        handler: async (args, context): Promise<ToolResult> => {
            const abortSignal = (context as any)?.abortSignal as AbortSignal | undefined;

            const filePath = String(args.path || '').trim();
            const line = args.line as number;
            const column = (args.column as number) || 1;
            const symbolName = typeof args.symbol === 'string' ? args.symbol : undefined;
            const contextLines = typeof args.context === 'number' ? args.context : 0;
            const maxResults = typeof args.maxResults === 'number' ? args.maxResults : 100;

            if (!filePath) {
                return { success: false, error: 'path is required' };
            }
            if (typeof line !== 'number' || !Number.isFinite(line) || line < 1) {
                return { success: false, error: 'line must be a positive number' };
            }

            const uri = resolveUri(filePath);
            if (!uri) {
                return {
                    success: false,
                    error: isMultiRoot
                        ? `Could not resolve file path. Multi-root workspace requires "workspace_name/path" format. Available workspaces: ${workspaces.map(w => w.name).join(', ')}`
                        : 'Could not resolve file path. Make sure a workspace is open.'
                };
            }

            const position = new vscode.Position(line - 1, Math.max(0, column - 1));

            try {
                // 并行获取定义、引用、实现：对外一次调用
                const [definitionsRaw, referencesRaw, implementationsRaw] = await Promise.all([
                    vscode.commands.executeCommand<(vscode.Location | vscode.LocationLink)[]>(
                        'vscode.executeDefinitionProvider',
                        uri,
                        position
                    ),
                    vscode.commands.executeCommand<vscode.Location[]>(
                        'vscode.executeReferenceProvider',
                        uri,
                        position
                    ),
                    vscode.commands.executeCommand<(vscode.Location | vscode.LocationLink)[]>(
                        'vscode.executeImplementationProvider',
                        uri,
                        position
                    )
                ]);

                if (abortSignal?.aborted) {
                    return { success: false, cancelled: true, error: 'User cancelled usages collection.' };
                }

                const definitions = (definitionsRaw || []).map(toResolvedLocation);
                const references = (referencesRaw || []).map(toResolvedLocation);
                const implementations = (implementationsRaw || []).map(toResolvedLocation);

                const defKeys = new Set(definitions.map(locationKey));
                const implKeys = new Set(implementations.map(locationKey));

                const usageMap = new Map<string, { loc: ResolvedLocation; type: UsageType }>();

                const addUsage = (loc: ResolvedLocation, type: UsageType) => {
                    const key = locationKey(loc);
                    const existing = usageMap.get(key);
                    if (!existing) {
                        usageMap.set(key, { loc, type });
                        return;
                    }
                    // Prefer definition > implementation > reference
                    const order: Record<UsageType, number> = { definition: 0, implementation: 1, reference: 2 };
                    if (order[type] < order[existing.type]) {
                        usageMap.set(key, { loc, type });
                    }
                };

                // Always include definitions & implementations
                for (const def of definitions) {
                    addUsage(def, 'definition');
                }
                for (const impl of implementations) {
                    addUsage(impl, 'implementation');
                }

                // References (may include definitions depending on language server)
                for (const ref of references) {
                    const key = locationKey(ref);
                    const type: UsageType = defKeys.has(key)
                        ? 'definition'
                        : implKeys.has(key)
                            ? 'implementation'
                            : 'reference';
                    addUsage(ref, type);
                }

                const allUsages = Array.from(usageMap.values());

                const availableCounts = {
                    total: allUsages.length,
                    definitionCount: allUsages.filter(u => u.type === 'definition').length,
                    implementationCount: allUsages.filter(u => u.type === 'implementation').length,
                    referenceCount: allUsages.filter(u => u.type === 'reference').length,
                };

                const toPath = (u: { loc: ResolvedLocation }) => toRelativePath(u.loc.uri, isMultiRoot);

                // Sort: definition -> implementation -> reference; then path; then line
                const typeOrder: Record<UsageType, number> = { definition: 0, implementation: 1, reference: 2 };
                allUsages.sort((a, b) => {
                    const t = typeOrder[a.type] - typeOrder[b.type];
                    if (t !== 0) return t;
                    const pa = toPath(a);
                    const pb = toPath(b);
                    if (pa !== pb) return pa.localeCompare(pb);
                    if (a.loc.range.start.line !== b.loc.range.start.line) return a.loc.range.start.line - b.loc.range.start.line;
                    return a.loc.range.start.character - b.loc.range.start.character;
                });

                // Truncate while keeping definitions & implementations as priority
                const defs = allUsages.filter(u => u.type === 'definition');
                const impls = allUsages.filter(u => u.type === 'implementation');
                const refs = allUsages.filter(u => u.type === 'reference');

                const hardLimit = maxResults === -1 ? Number.POSITIVE_INFINITY : Math.max(0, Math.floor(maxResults));
                const selected: Array<{ loc: ResolvedLocation; type: UsageType }> = [];

                for (const d of defs) {
                    if (selected.length >= hardLimit) break;
                    selected.push({ loc: d.loc, type: d.type });
                }
                for (const i of impls) {
                    if (selected.length >= hardLimit) break;
                    selected.push({ loc: i.loc, type: i.type });
                }
                for (const r of refs) {
                    if (selected.length >= hardLimit) break;
                    selected.push({ loc: r.loc, type: r.type });
                }

                const truncated = selected.length < allUsages.length;

                // Read snippets (lazy doc cache)
                const docCache = new Map<string, vscode.TextDocument>();
                const getDoc = async (u: vscode.Uri): Promise<vscode.TextDocument | undefined> => {
                    const key = u.toString();
                    const cached = docCache.get(key);
                    if (cached) return cached;
                    try {
                        const doc = await vscode.workspace.openTextDocument(u);
                        docCache.set(key, doc);
                        return doc;
                    } catch {
                        return undefined;
                    }
                };

                const results: UsageLocation[] = [];
                for (const item of selected) {
                    if (abortSignal?.aborted) {
                        return { success: false, cancelled: true, error: 'User cancelled usages collection.' };
                    }

                    const relPath = toRelativePath(item.loc.uri, isMultiRoot);
                    const focusLine0 = item.loc.range.start.line;
                    const focusCol0 = item.loc.range.start.character;

                    let content = '(Unable to read file content)';
                    const doc = await getDoc(item.loc.uri);
                    if (doc) {
                        try {
                            content = formatSnippet(doc, focusLine0, contextLines);
                        } catch {
                            content = '(Unable to read file content)';
                        }
                    }

                    results.push({
                        path: relPath,
                        line: focusLine0 + 1,
                        column: focusCol0 + 1,
                        type: item.type,
                        content
                    });
                }

                const returnedCounts = {
                    total: results.length,
                    definitionCount: results.filter(r => r.type === 'definition').length,
                    implementationCount: results.filter(r => r.type === 'implementation').length,
                    referenceCount: results.filter(r => r.type === 'reference').length,
                };

                const payload: GetUsagesResult = {
                    symbol: symbolName,
                    position: {
                        path: filePath,
                        line,
                        column
                    },
                    available: availableCounts,
                    returned: returnedCounts,
                    truncated,
                    results,
                };

                if (availableCounts.total === 0) {
                    payload.message = 'No definition/references/implementations found. The symbol may not be supported by a language server.';
                } else if (truncated) {
                    payload.message = 'Results truncated. Increase maxResults to see more references.';
                }

                return { success: true, data: payload };
            } catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                };
            }
        }
    };
}

export function registerGetUsages(): Tool {
    return createGetUsagesTool();
}

