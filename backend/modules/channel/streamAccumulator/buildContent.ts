import type { Content, ContentPart, ThoughtSignatures, UsageMetadata } from '../../conversation/types';

export function buildStreamAccumulatorContent(params: {
    parts: ContentPart[];
    thoughtSignatures: ThoughtSignatures;
    modelVersion?: string;
    finishReason?: string;
    usageMetadata?: UsageMetadata;
    thinkingStartTime?: number;
    thinkingDuration?: number;
    hasReceivedNormalText: boolean;
    chunkCount: number;
    firstChunkTime?: number;
    lastChunkTime?: number;
    requestStartTime?: number;
}): Content {
    const {
        thoughtSignatures,
        modelVersion,
        finishReason,
        usageMetadata,
        thinkingStartTime,
        thinkingDuration,
        hasReceivedNormalText,
        chunkCount,
        firstChunkTime,
        lastChunkTime,
        requestStartTime
    } = params;

    let parts = params.parts
        .map(p => {
            const part = { ...p };
            if (part.functionCall) {
                const fc = { ...part.functionCall } as any;
                delete fc.index;
                delete fc.partialArgs;
                part.functionCall = fc;
            }
            return part;
        })
        .filter(p => {
            if (!('text' in p) || p.functionCall) return true;
            if ('text' in p && p.text === '' && !p.thought) return false;
            return true;
        });

    if (Object.keys(thoughtSignatures).length > 0) {
        const hasSignaturePart = parts.some(p => p.thoughtSignatures);
        if (!hasSignaturePart) {
            parts.push({ thoughtSignatures: { ...thoughtSignatures } });
        }
    }

    for (const p of parts) {
        if (p.functionCall?.partialArgs && (!p.functionCall.args || Object.keys(p.functionCall.args).length === 0)) {
            try {
                p.functionCall.args = JSON.parse(p.functionCall.partialArgs);
            } catch {
                // ignore
            }
        }
    }

    const content: Content = {
        role: 'model',
        parts
    };

    if (modelVersion) {
        content.modelVersion = modelVersion;
    }

    if (finishReason) {
        content.finishReason = finishReason;
    }

    if (usageMetadata) {
        content.usageMetadata = { ...usageMetadata };
    }

    if (thinkingStartTime !== undefined) {
        content.thinkingStartTime = thinkingStartTime;
    }

    if (thinkingStartTime !== undefined) {
        if (thinkingDuration !== undefined) {
            content.thinkingDuration = thinkingDuration;
        } else if (!hasReceivedNormalText) {
            content.thinkingDuration = Date.now() - thinkingStartTime;
        }
    }

    content.chunkCount = chunkCount;
    if (firstChunkTime !== undefined) {
        content.firstChunkTime = firstChunkTime;
    }

    if (requestStartTime !== undefined && lastChunkTime !== undefined) {
        content.responseDuration = lastChunkTime - requestStartTime;
    } else if (requestStartTime !== undefined) {
        content.responseDuration = Date.now() - requestStartTime;
    }

    if (firstChunkTime !== undefined && lastChunkTime !== undefined) {
        content.streamDuration = lastChunkTime - firstChunkTime;
    } else if (firstChunkTime !== undefined) {
        content.streamDuration = Date.now() - firstChunkTime;
    }

    return content;
}

