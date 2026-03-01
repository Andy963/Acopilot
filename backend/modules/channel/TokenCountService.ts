/**
 * Acopilot - Token 计数服务
 *
 * 提供通过 API 精确计算 token 数量的功能
 * 支持 Gemini、OpenAI、Anthropic 三种渠道
 */

import { createProxyFetch } from './proxyFetch';
import type { TokenCountChannelConfig, TokenCountConfig } from '../settings/types';
import type { Content } from '../conversation/types';
import type { ChannelConfig, TokenCountMethod, TokenCountApiConfig } from '../config/types';
import { cleanContentForAPI } from '../conversation/helpers';
import type { TokenCountResult as TokenCountResultType } from './tokenCount/types';
import { countOpenAIResponsesTokens, countOpenAITokens } from './tokenCount/openai';
import { countAnthropicTokensWithConfig } from './tokenCount/channelConfigAnthropic';
import { countGeminiTokensWithConfig } from './tokenCount/channelConfigGemini';
import { countOpenAICompatibleTokensWithConfig } from './tokenCount/channelConfigOpenAICompatible';
import { countOpenAIResponsesTokensWithConfig } from './tokenCount/channelConfigOpenAIResponses';
import {
    decodeBase64ToUtf8,
    formatTextAttachment,
    isTextMimeType
} from './formatters/inlineDataUtils';

export type TokenCountResult = TokenCountResultType;

/**
 * Token 计数服务
 * 
 * 根据渠道类型调用对应的 token 计数 API
 */
export class TokenCountService {
    private proxyUrl?: string;
    
    constructor(proxyUrl?: string) {
        this.proxyUrl = proxyUrl;
    }
    
    /**
     * 更新代理设置
     */
    setProxyUrl(proxyUrl?: string) {
        this.proxyUrl = proxyUrl;
    }
    
    /**
     * 计算内容的 token 数（使用全局配置）
     *
     * @param channelType 渠道类型 (gemini, openai, anthropic)
     * @param config Token 计数配置
     * @param contents 要计算的内容
     * @returns Token 计数结果
     */
    async countTokens(
        channelType: 'gemini' | 'openai' | 'anthropic' | 'openai-responses',
        config: TokenCountConfig,
        contents: Content[]
    ): Promise<TokenCountResult> {
        const channelConfig = config[channelType];
        
        if (!channelConfig?.enabled) {
            return {
                success: false,
                error: `Token count not enabled for ${channelType}`
            };
        }
        
        if (!channelConfig.apiKey) {
            return {
                success: false,
                error: `API key not configured for ${channelType} token count`
            };
        }
        
        try {
            switch (channelType) {
                case 'gemini':
                    return await this.countGeminiTokens(channelConfig, contents);
                case 'openai':
                    return await this.countOpenAITokens(channelConfig, contents);
                case 'openai-responses':
                    return await this.countOpenAIResponsesTokens(channelConfig, contents);
                case 'anthropic':
                    return await this.countAnthropicTokens(channelConfig, contents);
                default:
                    return {
                        success: false,
                        error: `Unknown channel type: ${channelType}`
                    };
            }
        } catch (error: any) {
            return {
                success: false,
                error: error?.message || 'Unknown error'
            };
        }
    }
    
    /**
     * 根据渠道配置计算内容的 token 数
     *
     * 根据渠道的 tokenCountMethod 字段选择对应的计数方式：
     * - 'channel_default': 根据渠道类型自动选择默认方式
     * - 'gemini': 使用 Gemini countTokens API
     * - 'openai_custom': 使用自定义 OpenAI 格式 API
     * - 'anthropic': 使用 Anthropic count_tokens API
     * - 'local': 使用本地估算
     *
     * @param channelConfig 渠道配置
     * @param contents 要计算的内容
     * @returns Token 计数结果
     */
    async countTokensWithChannelConfig(
        channelConfig: ChannelConfig,
        contents: Content[]
    ): Promise<TokenCountResult> {
        const method = channelConfig.tokenCountMethod || 'channel_default';
        const apiConfig = channelConfig.tokenCountApiConfig;
        
        // 确定实际使用的计数方式
        let actualMethod: TokenCountMethod = method;
        if (method === 'channel_default') {
            // 根据渠道类型选择默认方式
            switch (channelConfig.type) {
                case 'gemini':
                    actualMethod = 'gemini';
                    break;
                case 'anthropic':
                    actualMethod = 'anthropic';
                    break;
                case 'openai-responses':
                    actualMethod = 'openai_responses';
                    break;
                case 'openai':
                default:
                    actualMethod = 'local';
                    break;
            }
        }
        
        try {
            switch (actualMethod) {
                case 'gemini':
                    return await countGeminiTokensWithConfig({
                        proxyUrl: this.proxyUrl,
                        channelConfig,
                        apiConfig,
                        contents
                    });
                case 'openai_custom':
                    return await countOpenAICompatibleTokensWithConfig({
                        proxyUrl: this.proxyUrl,
                        channelConfig,
                        apiConfig,
                        contents
                    });
                case 'openai_responses':
                    return await countOpenAIResponsesTokensWithConfig({
                        proxyUrl: this.proxyUrl,
                        channelConfig,
                        apiConfig,
                        contents
                    });
                case 'anthropic':
                    return await countAnthropicTokensWithConfig({
                        proxyUrl: this.proxyUrl,
                        channelConfig,
                        apiConfig,
                        contents
                    });
                case 'local':
                    return this.countLocalTokens(contents);
                default:
                    return {
                        success: false,
                        error: `Unknown token count method: ${actualMethod}`
                    };
            }
        } catch (error: any) {
            return {
                success: false,
                error: error?.message || 'Unknown error'
            };
        }
    }
    
    /**
     * 本地估算 token 数
     * 约 4 个字符 = 1 个 token
     */
    private countLocalTokens(contents: Content[]): TokenCountResult {
        let totalChars = 0;
        
        for (const content of contents) {
            const cleaned = cleanContentForAPI(content);
            for (const part of cleaned.parts) {
                if ('text' in part && part.text) {
                    totalChars += part.text.length;
                }
            }
        }
        
        return {
            success: true,
            totalTokens: Math.ceil(totalChars / 4)
        };
    }
    
    /**
     * Gemini Token 计数
     * 
     * API: POST https://generativelanguage.googleapis.com/v1beta/models/{model}:countTokens?key={key}
     * 
     * 请求体:
     * {
     *   "contents": [{ "parts": [{ "text": "..." }] }]
     * }
     * 
     * 响应:
     * {
     *   "totalTokens": number,
     *   "cachedContentTokenCount": number,
     *   "promptTokensDetails": [...],
     *   "cacheTokensDetails": [...]
     * }
     */
    private async countGeminiTokens(
        config: TokenCountChannelConfig,
        contents: Content[]
    ): Promise<TokenCountResult> {
        // 构建 URL
        let url = config.baseUrl
            .replace('{model}', config.model)
            .replace('{key}', config.apiKey);
        
        // 清理并转换内容格式为 Gemini 格式
        const geminiContents = contents.map(content => {
            const cleaned = cleanContentForAPI(content);
            return {
                role: cleaned.role,
                parts: cleaned.parts.map(part => {
                    if ('text' in part && part.text !== undefined) {
                        return { text: part.text };
                    }
                    if ('inlineData' in part && part.inlineData && isTextMimeType(part.inlineData.mimeType)) {
                        const decoded = decodeBase64ToUtf8(part.inlineData.data);
                        if (decoded !== null) {
                            return {
                                text: formatTextAttachment({
                                    mimeType: part.inlineData.mimeType,
                                    text: decoded,
                                    displayName: part.inlineData.displayName
                                })
                            };
                        }
                    }
                    // 处理其他类型的 part（如 inlineData, functionResponse 等）
                    return part;
                })
            };
        });
        
        const requestBody = {
            contents: geminiContents
        };
        
        const proxyFetch = createProxyFetch(this.proxyUrl);
        const response = await proxyFetch(url, {
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
    
    /**
     * OpenAI Token 计数
     *
     * 支持用户自定义的 OpenAI 兼容 Token 计数 API。
     *
     * API 规范：
     * - POST {baseUrl}
     * - Headers: Content-Type: application/json, Authorization: Bearer {apiKey}
     * - Body: { model: string, messages: [...] }
     * - Response: { total_tokens: number }
     */
    private async countOpenAITokens(
        config: TokenCountChannelConfig,
        contents: Content[]
    ): Promise<TokenCountResult> {
        return countOpenAITokens({ proxyUrl: this.proxyUrl, config, contents });
    }
    
    /**
     * OpenAI Responses Token 计数
     *
     * API: POST https://api.openai.com/v1/responses/input_tokens
     *
     * 请求体:
     * {
     *   "model": "gpt-5",
     *   "input": [...],
     *   "instructions": "..."
     * }
     *
     * 响应:
     * {
     *   "object": "response.input_tokens",
     *   "input_tokens": number
     * }
     */
    private async countOpenAIResponsesTokens(
        config: TokenCountChannelConfig,
        contents: Content[]
    ): Promise<TokenCountResult> {
        return countOpenAIResponsesTokens({ proxyUrl: this.proxyUrl, config, contents });
    }
    
    /**
     * Anthropic Token 计数
     * 
     * API: POST https://api.anthropic.com/v1/messages/count_tokens
     * 
     * 请求体:
     * {
     *   "model": "claude-sonnet-4-5",
     *   "messages": [...]
     * }
     * 
     * 响应:
     * {
     *   "input_tokens": number
     * }
     */
    private async countAnthropicTokens(
        config: TokenCountChannelConfig,
        contents: Content[]
    ): Promise<TokenCountResult> {
        // 清理并转换内容格式为 Anthropic messages 格式
        const messages = contents.map(content => {
            const cleaned = cleanContentForAPI(content);
            return {
                role: cleaned.role === 'model' ? 'assistant' : cleaned.role,
                content: cleaned.parts.map(part => {
                    if ('text' in part && part.text !== undefined) {
                        return { type: 'text' as const, text: part.text };
                    }
                    // 处理图片等其他类型
                    return { type: 'text' as const, text: '' };
                })
            };
        });
        
        const requestBody = {
            model: config.model,
            messages
        };
        
        const proxyFetch = createProxyFetch(this.proxyUrl);
        const response = await proxyFetch(config.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': config.apiKey,
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
}

/**
 * 创建 TokenCountService 实例
 */
export function createTokenCountService(proxyUrl?: string): TokenCountService {
    return new TokenCountService(proxyUrl);
}
