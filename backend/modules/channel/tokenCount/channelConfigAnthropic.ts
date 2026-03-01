import { createProxyFetch } from '../proxyFetch';
import { cleanContentForAPI } from '../../conversation/helpers';
import type { Content } from '../../conversation/types';
import type { ChannelConfig, TokenCountApiConfig } from '../../config/types';
import type { TokenCountResult } from './types';

export async function countAnthropicTokensWithConfig(params: {
    proxyUrl?: string;
    channelConfig: ChannelConfig;
    apiConfig?: TokenCountApiConfig;
    contents: Content[];
}): Promise<TokenCountResult> {
    const { proxyUrl, channelConfig, apiConfig, contents } = params;

    const baseUrl = apiConfig?.url || channelConfig.url;
    const apiKey = apiConfig?.apiKey || channelConfig.apiKey;
    const model = apiConfig?.model || channelConfig.model;

    if (!apiKey || !model) {
        return {
            success: false,
            error: 'Anthropic token count: API key or model not configured'
        };
    }

    let countUrl: string;
    if (baseUrl) {
        if (baseUrl.includes('/messages/count_tokens')) {
            countUrl = baseUrl;
        } else if (baseUrl.includes('/messages')) {
            countUrl = baseUrl.replace('/messages', '/messages/count_tokens');
        } else {
            const cleanUrl = baseUrl.replace(/\/$/, '');
            countUrl = `${cleanUrl}/v1/messages/count_tokens`;
        }
    } else {
        countUrl = 'https://api.anthropic.com/v1/messages/count_tokens';
    }

    const messages = contents.map(content => {
        const cleaned = cleanContentForAPI(content);
        return {
            role: cleaned.role === 'model' ? 'assistant' : cleaned.role,
            content: cleaned.parts.map(part => {
                if ('text' in part && part.text !== undefined) {
                    return { type: 'text' as const, text: part.text };
                }
                return { type: 'text' as const, text: '' };
            })
        };
    });

    const requestBody = {
        model,
        messages
    };

    const proxyFetch = createProxyFetch(proxyUrl);
    const response = await proxyFetch(countUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
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
            error: `Anthropic API error: ${errorBody}`
        };
    }

    const result = await response.json() as { input_tokens: number };

    return {
        success: true,
        totalTokens: result.input_tokens
    };
}

