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

export async function countOpenAIResponsesTokensWithConfig(params: {
    proxyUrl?: string;
    channelConfig: ChannelConfig;
    apiConfig?: TokenCountApiConfig;
    contents: Content[];
}): Promise<TokenCountResult> {
    const { proxyUrl, channelConfig, apiConfig, contents } = params;

    const url = apiConfig?.url || (channelConfig.type === 'openai-responses' ? channelConfig.url : undefined);
    const apiKey = apiConfig?.apiKey || channelConfig.apiKey;
    const model = apiConfig?.model || channelConfig.model;

    if (!url) {
        return {
            success: false,
            error: 'OpenAI responses token count: URL not configured'
        };
    }

    if (!apiKey) {
        return {
            success: false,
            error: 'OpenAI responses token count: API key not configured'
        };
    }

    let countUrl = url;
    if (countUrl.endsWith('/responses')) {
        countUrl = countUrl + '/input_tokens';
    } else if (!countUrl.includes('/responses/input_tokens')) {
        const baseUrl = countUrl.replace(/\/$/, '');
        countUrl = `${baseUrl}/v1/responses/input_tokens`;
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

    const requestBody: any = {
        input: inputParts
    };
    if (instructions) {
        requestBody.instructions = instructions;
    }
    if (model) {
        requestBody.model = model;
    }

    const proxyFetch = createProxyFetch(proxyUrl);
    const response = await proxyFetch(countUrl, {
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
            error: `OpenAI Responses API error: ${errorBody}`
        };
    }

    const result = await response.json() as { input_tokens?: number };

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

