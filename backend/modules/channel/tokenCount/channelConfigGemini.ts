import { createProxyFetch } from '../proxyFetch';
import { cleanContentForAPI } from '../../conversation/helpers';
import type { Content } from '../../conversation/types';
import type { ChannelConfig, TokenCountApiConfig } from '../../config/types';
import type { TokenCountResult } from './types';

export async function countGeminiTokensWithConfig(params: {
    proxyUrl?: string;
    channelConfig: ChannelConfig;
    apiConfig?: TokenCountApiConfig;
    contents: Content[];
}): Promise<TokenCountResult> {
    const { proxyUrl, channelConfig, apiConfig, contents } = params;

    const url = apiConfig?.url || channelConfig.url;
    const apiKey = apiConfig?.apiKey || channelConfig.apiKey;
    const model = apiConfig?.model || channelConfig.model;

    if (!url || !apiKey || !model) {
        return {
            success: false,
            error: 'Gemini token count: URL, API key or model not configured'
        };
    }

    let countUrl: string;
    if (url.includes('{model}') && url.includes('{key}')) {
        countUrl = url
            .replace('{model}', model)
            .replace('{key}', apiKey);
    } else if (url.includes(':generateContent')) {
        countUrl = url.replace(':generateContent', ':countTokens');
        if (!countUrl.includes('key=')) {
            countUrl += (countUrl.includes('?') ? '&' : '?') + `key=${apiKey}`;
        }
    } else if (url.includes(':streamGenerateContent')) {
        countUrl = url.replace(':streamGenerateContent', ':countTokens');
        if (!countUrl.includes('key=')) {
            countUrl += (countUrl.includes('?') ? '&' : '?') + `key=${apiKey}`;
        }
    } else {
        const baseUrl = url.replace(/\/$/, '');
        countUrl = `${baseUrl}/models/${model}:countTokens?key=${apiKey}`;
    }

    const geminiContents = contents.map(content => {
        const cleaned = cleanContentForAPI(content);
        return {
            role: cleaned.role,
            parts: cleaned.parts.map(part => {
                if ('text' in part && part.text !== undefined) {
                    return { text: part.text };
                }
                return part;
            })
        };
    });

    const requestBody = {
        contents: geminiContents
    };

    const proxyFetch = createProxyFetch(proxyUrl);
    const response = await proxyFetch(countUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
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
            error: `Gemini API error: ${errorBody}`
        };
    }

    const result = await response.json() as { totalTokens: number };

    return {
        success: true,
        totalTokens: result.totalTokens
    };
}

