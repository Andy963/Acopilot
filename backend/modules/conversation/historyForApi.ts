import { t } from '../../i18n';

import type { ConversationHistory, Content, ContentPart } from './types';
import type { GetHistoryOptions } from './historyOptions';

import { cleanFunctionResponseForAPI } from './helpers';
import { isInternalMarkerMimeType } from './internalMarkers';

export function buildHistoryForApi(
    rawHistory: ConversationHistory,
    opts: GetHistoryOptions
): ConversationHistory {
    let history = rawHistory;

    const startIndex = opts.startIndex ?? 0;
    if (startIndex > 0 && startIndex < history.length) {
        history = history.slice(startIndex);
    }

    const sendHistoryThoughts = opts.sendHistoryThoughts ?? false;
    const sendHistoryThoughtSignatures = opts.sendHistoryThoughtSignatures ?? false;
    const sendCurrentThoughts = opts.sendCurrentThoughts ?? (opts.channelType === 'anthropic' || opts.channelType === 'openai-responses');
    const sendCurrentThoughtSignatures = opts.sendCurrentThoughtSignatures ?? (opts.channelType === 'gemini' || opts.channelType === 'openai-responses');
    const channelType = opts.channelType;
    const historyThinkingRounds = opts.historyThinkingRounds ?? -1;

    let lastNonFunctionResponseUserIndex = -1;
    for (let i = history.length - 1; i >= 0; i--) {
        const message = history[i];
        if (message.role === 'user' && !message.isFunctionResponse) {
            lastNonFunctionResponseUserIndex = i;
            break;
        }
    }

    const roundStartIndices: number[] = [];
    for (let i = 0; i < history.length; i++) {
        const message = history[i];
        if (message.role === 'user' && !message.isFunctionResponse) {
            roundStartIndices.push(i);
        }
    }

    let historyThoughtMinIndex = 0;
    let historyThoughtMaxIndex = lastNonFunctionResponseUserIndex;

    if (historyThinkingRounds === 0) {
        historyThoughtMinIndex = history.length;
        historyThoughtMaxIndex = -1;
    } else if (historyThinkingRounds > 0) {
        const totalRounds = roundStartIndices.length;

        if (totalRounds > 1) {
            const roundsToSkip = Math.max(0, totalRounds - 1 - historyThinkingRounds);

            if (roundsToSkip > 0 && roundsToSkip < totalRounds) {
                historyThoughtMinIndex = roundStartIndices[roundsToSkip];
            }
        }
    }

    const processThoughtSignatures = (
        part: ContentPart,
        isHistoryPart: boolean,
        messageIndex: number
    ): ContentPart => {
        const preserveGeminiFunctionCallSignature =
            channelType === 'gemini' && !!part.functionCall;

        if (isHistoryPart) {
            if (!sendHistoryThoughtSignatures && !preserveGeminiFunctionCallSignature) {
                const { thoughtSignatures, thoughtSignature, ...rest } = part as any;
                return rest;
            }
            const isInHistoryThoughtRange = messageIndex >= historyThoughtMinIndex && messageIndex < historyThoughtMaxIndex;
            if (!isInHistoryThoughtRange && !preserveGeminiFunctionCallSignature) {
                const { thoughtSignatures, thoughtSignature, ...rest } = part as any;
                return rest;
            }
        } else {
            if (!sendCurrentThoughtSignatures && !preserveGeminiFunctionCallSignature) {
                const { thoughtSignatures, thoughtSignature, ...rest } = part as any;
                return rest;
            }
        }

        if (!part.thoughtSignatures) {
            return part;
        }

        if (channelType && part.thoughtSignatures[channelType]) {
            return {
                ...part,
                thoughtSignatures: {
                    [channelType]: part.thoughtSignatures[channelType]
                }
            };
        }

        return part;
    };

    const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
    const DOCUMENT_MIME_TYPES = ['application/pdf', 'text/plain'];

    const cleanInlineData = (part: ContentPart, isFunctionResponse: boolean, isHistoryMessage: boolean): ContentPart | null => {
        if (!part.inlineData) {
            return part;
        }

        if (isInternalMarkerMimeType(part.inlineData.mimeType)) {
            return null;
        }

        const capability = opts.multimodalCapability;

        if (capability && isFunctionResponse) {
            const mimeType = part.inlineData.mimeType;

            const isImage = IMAGE_MIME_TYPES.includes(mimeType);
            const isDocument = DOCUMENT_MIME_TYPES.includes(mimeType);

            if (isImage && !capability.supportsImages) {
                return null;
            }

            if (isDocument && !capability.supportsDocuments) {
                return null;
            }

            if (isHistoryMessage && !capability.supportsHistoryMultimodal) {
                return null;
            }
        }

        if (channelType === 'gemini') {
            const { id, name, ...cleanedInlineData } = part.inlineData as any;
            return {
                ...part,
                inlineData: cleanedInlineData
            };
        }

        const { id, name, displayName, ...cleanedInlineData } = part.inlineData as any;
        return {
            ...part,
            inlineData: cleanedInlineData
        };
    };

    const rejectedToolCallIds = new Set<string>();
    for (const message of history) {
        for (const part of message.parts) {
            if (part.functionCall?.rejected && part.functionCall.id) {
                rejectedToolCallIds.add(part.functionCall.id);
            }
        }
    }

    const cleanFunctionCall = (part: ContentPart): ContentPart => {
        if (!part.functionCall) {
            return part;
        }

        const { rejected, id, ...restFunctionCall } = part.functionCall as any;
        const cleanedFunctionCall = channelType === 'gemini'
            ? restFunctionCall
            : { ...restFunctionCall, ...(id ? { id } : {}) };
        return {
            ...part,
            functionCall: cleanedFunctionCall
        };
    };

    const processFunctionResponse = (part: ContentPart): ContentPart => {
        if (!part.functionResponse) {
            return part;
        }

        if (part.functionResponse.id && rejectedToolCallIds.has(part.functionResponse.id)) {
            return {
                ...part,
                functionResponse: {
                    ...part.functionResponse,
                    response: {
                        success: false,
                        error: t('modules.api.chat.errors.userRejectedTool'),
                        rejected: true
                    }
                }
            };
        }

        const cleanedResponse = cleanFunctionResponseForAPI(
            part.functionResponse.response as Record<string, unknown>
        );

        const { id, parts, ...restFunctionResponse } = part.functionResponse as any;
        const finalFunctionResponse = channelType === 'gemini'
            ? restFunctionResponse
            : { ...restFunctionResponse, ...(id ? { id } : {}), ...(parts ? { parts } : {}) };

        return {
            ...part,
            functionResponse: {
                ...finalFunctionResponse,
                response: cleanedResponse
            }
        };
    };

    const processMessage = (message: Content, index: number): Content | null => {
        const isHistoryMessage = index < lastNonFunctionResponseUserIndex;
        const isFunctionResponse = !!message.isFunctionResponse;

        let parts = message.parts;

        if (channelType === 'gemini') {
            parts = parts.flatMap((part) => {
                if (!part.functionResponse?.parts || part.functionResponse.parts.length === 0) {
                    return [part];
                }

                const { parts: nestedParts, ...restFunctionResponse } = part.functionResponse as any;
                return [
                    { ...part, functionResponse: restFunctionResponse },
                    ...nestedParts
                ];
            });
        }

        if (isHistoryMessage) {
            if (!sendHistoryThoughts) {
                parts = parts.filter(part => !part.thought || part.thoughtSignatures);
            } else {
                const isInHistoryThoughtRange = index >= historyThoughtMinIndex && index < historyThoughtMaxIndex;
                if (!isInHistoryThoughtRange) {
                    parts = parts.filter(part => !part.thought);
                }
            }
        } else {
            if (!sendCurrentThoughts) {
                parts = parts.filter(part => !part.thought || part.thoughtSignatures);
            }
        }

        parts = parts
            .map(part => processThoughtSignatures(part, isHistoryMessage, index))
            .map(part => cleanInlineData(part, isFunctionResponse, isHistoryMessage))
            .map(part => part ? cleanFunctionCall(part) : part)
            .map(part => part ? processFunctionResponse(part) : part)
            .filter((part): part is ContentPart => part !== null && Object.keys(part).length > 0);

        if (parts.length === 0) {
            return null;
        }

        return {
            role: message.role,
            parts
        };
    };

    return history
        .map((message, index) => processMessage(message, index))
        .filter((message): message is Content => message !== null);
}

