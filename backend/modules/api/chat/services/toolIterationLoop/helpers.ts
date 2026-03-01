import type { ConversationManager } from '../../../../conversation/ConversationManager';
import type { Content, ContextInjectionOverrides, ContextSnapshotModule, SelectionReference } from '../../../../conversation/types';
import { ChannelError, ErrorType } from '../../../../channel/types';
import { nanoid } from 'nanoid';

import {
    decodeOpenAIResponsesStatefulMarker,
    encodeOpenAIResponsesStatefulMarker,
    OPENAI_RESPONSES_STATEFUL_MARKER_MIME,
    type OpenAIResponsesStatefulMarkerPayload
} from '../../../../conversation/internalMarkers';
import { getSelectionReferencesBlock } from '../selectionReferences';

export const OPENAI_RESPONSES_CONTINUATION_KEY = 'openaiResponsesContinuation';
export const OPENAI_RESPONSES_FEATURES_KEY = 'openaiResponsesFeatures';
export const OPENAI_RESPONSES_PROMPT_CACHE_STATE_KEY = 'openaiResponsesPromptCacheKey';
export const CONVERSATION_START_TIME_KEY = 'conversationStartTime';
export const AUTO_SUMMARIZE_STATE_KEY = 'acopilotAutoSummarizeState';

const GEMINI_TOOL_LOOP_MIN_INTERVAL_MS = 200;
const GEMINI_TOOL_LOOP_JITTER_MS = 200;

export type OpenAIResponsesContinuationState = {
    configId: string;
    previousResponseId: string;
    lastSyncedHistoryLength: number;
};

export type OpenAIResponsesFeatures = {
    configId: string;
    disablePreviousResponseId?: boolean;
    disablePromptCacheKey?: boolean;
};

export type OpenAIResponsesPromptCacheState = {
    configId: string;
    promptCacheKey: string;
};

export type AutoSummarizeState = {
    lastAt: number;
    lastHistoryLength: number;
};

export async function getOrInitConversationStartTime(
    conversationManager: ConversationManager,
    conversationId: string
): Promise<string> {
    const raw = await conversationManager.getCustomMetadata(conversationId, CONVERSATION_START_TIME_KEY);
    if (typeof raw === 'string' && raw.trim()) {
        return raw;
    }

    const startTime = new Date().toISOString();
    await conversationManager.setCustomMetadata(conversationId, CONVERSATION_START_TIME_KEY, startTime);
    return startTime;
}

export function createOpenAIResponsesPromptCacheKey(conversationId: string, configId: string): string {
    return `acopilot:${configId}:${conversationId}:${nanoid(10)}`;
}

export function getApiErrorText(error: ChannelError): string {
    const rawDetails = error.details as any;
    const details = (rawDetails &&
        typeof rawDetails === 'object' &&
        !Array.isArray(rawDetails) &&
        typeof rawDetails.status === 'number' &&
        Object.prototype.hasOwnProperty.call(rawDetails, 'body'))
        ? rawDetails.body
        : rawDetails;

    const msg =
        (details?.error && typeof details.error.message === 'string' ? details.error.message : undefined) ??
        (typeof details?.message === 'string' ? details.message : undefined) ??
        (typeof (details as any)?.detail === 'string' ? (details as any).detail : undefined);

    if (typeof msg === 'string' && msg.trim()) {
        return msg;
    }

    try {
        return JSON.stringify(details ?? {});
    } catch {
        return String(details ?? '');
    }
}

export function isOpenAIResponsesContinuationError(error: unknown): boolean {
    if (!(error instanceof ChannelError)) {
        return false;
    }
    if (error.type !== ErrorType.API_ERROR) {
        return false;
    }

    const detailsText = getApiErrorText(error);
    const haystack = detailsText.toLowerCase();
    return haystack.includes('previous_response_id') || haystack.includes('previous response id');
}

export function isOpenAIResponsesPromptCacheKeyError(error: unknown): boolean {
    if (!(error instanceof ChannelError)) {
        return false;
    }
    if (error.type !== ErrorType.API_ERROR) {
        return false;
    }

    const detailsText = getApiErrorText(error);
    const haystack = detailsText.toLowerCase();
    return haystack.includes('prompt_cache_key') || haystack.includes('prompt cache key');
}

export function getGeminiToolLoopDelayMs(iteration: number): number {
    if (iteration <= 1) return 0;
    return GEMINI_TOOL_LOOP_MIN_INTERVAL_MS + Math.floor(Math.random() * GEMINI_TOOL_LOOP_JITTER_MS);
}

type OpenAIResponsesStatefulMarkerLocation = {
    marker: OpenAIResponsesStatefulMarkerPayload;
    index: number;
};

export function findLastOpenAIResponsesStatefulMarker(fullHistory: Content[], configId: string): OpenAIResponsesStatefulMarkerLocation | null {
    for (let i = fullHistory.length - 1; i >= 0; i--) {
        const msg = fullHistory[i];
        if (!msg || msg.role !== 'model' || !Array.isArray(msg.parts)) continue;

        for (const part of msg.parts) {
            const inlineData = (part as any)?.inlineData;
            if (!inlineData || inlineData.mimeType !== OPENAI_RESPONSES_STATEFUL_MARKER_MIME) {
                continue;
            }

            const parsed = decodeOpenAIResponsesStatefulMarker(inlineData.data);
            if (parsed && parsed.configId === configId) {
                return { marker: parsed, index: i };
            }
        }
    }
    return null;
}

export function appendOpenAIResponsesStatefulMarker(
    content: Content,
    payload: Omit<OpenAIResponsesStatefulMarkerPayload, 'v'> & { v?: 1 }
): void {
    if (!content || !Array.isArray(content.parts)) return;

    const previousResponseId = typeof payload.previousResponseId === 'string' && payload.previousResponseId.trim()
        ? payload.previousResponseId.trim()
        : undefined;
    const promptCacheKey = typeof payload.promptCacheKey === 'string' && payload.promptCacheKey.trim()
        ? payload.promptCacheKey.trim()
        : undefined;

    if (!previousResponseId && !promptCacheKey) return;

    const hasMarker = content.parts.some((p) => (p as any)?.inlineData?.mimeType === OPENAI_RESPONSES_STATEFUL_MARKER_MIME);
    if (hasMarker) return;

    const configId = payload.configId;
    if (typeof configId !== 'string' || !configId.trim()) return;

    const encoded = encodeOpenAIResponsesStatefulMarker({
        v: 1,
        configId: configId.trim(),
        previousResponseId,
        promptCacheKey
    });

    content.parts.push({
        inlineData: {
            mimeType: OPENAI_RESPONSES_STATEFUL_MARKER_MIME,
            data: encoded
        }
    });
}

export function truncatePreview(text: string, maxChars: number): { preview: string; truncated: boolean; charCount: number } {
    const safeText = text || '';
    const charCount = safeText.length;
    if (charCount <= maxChars) {
        return { preview: safeText, truncated: false, charCount };
    }
    return { preview: safeText.slice(0, maxChars), truncated: true, charCount };
}

function parseSections(text: string): Array<{ title: string; content: string }> {
    const marker = '====\n\n';
    const sections: Array<{ title: string; content: string }> = [];
    let index = 0;

    while (index < text.length) {
        const markerPos = text.indexOf(marker, index);
        if (markerPos === -1) {
            const tail = text.slice(index).trim();
            if (tail) {
                sections.push({ title: 'TEXT', content: tail });
            }
            break;
        }

        if (markerPos > index) {
            const prefix = text.slice(index, markerPos).trim();
            if (prefix) {
                sections.push({ title: 'TEXT', content: prefix });
            }
        }

        const titleStart = markerPos + marker.length;
        const titleEnd = text.indexOf('\n\n', titleStart);
        if (titleEnd === -1) {
            const rest = text.slice(markerPos).trim();
            if (rest) {
                sections.push({ title: 'TEXT', content: rest });
            }
            break;
        }

        const title = text.slice(titleStart, titleEnd).trim() || 'SECTION';
        const contentStart = titleEnd + 2;
        const nextMarkerPos = text.indexOf(marker, contentStart);
        const rawContent = nextMarkerPos === -1
            ? text.slice(contentStart)
            : text.slice(contentStart, nextMarkerPos);

        sections.push({ title, content: rawContent.trim() });
        index = nextMarkerPos === -1 ? text.length : nextMarkerPos;
    }

    return sections;
}

export function buildSnapshotModules(systemInstruction: string, maxCharsPerSection: number): ContextSnapshotModule[] {
    const sections = parseSections(systemInstruction);
    return sections.map((s) => {
        const { preview, truncated, charCount } = truncatePreview(s.content, maxCharsPerSection);
        return {
            title: s.title,
            contentPreview: preview,
            charCount,
            truncated,
        };
    });
}

export function countMcpTools(tools: Array<{ name: string }>): number {
    return tools.filter((t) => typeof t.name === 'string' && t.name.startsWith('mcp__')).length;
}

export function getLastUserContextOverrides(history: Content[]): ContextInjectionOverrides | undefined {
    for (let i = history.length - 1; i >= 0; i--) {
        const msg = history[i];
        if (!msg || msg.role !== 'user') continue;
        if ((msg as any).isFunctionResponse === true) continue;
        if ((msg as any).isSummary === true) continue;
        return (msg as any).contextOverrides as ContextInjectionOverrides | undefined;
    }
    return undefined;
}

export function getLastUserSelectionReferences(history: Content[]): SelectionReference[] | undefined {
    for (let i = history.length - 1; i >= 0; i--) {
        const msg = history[i];
        if (!msg || msg.role !== 'user') continue;
        if ((msg as any).isFunctionResponse === true) continue;
        if ((msg as any).isSummary === true) continue;
        const refs = (msg as any).selectionReferences;
        return Array.isArray(refs) ? (refs as SelectionReference[]) : undefined;
    }
    return undefined;
}

export function getLastUserTaskContext(history: Content[]): string | undefined {
    for (let i = history.length - 1; i >= 0; i--) {
        const msg = history[i];
        if (!msg || msg.role !== 'user') continue;
        if ((msg as any).isFunctionResponse === true) continue;
        if ((msg as any).isSummary === true) continue;
        const ctx = (msg as any).taskContext;
        if (typeof ctx !== 'string') return undefined;
        const trimmed = ctx.trim();
        return trimmed ? trimmed : undefined;
    }
    return undefined;
}

export function getLastUserOpenFileContext(history: Content[]): string | undefined {
    for (let i = history.length - 1; i >= 0; i--) {
        const msg = history[i];
        if (!msg || msg.role !== 'user') continue;
        if ((msg as any).isFunctionResponse === true) continue;
        if ((msg as any).isSummary === true) continue;
        const ctx = (msg as any).openFileContext;
        if (typeof ctx !== 'string') return undefined;
        const trimmed = ctx.trim();
        return trimmed ? trimmed : undefined;
    }
    return undefined;
}

export function injectTaskContextIntoHistory(history: Content[], taskContext: string | undefined): Content[] {
    const raw = typeof taskContext === 'string' ? taskContext.trim() : '';
    if (!raw) return history;

    const injectedText = `====\n\nTASK\n\n${raw}`;
    for (let i = history.length - 1; i >= 0; i--) {
        const msg = history[i];
        if (!msg || msg.role !== 'user') continue;
        if ((msg as any).isFunctionResponse === true) continue;
        if ((msg as any).isSummary === true) continue;
        if (!Array.isArray(msg.parts)) continue;

        const parts = msg.parts.map((p) => ({ ...p }));
        const firstTextIndex = parts.findIndex((p) => typeof (p as any)?.text === 'string');

        if (firstTextIndex >= 0) {
            const originalText = (parts[firstTextIndex] as any).text ?? '';
            const nextText = originalText.trim()
                ? `${injectedText}\n\n${originalText}`
                : injectedText;
            parts[firstTextIndex] = { ...(parts[firstTextIndex] as any), text: nextText };
        } else {
            parts.unshift({ text: injectedText });
        }

        const updated: Content = { ...msg, parts };
        const nextHistory = history.slice();
        nextHistory[i] = updated;
        return nextHistory;
    }

    return history;
}

export function injectOpenFileContextIntoHistory(history: Content[], openFileContext: string | undefined): Content[] {
    const raw = typeof openFileContext === 'string' ? openFileContext.trim() : '';
    if (!raw) return history;

    const injectedText = raw.startsWith('====') ? raw : `====\n\nOPEN FILE CONTEXT\n\n${raw}`;
    for (let i = history.length - 1; i >= 0; i--) {
        const msg = history[i];
        if (!msg || msg.role !== 'user') continue;
        if ((msg as any).isFunctionResponse === true) continue;
        if ((msg as any).isSummary === true) continue;
        if (!Array.isArray(msg.parts)) continue;

        const parts = msg.parts.map((p) => ({ ...p }));
        const firstTextIndex = parts.findIndex((p) => typeof (p as any)?.text === 'string');

        if (firstTextIndex >= 0) {
            const originalText = (parts[firstTextIndex] as any).text ?? '';
            const nextText = originalText.trim()
                ? `${injectedText}\n\n${originalText}`
                : injectedText;
            parts[firstTextIndex] = { ...(parts[firstTextIndex] as any), text: nextText };
        } else {
            parts.unshift({ text: injectedText });
        }

        const updated: Content = { ...msg, parts };
        const nextHistory = history.slice();
        nextHistory[i] = updated;
        return nextHistory;
    }

    return history;
}

export function injectSelectionReferencesIntoHistory(history: Content[], selectionReferences: SelectionReference[] | undefined): Content[] {
    if (!Array.isArray(selectionReferences) || selectionReferences.length === 0) return history;

    const selectionReferencesBlock = getSelectionReferencesBlock(selectionReferences);
    if (!selectionReferencesBlock.trim()) return history;

    for (let i = history.length - 1; i >= 0; i--) {
        const msg = history[i];
        if (!msg || msg.role !== 'user') continue;
        if ((msg as any).isFunctionResponse === true) continue;
        if ((msg as any).isSummary === true) continue;
        if (!Array.isArray(msg.parts)) continue;

        const parts = msg.parts.map((p) => ({ ...p }));
        const firstTextIndex = parts.findIndex((p) => typeof (p as any)?.text === 'string');

        if (firstTextIndex >= 0) {
            const originalText = (parts[firstTextIndex] as any).text ?? '';
            const nextText = originalText.trim()
                ? `${selectionReferencesBlock}\n\n${originalText}`
                : selectionReferencesBlock;
            parts[firstTextIndex] = { ...(parts[firstTextIndex] as any), text: nextText };
        } else {
            parts.unshift({ text: selectionReferencesBlock });
        }

        const updated: Content = { ...msg, parts };
        const nextHistory = history.slice();
        nextHistory[i] = updated;
        return nextHistory;
    }

    return history;
}
