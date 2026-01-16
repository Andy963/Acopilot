/**
 * LimCode - Gemini 格式转换器
 *
 * 将统一格式转换为 Gemini API 格式
 */

import { t } from '../../../i18n';
import { BaseFormatter } from './base';
import type { Content, ContentPart } from '../../conversation/types';
import type { GeminiConfig } from '../../config/types';
import type { ToolDeclaration } from '../../../tools/types';
import { convertToolsToXML, convertFunctionCallToXML, convertFunctionResponseToXML } from '../../../tools/xmlFormatter';
import { convertToolsToJSON, convertFunctionCallToJSON, convertFunctionResponseToJSON } from '../../../tools/jsonFormatter';
import { applyCustomBody } from '../../config/configs/base';
import type {
    GenerateRequest,
    GenerateResponse,
    StreamChunk,
    HttpRequestOptions
} from '../types';
import { ChannelError, ErrorType } from '../types';
import {
    decodeBase64ToUtf8,
    formatTextAttachment,
    isTextMimeType
} from './inlineDataUtils';

/**
 * Gemini 格式转换器
 * 
 * 支持 Google Gemini API 的完整功能：
 * - 文本、图片、音频、视频、文档
 * - 函数调用和函数响应
 * - 思考签名和思考内容
 * - 流式和非流式输出
 */
export class GeminiFormatter extends BaseFormatter {
    private static readonly VALID_CONTENT_ROLES = new Set(['user', 'model']);

    private static normalizeBaseUrl(raw: string): URL {
        const value = (raw || '').trim();
        if (!value) {
            throw new Error('Gemini config url is required');
        }

        try {
            return new URL(value);
        } catch {
            // Try to recover from missing scheme
            if (!/^https?:\/\//i.test(value)) {
                return new URL(`https://${value}`);
            }
            throw new Error(`Invalid Gemini url: ${value}`);
        }
    }

    private static joinPath(basePath: string, nextPath: string): string {
        const a = basePath || '';
        const b = nextPath || '';
        const aTrim = a.endsWith('/') ? a.slice(0, -1) : a;
        const bTrim = b.startsWith('/') ? b : `/${b}`;
        return `${aTrim || ''}${bTrim}`;
    }

    private normalizeGeminiModelPath(modelId: string): string {
        const raw = (modelId || '').trim();
        if (!raw) {
            throw new Error('Gemini config model is required');
        }

        // Accept both "gemini-xxx" and "models/gemini-xxx" / "tunedModels/xxx"
        if (raw.startsWith('models/') || raw.startsWith('tunedModels/')) {
            return raw;
        }

        // If user pasted a full path, try to extract the model segment.
        const modelsIndex = raw.indexOf('models/');
        if (modelsIndex >= 0) {
            return raw.slice(modelsIndex);
        }
        const tunedIndex = raw.indexOf('tunedModels/');
        if (tunedIndex >= 0) {
            return raw.slice(tunedIndex);
        }

        return `models/${raw}`;
    }

    private buildGeminiGenerateContentUrl(rawBaseUrl: string, modelId: string, useStream: boolean): string {
        const u0 = GeminiFormatter.normalizeBaseUrl(rawBaseUrl);
        const u = new URL(u0.toString());

        const method = useStream ? 'streamGenerateContent' : 'generateContent';
        let basePath = (u.pathname || '').replace(/\/+$/, '') || '/';

        // If configured as a full endpoint, keep it (just switch method based on stream).
        if (/:generateContent$/i.test(basePath) || /:streamGenerateContent$/i.test(basePath)) {
            u.pathname = basePath.replace(/:(streamGenerateContent|generateContent)$/i, `:${method}`);
            if (useStream) {
                u.searchParams.set('alt', 'sse');
            } else {
                u.searchParams.delete('alt');
            }
            return u.toString();
        }

        // Allow base urls ending with "/models"
        if (/\/models$/i.test(basePath)) {
            basePath = basePath.replace(/\/models$/i, '') || '/';
        }

        // Ensure v1beta segment exists
        if (!/\/v1beta$/i.test(basePath) && !/\/v1beta\//i.test(`${basePath}/`)) {
            basePath = GeminiFormatter.joinPath(basePath, '/v1beta');
        }

        const modelPath = this.normalizeGeminiModelPath(modelId);
        u.pathname = GeminiFormatter.joinPath(basePath, `/${modelPath}:${method}`);

        if (useStream) {
            u.searchParams.set('alt', 'sse');
        } else {
            u.searchParams.delete('alt');
        }

        return u.toString();
    }

    private sanitizeContents(contents: unknown): Content[] {
        if (!Array.isArray(contents)) {
            return [];
        }

        const cleaned: Content[] = [];
        for (const item of contents) {
            if (!item || typeof item !== 'object') {
                continue;
            }

            const rawRole = (item as any).role;
            const role = typeof rawRole === 'string' ? rawRole.trim().toLowerCase() : '';
            if (!GeminiFormatter.VALID_CONTENT_ROLES.has(role)) {
                continue;
            }

            const rawParts = (item as any).parts;
            if (!Array.isArray(rawParts)) {
                continue;
            }

            const parts: ContentPart[] = [];
            for (const rawPart of rawParts) {
                if (!rawPart || typeof rawPart !== 'object') {
                    continue;
                }

                const part: ContentPart = {};

                const text = (rawPart as any).text;
                if (typeof text === 'string') {
                    part.text = text;
                }

                const inlineData = (rawPart as any).inlineData;
                if (inlineData && typeof inlineData === 'object') {
                    const mimeType = (inlineData as any).mimeType;
                    const data = (inlineData as any).data;
                    if (typeof mimeType === 'string' && typeof data === 'string') {
                        part.inlineData = { mimeType, data };
                        const displayName = (inlineData as any).displayName;
                        if (typeof displayName === 'string' && displayName.trim()) {
                            part.inlineData.displayName = displayName;
                        }
                    }
                }

                const fileData = (rawPart as any).fileData;
                if (fileData && typeof fileData === 'object') {
                    part.fileData = { ...(fileData as any) };
                }

                const functionCall = (rawPart as any).functionCall;
                if (functionCall && typeof functionCall === 'object') {
                    const name = (functionCall as any).name;
                    const args = (functionCall as any).args;
                    if (typeof name === 'string' && name.trim()) {
                        part.functionCall = {
                            name: name.trim(),
                            args: args ?? {}
                        };
                    }
                }

                const functionResponse = (rawPart as any).functionResponse;
                if (functionResponse && typeof functionResponse === 'object') {
                    const name = (functionResponse as any).name;
                    const responseValue = (functionResponse as any).response;
                    if (typeof name === 'string' && name.trim()) {
                        part.functionResponse = {
                            name: name.trim(),
                            response: responseValue && typeof responseValue === 'object'
                                ? responseValue
                                : { output: responseValue }
                        };
                    }
                }

                const thoughtSignature = (rawPart as any).thoughtSignature;
                if (typeof thoughtSignature === 'string' && thoughtSignature.trim()) {
                    (part as any).thoughtSignature = thoughtSignature;
                }

                const thought = (rawPart as any).thought;
                if (thought !== undefined) {
                    (part as any).thought = thought;
                }

                if (Object.keys(part).length > 0) {
                    parts.push(part);
                }
            }

            if (parts.length === 0) {
                continue;
            }

            cleaned.push({
                role: role as 'user' | 'model',
                parts
            });
        }

        return cleaned;
    }

    /**
     * 归一化历史消息角色
     *
     * 目的：兼容某些网关/旧数据中出现的 role 值（如 "assistant"），避免 Gemini 端忽略模型消息，
     * 从而导致“每次新问题都会把之前问题再回答一遍”的现象。
     *
     * Gemini contents 仅接受 'user' | 'model'（systemInstruction 单独字段）。
     */
    private normalizeHistoryRoles(history: Content[]): Content[] {
        // 1) 角色归一化：兼容不同提供商/网关的 role 命名，并过滤 Gemini 不支持的 role
        const normalized = history
            .map((content) => {
                const rawRole = (content as any).role;
                const roleKey = typeof rawRole === 'string'
                    ? rawRole.trim().toLowerCase()
                    : rawRole;

                // 兼容常见别名：assistant/model、human/user
                let role: 'user' | 'model' | null = null;
                if (roleKey === 'user' || roleKey === 'model') {
                    role = roleKey;
                } else if (roleKey === 'assistant' || roleKey === 'bot' || roleKey === 'ai') {
                    role = 'model';
                } else if (roleKey === 'human') {
                    role = 'user';
                }

                if (!role) {
                    return null;
                }

                return {
                    ...content,
                    role
                } as Content;
            })
            .filter((c): c is Content => c !== null);

        // 2) Gemini 推荐/部分网关要求：history 以 user 开始
        const firstUserIndex = normalized.findIndex(m => m.role === 'user');
        const normalizedFromUser = firstUserIndex >= 0
            ? normalized.slice(firstUserIndex)
            : normalized;

        // 3) 合并连续同角色消息：避免出现 user,user 或 model,model 导致 Gemini 端“错位/忽略”
        const coalesced: Content[] = [];
        for (const message of normalizedFromUser) {
            const last = coalesced[coalesced.length - 1];
            if (!last || last.role !== message.role) {
                coalesced.push(message);
                continue;
            }

            coalesced[coalesced.length - 1] = {
                ...last,
                parts: [...(last.parts || []), ...(message.parts || [])]
            };
        }

        return coalesced;
    }

    /**
     * 构建 Gemini API 请求
     */
    buildRequest(
        request: GenerateRequest,
        config: GeminiConfig,
        tools?: ToolDeclaration[]
    ): HttpRequestOptions {
        const { history } = request;
        const toolMode = config.toolMode || 'function_call';
        
        // 根据模式处理历史记录
        let processedHistory: Content[];
        if (toolMode === 'xml') {
            // XML 模式：将 functionCall 和 functionResponse 转换为 XML 文本
            processedHistory = this.convertHistoryToXMLMode(history);
        } else if (toolMode === 'json') {
            // JSON 模式：将 functionCall 和 functionResponse 转换为 JSON 代码块
            processedHistory = this.convertHistoryToJSONMode(history);
        } else {
            // Function Call 模式：直接使用原始历史
            processedHistory = history;
        }

        // 归一化 role，避免非法 role 进入 Gemini contents
        processedHistory = this.normalizeHistoryRoles(processedHistory);
        
        // 转换思考签名格式：将 thoughtSignatures.gemini 转换为 thoughtSignature
        processedHistory = this.convertThoughtSignatures(processedHistory);

        // 文本类附件（如 text/markdown）不应作为 inlineData 发送；将其解码为 text part
        processedHistory = this.convertTextInlineDataToTextParts(processedHistory);
        
        // 构建请求体（在应用 custom body 前先做一次基础清洗，避免非预期字段进入 Gemini）
        const sanitizedHistory = this.sanitizeContents(processedHistory);
        const body: any = {
            contents: sanitizedHistory,
            generationConfig: this.buildGenerationConfig(config)
        };
        
        // 处理工具
        let systemInstruction = config.systemInstruction || '';
        
        // 追加动态系统提示词（环境信息、文件树等）
        if (request.dynamicSystemPrompt) {
            systemInstruction = systemInstruction
                ? `${systemInstruction}\n\n${request.dynamicSystemPrompt}`
                : request.dynamicSystemPrompt;
        }
        
        // 处理工具描述 - 替换占位符或追加到系统提示词
        // 准备工具定义内容
        let toolsContent = '';
        let mcpToolsContent = '';
        
        if (tools && tools.length > 0) {
            if (toolMode === 'function_call') {
                // Function Call 模式：工具作为独立字段，不添加到系统提示词
                body.tools = this.convertTools(tools);
            } else if (toolMode === 'xml') {
                // XML 模式：工具转换为 XML
                toolsContent = convertToolsToXML(tools);
            } else if (toolMode === 'json') {
                // JSON 模式：工具转换为 JSON
                toolsContent = convertToolsToJSON(tools);
            }
        }
        
        // MCP 工具由外部传入，这里只处理占位符
        if (request.mcpToolsContent) {
            mcpToolsContent = request.mcpToolsContent;
        }
        
        // 替换占位符（如果存在）
        if (systemInstruction.includes('{{$TOOLS}}') || systemInstruction.includes('{{$MCP_TOOLS}}')) {
            // 替换 TOOLS 占位符
            systemInstruction = systemInstruction.replace(/\{\{\$TOOLS\}\}/g, toolsContent);
            // 替换 MCP_TOOLS 占位符
            systemInstruction = systemInstruction.replace(/\{\{\$MCP_TOOLS\}\}/g, mcpToolsContent);
        } else if (toolsContent) {
            // 如果没有占位符但有工具内容，追加到末尾
            systemInstruction = systemInstruction
                ? `${systemInstruction}\n\n${toolsContent}`
                : toolsContent;
        }
        
        // 添加系统指令
        if (systemInstruction) {
            body.systemInstruction = {
                role: 'user',
                parts: [{ text: systemInstruction }]
            };
        }
        
        // 决定是否使用流式（可由 request.streamOverride 强制覆写）
        const useStream = request.streamOverride ?? config.options?.stream ?? config.preferStream ?? false;
        
        const url = this.buildGeminiGenerateContentUrl(config.url, config.model, useStream);
        
        // 构建请求头
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };
        
        // 流式响应通常为 SSE，显式声明可提升部分代理/网关的兼容性
        if (useStream) {
            headers['Accept'] = 'text/event-stream';
        }
        
        // 只有当 apiKey 存在时才添加认证头
        if (config.apiKey) {
            if (config.useAuthorizationHeader) {
                // 使用 Authorization Bearer 格式
                headers['Authorization'] = `Bearer ${config.apiKey}`;
            } else {
                // 使用原生 x-goog-api-key 格式
                headers['x-goog-api-key'] = config.apiKey;
            }
        }
        
        // 应用自定义标头（如果启用）
        if (config.customHeadersEnabled && config.customHeaders) {
            for (const header of config.customHeaders) {
                // 只添加启用的、有键名的标头
                if (header.enabled && header.key && header.key.trim()) {
                    headers[header.key.trim()] = header.value || '';
                }
            }
        }
        
        // 应用自定义 body（如果启用）
        // 注意：自定义 body 可能会误覆盖必填字段（如 contents），这里做一次兜底校验。
        let finalBody: any = applyCustomBody(body, config.customBody, config.customBodyEnabled);
        if (!finalBody || typeof finalBody !== 'object' || Array.isArray(finalBody)) {
            finalBody = body;
        }

        // 1) contents 必须为非空数组且结构正确；否则回退到内建 body.contents
        let sanitizedContents = this.sanitizeContents(finalBody.contents);
        if (sanitizedContents.length === 0) {
            sanitizedContents = sanitizedHistory;
        }
        if (sanitizedContents.length === 0) {
            throw new Error('Gemini request requires a non-empty contents array');
        }
        finalBody.contents = sanitizedContents;

        // 2) systemInstruction 兼容性：必须是对象且包含 role + parts
        if (finalBody.systemInstruction !== undefined) {
            const si = finalBody.systemInstruction;
            const siOk = si && typeof si === 'object' && !Array.isArray(si) && Array.isArray((si as any).parts);
            if (!siOk) {
                if (body.systemInstruction) {
                    finalBody.systemInstruction = body.systemInstruction;
                } else {
                    delete finalBody.systemInstruction;
                }
            } else if (typeof (si as any).role !== 'string') {
                (si as any).role = 'user';
            }
        }

        // 3) tools 字段兼容：部分实现使用 function_declarations，官方为 functionDeclarations
        if (Array.isArray(finalBody.tools)) {
            finalBody.tools = finalBody.tools
                .filter((t: any) => t && typeof t === 'object' && !Array.isArray(t))
                .map((t: any) => {
                    if (t.functionDeclarations || !t.function_declarations) {
                        return t;
                    }
                    const { function_declarations, ...rest } = t;
                    return { ...rest, functionDeclarations: function_declarations };
                });
        }
        
        // 构建请求选项
        return {
            url,
            method: 'POST',
            headers,
            body: finalBody,
            timeout: config.timeout,  // 使用配置的超时时间
            stream: useStream
        };
    }

    private convertTextInlineDataToTextParts(history: Content[]): Content[] {
        return history.map(content => ({
            ...content,
            parts: content.parts.flatMap(part => {
                if (!part.inlineData) {
                    return [part];
                }

                const mimeType = part.inlineData.mimeType;
                if (!isTextMimeType(mimeType)) {
                    return [part];
                }

                const decoded = decodeBase64ToUtf8(part.inlineData.data);
                if (decoded === null) {
                    return [part];
                }

                return [{
                    text: formatTextAttachment({
                        mimeType,
                        text: decoded,
                        displayName: part.inlineData.displayName
                    })
                }];
            })
        }));
    }
    
    /**
     * 构建生成配置（根据 optionsEnabled 决定发送哪些参数）
     *
     * 只有在 optionsEnabled 中对应字段为 true 时，才会发送该参数
     */
    private buildGenerationConfig(config: GeminiConfig): any {
        const genConfig: any = {};
        
        // 从配置中读取所有参数
        const { options, optionsEnabled } = config;
        
        if (!options) {
            return genConfig;
        }
        
        // 如果没有 optionsEnabled，默认不发送任何参数
        if (!optionsEnabled) {
            return genConfig;
        }
        
        // 根据 optionsEnabled 决定发送哪些参数
        if (optionsEnabled.temperature && options.temperature !== undefined) {
            genConfig.temperature = options.temperature;
        }
        
        if (optionsEnabled.maxOutputTokens && options.maxOutputTokens !== undefined) {
            genConfig.maxOutputTokens = options.maxOutputTokens;
        }
        
        // 处理思考配置（Gemini 默认开启思考）
        // 如果 optionsEnabled.thinkingConfig 未定义，则默认为 true
        const thinkingEnabled = optionsEnabled.thinkingConfig !== false;
        if (thinkingEnabled) {
            const thinkingConfig = options.thinkingConfig || {};
            const apiThinkingConfig: any = {};
            
            // 是否包含思考内容（默认开启）
            const includeThoughts = thinkingConfig.includeThoughts !== false;
            if (includeThoughts) {
                apiThinkingConfig.includeThoughts = true;
            }
            
            // 根据模式设置思考等级或预算
            const mode = thinkingConfig.mode || 'default';
            if (mode === 'level' && thinkingConfig.thinkingLevel) {
                // 等级模式：发送思考等级
                apiThinkingConfig.thinkingLevel = thinkingConfig.thinkingLevel;
            } else if (mode === 'budget' && thinkingConfig.thinkingBudget !== undefined) {
                // 预算模式：发送思考预算
                apiThinkingConfig.thinkingBudget = thinkingConfig.thinkingBudget;
            }
            // default 模式：不发送等级或预算，使用 API 默认值
            
            // 只有当有配置项时才添加 thinkingConfig
            if (Object.keys(apiThinkingConfig).length > 0) {
                genConfig.thinkingConfig = apiThinkingConfig;
            }
        }
        
        return genConfig;
    }
    
    /**
     * 解析 Gemini API 响应
     */
    parseResponse(response: any): GenerateResponse {
        // 验证响应格式
        if (!response || !response.candidates || response.candidates.length === 0) {
            throw new Error(t('modules.channel.formatters.gemini.errors.invalidResponse'));
        }
        
        const candidate = response.candidates[0];
        
        // 提取完整的 Content，并统一 role 为 'model'（内部统一格式）
        const rawContent = candidate.content || {};
        const content: Content = {
            ...rawContent,
            role: 'model',
            parts: Array.isArray(rawContent.parts) ? rawContent.parts : []
        };
        
        // 提取思考签名并转换为内部格式，同时删除原始单数格式
        if (content.parts) {
            content.parts = content.parts.map(part => {
                const { thoughtSignature, ...rest } = part as any;
                if (thoughtSignature) {
                    return {
                        ...rest,
                        thoughtSignatures: { gemini: thoughtSignature }
                    };
                }
                return part;
            });
        }
        
        // 存储完整的 usageMetadata（包括多模态 token 详情）
        if (response.usageMetadata) {
            content.usageMetadata = {
                promptTokenCount: response.usageMetadata.promptTokenCount,
                candidatesTokenCount: response.usageMetadata.candidatesTokenCount,
                totalTokenCount: response.usageMetadata.totalTokenCount,
                thoughtsTokenCount: response.usageMetadata.thoughtsTokenCount,
                promptTokensDetails: response.usageMetadata.promptTokensDetails,
                candidatesTokensDetails: response.usageMetadata.candidatesTokensDetails
            };
        }
        
        // 存储模型版本
        if (response.modelVersion) {
            content.modelVersion = response.modelVersion;
        }
        
        // 提取结束原因
        const finishReason = candidate.finishReason;
        
        // 提取模型名称
        const model = response.modelVersion;
        
        return {
            content,
            finishReason,
            model,
            raw: response
        };
    }
    
    /**
     * 解析流式响应块
     */
    parseStreamChunk(chunk: any): StreamChunk {
        if (chunk && typeof chunk === 'object' && (chunk as any).__limcode_sse_done === true) {
            return {
                delta: [],
                done: true,
                finishReason: 'done'
            };
        }

        // 检查是否是错误响应（与非流式保持一致的错误格式）
        if (chunk.error) {
            throw new ChannelError(
                ErrorType.API_ERROR,
                t('modules.channel.formatters.gemini.errors.apiError', { code: chunk.error.code || 'UNKNOWN' }),
                chunk  // 保留完整的错误响应体
            );
        }
        
        // Gemini 流式响应格式：每个块都是一个完整的响应对象
        const candidate = chunk.candidates?.[0];
        
        if (!candidate) {
            return {
                delta: [],
                done: false
            };
        }
        
        const content = candidate.content;
        const parts = content?.parts || [];
        
        // 提取并转换思考签名（转换为内部复数格式，并删除原始单数格式）
        const processedParts = parts.map(part => {
            const { thoughtSignature, ...rest } = part as any;
            if (thoughtSignature) {
                return {
                    ...rest,
                    thoughtSignatures: { gemini: thoughtSignature }
                };
            }
            return part;
        });
        
        // 检查是否完成
        const done = !!candidate.finishReason;
        
        // 构建响应块
        const streamChunk: StreamChunk = {
            delta: processedParts,
            done
        };
        
        // 如果完成，添加完整的 token 信息（包括多模态详情）和模型版本
        if (done) {
            if (chunk.usageMetadata) {
                streamChunk.usage = {
                    promptTokenCount: chunk.usageMetadata.promptTokenCount,
                    candidatesTokenCount: chunk.usageMetadata.candidatesTokenCount,
                    totalTokenCount: chunk.usageMetadata.totalTokenCount,
                    thoughtsTokenCount: chunk.usageMetadata.thoughtsTokenCount,
                    promptTokensDetails: chunk.usageMetadata.promptTokensDetails,
                    candidatesTokensDetails: chunk.usageMetadata.candidatesTokensDetails
                };
            }
            streamChunk.finishReason = candidate.finishReason;
            
            // 添加模型版本
            if (chunk.modelVersion) {
                streamChunk.modelVersion = chunk.modelVersion;
            }
        }
        
        return streamChunk;
    }
    
    /**
     * 验证配置（不验证 API Key）
     */
    validateConfig(config: any): boolean {
        if (config.type !== 'gemini') {
            return false;
        }
        
        const geminiConfig = config as GeminiConfig;
        
        // 检查必需字段（不验证 apiKey）
        if (!geminiConfig.url || !geminiConfig.model) {
            return false;
        }
        
        return true;
    }
    
    /**
     * 获取支持的配置类型
     */
    getSupportedType(): string {
        return 'gemini';
    }
    
    /**
     * 将历史记录转换为 XML 模式
     *
     * 将 functionCall 和 functionResponse 转换为 XML 格式的文本
     * 这样模型看到的历史记录和它需要产出的格式是一致的
     *
     * 注意：functionResponse.parts 中的多模态内容会被提取并添加到消息中
     */
    private convertHistoryToXMLMode(history: Content[]): Content[] {
        return history.map(content => {
            const newParts: ContentPart[] = [];
            
            for (const part of content.parts) {
                if (part.functionCall) {
                    // 将 functionCall 转换为 XML 文本
                    const xmlText = convertFunctionCallToXML(
                        part.functionCall.name,
                        part.functionCall.args
                    );
                    newParts.push({ text: xmlText });
                } else if (part.functionResponse) {
                    // 将 functionResponse 转换为 XML 文本
                    const xmlText = convertFunctionResponseToXML(
                        part.functionResponse.name,
                        part.functionResponse.response
                    );
                    newParts.push({ text: xmlText });
                    
                    // 提取 functionResponse.parts 中的多模态内容
                    // 这些内容（如工具返回的图片）需要作为独立的 parts 发送给 AI
                    if (part.functionResponse.parts && part.functionResponse.parts.length > 0) {
                        for (const responsePart of part.functionResponse.parts) {
                            // 只提取多模态内容（inlineData 或 fileData）
                            if (responsePart.inlineData || responsePart.fileData) {
                                newParts.push(responsePart);
                            }
                        }
                    }
                } else {
                    // 其他类型的 part 保持不变
                    newParts.push(part);
                }
            }
            
            return {
                ...content,
                parts: newParts
            };
        });
    }
    
    /**
     * 将历史记录转换为 JSON 模式
     *
     * 将 functionCall 和 functionResponse 转换为 JSON 代码块格式的文本
     * 这样模型看到的历史记录和它需要产出的格式是一致的
     *
     * 注意：functionResponse.parts 中的多模态内容会被提取并添加到消息中
     */
    private convertHistoryToJSONMode(history: Content[]): Content[] {
        return history.map(content => {
            const newParts: ContentPart[] = [];
            
            for (const part of content.parts) {
                if (part.functionCall) {
                    // 将 functionCall 转换为 JSON 代码块
                    const jsonText = convertFunctionCallToJSON(
                        part.functionCall.name,
                        part.functionCall.args
                    );
                    newParts.push({ text: jsonText });
                } else if (part.functionResponse) {
                    // 将 functionResponse 转换为 JSON 代码块
                    const jsonText = convertFunctionResponseToJSON(
                        part.functionResponse.name,
                        part.functionResponse.response
                    );
                    newParts.push({ text: jsonText });
                    
                    // 提取 functionResponse.parts 中的多模态内容
                    // 这些内容（如工具返回的图片）需要作为独立的 parts 发送给 AI
                    if (part.functionResponse.parts && part.functionResponse.parts.length > 0) {
                        for (const responsePart of part.functionResponse.parts) {
                            // 只提取多模态内容（inlineData 或 fileData）
                            if (responsePart.inlineData || responsePart.fileData) {
                                newParts.push(responsePart);
                            }
                        }
                    }
                } else {
                    // 其他类型的 part 保持不变
                    newParts.push(part);
                }
            }
            
            return {
                ...content,
                parts: newParts
            };
        });
    }
    
    /**
     * 转换思考签名格式
     *
     * 将内部存储的 thoughtSignatures: { gemini: "..." } 格式
     * 转换为 Gemini API 需要的 thoughtSignature: "..." 格式
     */
    private convertThoughtSignatures(history: Content[]): Content[] {
        return history.map(content => ({
            role: content.role,
            parts: content.parts.map(part => {
                // 如果有 thoughtSignatures，提取 gemini 格式的签名
                if (part.thoughtSignatures?.gemini) {
                    const { thoughtSignatures, ...restPart } = part;
                    return {
                        ...restPart,
                        thoughtSignature: thoughtSignatures.gemini
                    };
                }
                // 如果没有 thoughtSignatures，直接返回原 part
                // 但需要确保不发送 thoughtSignatures 字段
                if (part.thoughtSignatures) {
                    const { thoughtSignatures, ...restPart } = part;
                    return restPart;
                }
                return part;
            })
        }));
    }
    
    /**
     * 转换工具声明为 Gemini 格式
     *
     * Gemini 格式：
     * {
     *   "tools": [{
     *     "function_declarations": [
     *       {
     *         "name": "tool_name",
     *         "description": "...",
     *         "parameters": { ... }
     *       }
     *     ]
     *   }]
     * }
     *
     * 注意：category 是内部字段，不发送给 API
     */
    convertTools(tools: ToolDeclaration[]): any {
        if (!tools || tools.length === 0) {
            return undefined;
        }
        
        // 转换工具声明，只保留 Gemini API 需要的字段
        const functionDeclarations = tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
        }));
        
        // Gemini 格式需要包装在 functionDeclarations 数组中
        return [{
            functionDeclarations: functionDeclarations
        }];
    }
}
