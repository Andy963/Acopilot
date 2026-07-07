import * as vscode from 'vscode';

export const MAX_REFERENCE_PAYLOAD_CHARS = 12000;

export type ChatReferencePayload = {
    source: 'selection' | 'file';
    uri: string;
    path: string;
    startLine: number;
    endLine: number;
    languageId: string;
    text: string;
    originalCharCount: number;
    truncated: boolean;
};

type BaseReferencePayload = Omit<ChatReferencePayload, 'source'>;

export function buildSelectionReferencePayload(
    editor: vscode.TextEditor,
    maxChars: number = MAX_REFERENCE_PAYLOAD_CHARS
): ChatReferencePayload | null {
    const nonEmptySelections = editor.selections.filter((selection) => !selection.isEmpty);
    if (nonEmptySelections.length === 0) {
        return null;
    }

    const selection = nonEmptySelections[0];
    const basePayload = buildBaseReferencePayload(
        editor.document,
        editor.document.getText(selection),
        selection.start,
        selection.end,
        maxChars
    );

    if (!basePayload) {
        return null;
    }

    let endLine = selection.end.line + 1;
    if (selection.end.character === 0 && selection.end.line > selection.start.line) {
        endLine = selection.end.line;
    }

    return {
        ...basePayload,
        source: 'selection',
        startLine: selection.start.line + 1,
        endLine
    };
}

export function buildFileReferencePayload(
    document: vscode.TextDocument,
    maxChars: number = MAX_REFERENCE_PAYLOAD_CHARS
): ChatReferencePayload | null {
    const basePayload = buildBaseReferencePayload(
        document,
        document.getText(),
        new vscode.Position(0, 0),
        new vscode.Position(Math.max(document.lineCount - 1, 0), 0),
        maxChars,
        Math.max(1, document.lineCount)
    );

    return basePayload
        ? {
            ...basePayload,
            source: 'file'
        }
        : null;
}

function buildBaseReferencePayload(
    document: vscode.TextDocument,
    originalText: string,
    start: vscode.Position,
    _end: vscode.Position,
    maxChars: number,
    explicitEndLine?: number
): BaseReferencePayload | null {
    const normalizedText = originalText.replace(/\r\n/g, '\n');
    const originalCharCount = normalizedText.length;
    const truncated = originalCharCount > maxChars;
    const text = truncated
        ? `${normalizedText.slice(0, maxChars)}\n…(truncated, original ${originalCharCount} chars)`
        : normalizedText;

    return {
        uri: document.uri.toString(),
        path: vscode.workspace.asRelativePath(document.uri, false),
        startLine: start.line + 1,
        endLine: explicitEndLine ?? start.line + 1,
        languageId: document.languageId,
        text,
        originalCharCount,
        truncated
    };
}
