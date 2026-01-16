/**
 * Internal (non-API) marker payloads stored in conversation history.
 *
 * These markers must never be forwarded to any model provider request body.
 */

export const OPENAI_RESPONSES_STATEFUL_MARKER_MIME = 'application/x-limcode-openai-responses-stateful-marker';

export function isInternalMarkerMimeType(mimeType: unknown): boolean {
    return typeof mimeType === 'string' && mimeType === OPENAI_RESPONSES_STATEFUL_MARKER_MIME;
}

export type OpenAIResponsesStatefulMarkerPayload = {
    v: 1;
    configId: string;
    previousResponseId?: string;
    promptCacheKey?: string;
};

export function encodeOpenAIResponsesStatefulMarker(payload: OpenAIResponsesStatefulMarkerPayload): string {
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

export function decodeOpenAIResponsesStatefulMarker(data: unknown): OpenAIResponsesStatefulMarkerPayload | null {
    if (typeof data !== 'string' || !data.trim()) return null;
    try {
        const decoded = Buffer.from(data, 'base64').toString('utf8');
        const parsed = JSON.parse(decoded);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

        const v = (parsed as any).v;
        if (v !== 1) return null;

        const configId = (parsed as any).configId;
        if (typeof configId !== 'string' || !configId.trim()) return null;

        const previousResponseIdRaw = (parsed as any).previousResponseId;
        const promptCacheKeyRaw = (parsed as any).promptCacheKey;

        const previousResponseId =
            typeof previousResponseIdRaw === 'string' && previousResponseIdRaw.trim()
                ? previousResponseIdRaw.trim()
                : undefined;
        const promptCacheKey =
            typeof promptCacheKeyRaw === 'string' && promptCacheKeyRaw.trim()
                ? promptCacheKeyRaw.trim()
                : undefined;

        return {
            v: 1,
            configId: configId.trim(),
            previousResponseId,
            promptCacheKey
        };
    } catch {
        return null;
    }
}
