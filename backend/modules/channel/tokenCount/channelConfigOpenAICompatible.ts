import { createProxyFetch } from '../proxyFetch';
import { cleanContentForAPI } from '../../conversation/helpers';
import type { Content } from '../../conversation/types';
import type { ChannelConfig, TokenCountApiConfig } from '../../config/types';
import type { TokenCountResult } from './types';

import {
    decodeBase64ToUtf8,
    formatTextAttachment,
    formatUnsupportedAttachment,
    isImageMimeType,
    isTextMimeType
} from '../formatters/inlineDataUtils';

export async function countOpenAICompatibleTokensWithConfig(params: {
    proxyUrl?: string;
    channelConfig: ChannelConfig;
    apiConfig?: TokenCountApiConfig;
    contents: Content[];
}): Promise<TokenCountResult> {
    const { proxyUrl, channelConfig, apiConfig, contents } = params;

    const url = apiConfig?.url;
    const apiKey = apiConfig?.apiKey || channelConfig.apiKey;
    const model = apiConfig?.model || channelConfig.model;

    if (!url) {
        return {
            success: false,
            error: 'OpenAI custom token count: URL not configured'
        };
    }

    if (!apiKey) {
        return {
            success: false,
            error: 'OpenAI custom token count: API key not configured'
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

    const requestBody: any = { messages };
    if (model) {
        requestBody.model = model;
    }

    const proxyFetch = createProxyFetch(proxyUrl);
    const response = await proxyFetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
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

