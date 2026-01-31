import { createProxyFetch } from '../proxyFetch';
import type { TokenCountChannelConfig } from '../../settings/types';
import type { Content } from '../../conversation/types';
import { cleanContentForAPI } from '../../conversation/helpers';
import {
    decodeBase64ToUtf8,
    formatTextAttachment,
    formatUnsupportedAttachment,
    isImageMimeType,
    isTextMimeType
} from '../formatters/inlineDataUtils';
import type { TokenCountResult } from './types';

export async function countOpenAITokens(input: {
    proxyUrl?: string;
    config: TokenCountChannelConfig;
    contents: Content[];
}): Promise<TokenCountResult> {
    const { config, contents } = input;

    if (!config.baseUrl) {
        return {
            success: false,
            error: 'OpenAI token count API URL not configured. Use estimation instead.'
        };
    }

    const messages = contents.map(content => {
        const cleaned = cleanContentForAPI(content);
        return {
            role: cleaned.role === 'model' ? 'assistant' : cleaned.role,
            content: cleaned.parts.map(part => {
                if ('text' in part && part.text) {
                    return { type: 'text' as const, text: part.text };
                }
                if ('inlineData' in part && part.inlineData) {
                    const mimeType = part.inlineData.mimeType;

                    if (isImageMimeType(mimeType)) {
                        return {
                            type: 'image_url' as const,
                            image_url: {
                                url: `data:${mimeType};base64,${part.inlineData.data}`
                            }
                        };
                    }

                    if (isTextMimeType(mimeType)) {
                        const decoded = decodeBase64ToUtf8(part.inlineData.data);
                        return {
                            type: 'text' as const,
                            text: decoded !== null
                                ? formatTextAttachment({
                                    mimeType,
                                    text: decoded,
                                    displayName: part.inlineData.displayName
                                })
                                : formatUnsupportedAttachment({
                                    mimeType,
                                    displayName: part.inlineData.displayName
                                })
                        };
                    }

                    return {
                        type: 'text' as const,
                        text: formatUnsupportedAttachment({
                            mimeType,
                            displayName: part.inlineData.displayName
                        })
                    };
                }
                return { type: 'text' as const, text: '' };
            })
        };
    });

    const requestBody = {
        model: config.model,
        messages
    };

    const proxyFetch = createProxyFetch(input.proxyUrl);
    const response = await proxyFetch(config.baseUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        let errorBody: string;
        try {
            errorBody = await response.text();
        } catch {
            errorBody = `HTTP ${response.status}`;
        }
        return {
            success: false,
            error: `OpenAI compatible API error: ${errorBody}`
        };
    }

    const result = await response.json() as { total_tokens?: number; totalTokens?: number };
    const totalTokens = result.total_tokens ?? result.totalTokens;

    if (totalTokens === undefined) {
        return {
            success: false,
            error: 'Response missing total_tokens field'
        };
    }

    return {
        success: true,
        totalTokens
    };
}

export async function countOpenAIResponsesTokens(input: {
    proxyUrl?: string;
    config: TokenCountChannelConfig;
    contents: Content[];
}): Promise<TokenCountResult> {
    const { config, contents } = input;

    if (!config.baseUrl) {
        return {
            success: false,
            error: 'OpenAI responses token count API URL not configured. Use estimation instead.'
        };
    }

    let url = config.baseUrl;
    if (url.endsWith('/responses')) {
        url = url + '/input_tokens';
    } else if (!url.includes('/responses/input_tokens')) {
        const baseUrl = url.replace(/\/$/, '');
        url = `${baseUrl}/v1/responses/input_tokens`;
    }

    let instructions = '';
    const inputParts: any[] = [];

    for (const content of contents) {
        const cleaned = cleanContentForAPI(content);
        if (cleaned.role === 'system') {
            for (const part of cleaned.parts) {
                if ('text' in part && part.text) {
                    instructions += (instructions ? '\n' : '') + part.text;
                }
            }
            continue;
        }

        for (const part of cleaned.parts) {
            if ('text' in part && part.text) {
                inputParts.push({ type: 'text', text: part.text });
            } else if ('inlineData' in part && part.inlineData) {
                const mimeType = part.inlineData.mimeType;

                if (isImageMimeType(mimeType)) {
                    inputParts.push({
                        type: 'image_url',
                        image_url: {
                            url: `data:${mimeType};base64,${part.inlineData.data}`
                        }
                    });
                } else if (isTextMimeType(mimeType)) {
                    const decoded = decodeBase64ToUtf8(part.inlineData.data);
                    inputParts.push({
                        type: 'text',
                        text: decoded !== null
                            ? formatTextAttachment({
                                mimeType,
                                text: decoded,
                                displayName: part.inlineData.displayName
                            })
                            : formatUnsupportedAttachment({
                                mimeType,
                                displayName: part.inlineData.displayName
                            })
                    });
                } else {
                    inputParts.push({
                        type: 'text',
                        text: formatUnsupportedAttachment({
                            mimeType,
                            displayName: part.inlineData.displayName
                        })
                    });
                }
            }
        }
    }

    const requestBody = {
        model: config.model,
        input: inputParts,
        instructions: instructions || undefined
    };

    const proxyFetch = createProxyFetch(input.proxyUrl);
    const response = await proxyFetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        let errorBody: string;
        try {
            errorBody = await response.text();
        } catch {
            errorBody = `HTTP ${response.status}`;
        }
        return {
            success: false,
            error: `OpenAI Responses API error: ${errorBody}`
        };
    }

    const result = await response.json() as { input_tokens: number };

    if (result.input_tokens === undefined) {
        return {
            success: false,
            error: 'Response missing input_tokens field'
        };
    }

    return {
        success: true,
        totalTokens: result.input_tokens
    };
}

