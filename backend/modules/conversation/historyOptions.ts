export interface MultimodalCapability {
    supportsImages: boolean;
    supportsDocuments: boolean;
    supportsHistoryMultimodal: boolean;
}

export interface GetHistoryOptions {
    includeThoughts?: boolean;
    sendHistoryThoughts?: boolean;
    sendHistoryThoughtSignatures?: boolean;
    sendCurrentThoughts?: boolean;
    sendCurrentThoughtSignatures?: boolean;
    channelType?: 'gemini' | 'openai' | 'anthropic' | 'openai-responses' | 'custom';
    multimodalCapability?: MultimodalCapability;
    historyThinkingRounds?: number;
    startIndex?: number;
}

