import type {
    ContextInjectedPinnedSelection,
    ContextInjectedPinnedSelections,
    SelectionReference
} from '../../../conversation/types';

type ConversationSelectionReference = {
    id?: unknown;
    uri?: unknown;
    path?: unknown;
    startLine?: unknown;
    endLine?: unknown;
    languageId?: unknown;
    text?: unknown;
    originalCharCount?: unknown;
    truncated?: unknown;
    createdAt?: unknown;
};

type NormalizedSelectionReference = {
    id?: string;
    path: string;
    startLine?: number;
    endLine?: number;
    languageId?: string;
    text: string;
    charCount: number;
    truncated?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeString(value: unknown): string {
    if (typeof value !== 'string') return '';
    return value;
}

function normalizeNumber(value: unknown): number | undefined {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return undefined;
    return n;
}

function normalizePositiveInt(value: unknown): number | undefined {
    const n = normalizeNumber(value);
    if (n === undefined || n <= 0) return undefined;
    return Math.floor(n);
}

function normalizeBoolean(value: unknown): boolean | undefined {
    if (value === true) return true;
    if (value === false) return false;
    return undefined;
}

function normalizeSelectionReferences(raw: unknown): NormalizedSelectionReference[] {
    if (!Array.isArray(raw)) return [];

    const items: NormalizedSelectionReference[] = [];
    for (const entry of raw) {
        if (!isRecord(entry)) continue;

        const e = entry as ConversationSelectionReference;
        const path = normalizeString(e.path).trim();
        const text = normalizeString(e.text);
        if (!path || !text.trim()) continue;

        const languageId = normalizeString(e.languageId).trim() || undefined;
        const startLine = normalizePositiveInt(e.startLine);
        const endLine = normalizePositiveInt(e.endLine);
        const id = normalizeString(e.id).trim() || undefined;

        const truncated = normalizeBoolean(e.truncated);
        const charCount = text.length;

        items.push({
            id,
            path,
            startLine,
            endLine: endLine !== undefined && startLine !== undefined ? Math.max(endLine, startLine) : endLine,
            languageId,
            text,
            charCount,
            truncated
        });
    }

    return items;
}

export function getSelectionReferencesInjectedInfo(
    selectionReferences: SelectionReference[] | unknown
): ContextInjectedPinnedSelections | undefined {
    const selections = normalizeSelectionReferences(selectionReferences);
    if (selections.length === 0) return undefined;

    const items: ContextInjectedPinnedSelection[] = selections.map((s) => ({
        id: s.id,
        path: s.path,
        startLine: s.startLine,
        endLine: s.endLine,
        languageId: s.languageId,
        charCount: s.charCount,
        truncated: s.truncated
    }));

    return { count: items.length, items };
}

export function getSelectionReferencesBlock(
    selectionReferences: SelectionReference[] | unknown
): string {
    const selections = normalizeSelectionReferences(selectionReferences);
    if (selections.length === 0) return '';

    const blocks: string[] = [];
    for (let i = 0; i < selections.length; i++) {
        const s = selections[i];
        const range = (s.startLine && s.endLine)
            ? `#L${s.startLine}-L${s.endLine}`
            : (s.startLine ? `#L${s.startLine}` : '');

        const lang = s.languageId || '';
        const header = `[${i + 1}] ${s.path}${range}${lang ? ` (${lang})` : ''}${s.truncated ? ' (truncated)' : ''}`;

        const fenceLang = lang ? lang.replace(/[^a-zA-Z0-9_+\\-]/g, '') : '';
        const fenced = fenceLang
            ? `\`\`\`${fenceLang}\n${s.text}\n\`\`\``
            : `\`\`\`\n${s.text}\n\`\`\``;

        blocks.push([header, fenced].join('\n'));
    }

    return `====\n\nSELECTION REFERENCES\n\n${blocks.join('\n\n')}`;
}

