/**
 * open_file 工具
 *
 * 用于在 VSCode 中打开指定文件，并可选跳转到指定行列。
 */

import * as vscode from 'vscode';
import type { Tool } from '../types';
import { resolveUriWithInfo } from '../utils';

function clampInt(value: unknown, min: number, max: number): number | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
    const n = Math.trunc(value);
    if (n < min) return min;
    if (n > max) return max;
    return n;
}

export function createOpenFileTool(): Tool {
    return {
        declaration: {
            name: 'open_file',
            description:
                'Open a file in VSCode and reveal an optional range. ' +
                'Use this after you have identified where the issue is.',
            category: 'lsp',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'File path relative to workspace root (multi-root supports workspace prefix).'
                    },
                    start_line: { type: 'number', description: '1-based line number to reveal (optional).' },
                    start_column: { type: 'number', description: '1-based column number (optional).' },
                    end_line: { type: 'number', description: '1-based end line number (optional).' },
                    end_column: { type: 'number', description: '1-based end column number (optional).' },
                    preserveFocus: { type: 'boolean', description: 'Do not steal focus when opening (optional).' },
                    preview: { type: 'boolean', description: 'Open as preview tab (optional).' }
                },
                required: ['path']
            }
        },
        handler: async (args: any) => {
            const filePath = typeof args?.path === 'string' ? args.path.trim() : '';
            if (!filePath) {
                return { success: false, error: 'path is required' };
            }

            const { uri, error } = resolveUriWithInfo(filePath);
            if (!uri) {
                return {
                    success: false,
                    error: error || `File not found: ${filePath}`
                };
            }

            const doc = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(doc, {
                preview: args?.preview !== false,
                preserveFocus: args?.preserveFocus === true
            });

            const lineCount = Math.max(1, doc.lineCount);
            const startLine = clampInt(args?.start_line, 1, lineCount);
            const endLine = clampInt(args?.end_line, 1, lineCount);

            if (startLine !== undefined) {
                const startLineIdx = startLine - 1;
                const endLineIdx = (endLine ?? startLine) - 1;

                const startColMax = doc.lineAt(startLineIdx).text.length + 1;
                const endColMax = doc.lineAt(endLineIdx).text.length + 1;

                const startColumn = clampInt(args?.start_column, 1, startColMax) ?? 1;
                const endColumn = clampInt(args?.end_column, 1, endColMax) ?? startColumn;

                const startPos = new vscode.Position(startLineIdx, Math.max(0, startColumn - 1));
                const endPos = new vscode.Position(endLineIdx, Math.max(0, endColumn - 1));
                const range = new vscode.Range(startPos, endPos);

                editor.selection = new vscode.Selection(startPos, endPos);
                editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
            }

            return {
                success: true,
                data: {
                    path: filePath,
                    opened: true
                }
            };
        }
    };
}

export function registerOpenFile(): Tool {
    return createOpenFileTool();
}
