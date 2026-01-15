/**
 * LimCode - 渠道管理器
 *
 * 核心渠道调用管理器，协调配置和格式转换器
 */

import { t } from '../../i18n';
import type { ConfigManager } from '../config/ConfigManager';
import type { ToolRegistry } from '../../tools/ToolRegistry';
import type { SettingsManager } from '../settings/SettingsManager';
import type { McpManager } from '../mcp/McpManager';
import type { ToolDeclaration } from '../../tools/types';
import { formatterRegistry } from './formatters';
import { createReadFileTool } from '../../tools/file/read_file';
import { createGenerateImageTool, createRemoveBackgroundTool, createCropImageTool, createResizeImageTool, createRotateImageTool } from '../../tools/media';
import type {
    GenerateRequest,
    GenerateResponse,
    StreamChunk,
    HttpRequestOptions,
    HttpResponse
} from './types';
import { ChannelError, ErrorType } from './types';
import { createProxyFetch, proxyStreamFetch } from './proxyFetch';
import { parseStreamBuffer } from './streamParsing';

/**
 * 重试状态回调类型
 */
export type RetryStatusCallback = (status: {
    type: 'retrying' | 'retrySuccess' | 'retryFailed';
    attempt: number;
    maxAttempts: number;
    error?: string;
    errorDetails?: any;  // 完整的错误详情（如 API 响应体）
    nextRetryIn?: number;
}) => void;

/**
 * 渠道管理器
 *
 * 负责：
 * 1. 从配置管理获取配置
 * 2. 选择合适的格式转换器
 * 3. 执行 HTTP 调用
 * 4. 解析响应并返回标准化数据
 * 5. 自动重试失败的请求
 */
export class ChannelManager {
    private mcpManager?: McpManager;
    private retryStatusCallback?: RetryStatusCallback;
    private static readonly RATE_LIMIT_RETRY_MIN_INTERVAL_MS = 15000;
    
    constructor(
        private configManager: ConfigManager,
        private toolRegistry?: ToolRegistry,
        private settingsManager?: SettingsManager
    ) {}
    
    /**
     * 设置重试状态回调
     */
    setRetryStatusCallback(callback: RetryStatusCallback): void {
        this.retryStatusCallback = callback;
    }
    
    /**
     * 设置 MCP 管理器（用于获取 MCP 工具声明）
     */
    setMcpManager(mcpManager: McpManager): void {
        this.mcpManager = mcpManager;
    }

    /**
     * 获取当前配置下可用的工具声明（用于 UI 预览/调试）
     *
     * 注意：该结果与实际请求时工具过滤逻辑保持一致（包含 Settings 过滤、动态参数、MCP 工具等）。
     */
    getToolDeclarationsForPreview(config: {
        type: string;
        toolMode?: 'function_call' | 'xml' | 'json';
        multimodalToolsEnabled?: boolean;
    }): ToolDeclaration[] {
        const declarations = this.getFilteredTools(
            (config as any).multimodalToolsEnabled,
            config.type as any,
            (config as any).toolMode,
        ) as ToolDeclaration[] | undefined;

        return declarations || [];
    }
    
    /**
     * 生成内容（自动选择流式或非流式）
     *
     * 决策逻辑：
     * 1. 优先使用配置的 options.stream
     * 2. 否则使用配置的 preferStream
     * 3. 默认为非流式（false）
     *
     * @param request 生成请求
     * @returns 生成响应或流式生成器
     */
    async generate(
        request: GenerateRequest
    ): Promise<GenerateResponse | AsyncGenerator<StreamChunk>> {
        // 1. 获取配置
        const config = await this.configManager.getConfig(request.configId);
        if (!config) {
            throw new ChannelError(
                ErrorType.CONFIG_ERROR,
                t('modules.channel.errors.configNotFound', { configId: request.configId })
            );
        }
        
        if (!config.enabled) {
            throw new ChannelError(
                ErrorType.CONFIG_ERROR,
                t('modules.channel.errors.configDisabled', { configId: request.configId })
            );
        }
        
        // 2. 决定是否使用流式
        // 优先级：config.options.stream > config.preferStream > 默认值（false）
        const optionsStream = (config as any).options?.stream;
        const useStream = optionsStream ?? config.preferStream ?? false;
        
        // 3. 根据 stream 决定调用哪个方法
        if (useStream) {
            return this.generateStream(request);
        } else {
            return this.generateNonStream(request);
        }
    }
    
    /**
     * 延迟函数（支持取消）
     *
     * @param ms 延迟毫秒数
     * @param signal 取消信号
     * @returns Promise，如果被取消则抛出 CANCELLED_ERROR
     */
    private delay(ms: number, signal?: AbortSignal): Promise<void> {
        return new Promise((resolve, reject) => {
            // 如果已经取消，立即拒绝
            if (signal?.aborted) {
                reject(new ChannelError(
                    ErrorType.CANCELLED_ERROR,
                    t('modules.channel.errors.requestCancelled')
                ));
                return;
            }
            
            const timeoutId = setTimeout(resolve, ms);
            
            // 监听取消信号
            if (signal) {
                const onAbort = () => {
                    clearTimeout(timeoutId);
                    reject(new ChannelError(
                        ErrorType.CANCELLED_ERROR,
                        t('modules.channel.errors.requestCancelled')
                    ));
                };
                signal.addEventListener('abort', onAbort, { once: true });
            }
        });
    }
    
    /**
     * 判断错误是否可重试
     */
    private isRetryableError(error: any): boolean {
        // API 错误（非 200 状态码）可重试
        if (error instanceof ChannelError) {
            // 用户取消错误不应重试
            if (error.type === ErrorType.CANCELLED_ERROR) {
                return false;
            }
            return error.type === ErrorType.API_ERROR ||
                   error.type === ErrorType.NETWORK_ERROR ||
                   error.type === ErrorType.TIMEOUT_ERROR;
        }
        // 网络错误可重试
        return true;
    }

    private isRateLimitError(error: unknown, errorDetails?: any): boolean {
        if (!(error instanceof ChannelError)) return false;
        if (error.type !== ErrorType.API_ERROR) return false;

        const details = errorDetails ?? error.details;
        const code = (details as any)?.error?.code ?? (details as any)?.code;
        if (code === 429) return true;

        const status = (details as any)?.error?.status ?? (details as any)?.status;
        if (status === 429) return true;
        if (typeof status === 'string' && status.toUpperCase() === 'RESOURCE_EXHAUSTED') return true;

        const message = (details as any)?.error?.message ?? (details as any)?.message;
        const messageText = [
            typeof message === 'string' ? message : '',
            typeof details === 'string' ? details : '',
            error.message
        ].filter(Boolean).join(' ');

        const haystack = messageText.toLowerCase();
        if (haystack.includes('429')) return true;

        return haystack.includes('rate limit') ||
            haystack.includes('too many requests') ||
            haystack.includes('resource_exhausted') ||
            haystack.includes('quota');
    }
    
    /**
     * 生成内容（非流式）- 内部实现
     *
     * @param request 生成请求
     * @returns 生成响应
     */
    private async generateNonStream(request: GenerateRequest): Promise<GenerateResponse> {
        // 检查是否已取消
        if (request.abortSignal?.aborted) {
            throw new ChannelError(
                ErrorType.CANCELLED_ERROR,
                t('modules.channel.errors.requestCancelled')
            );
        }
        
        // 1. 获取配置（此时已在 generate 中验证过）
        let config = (await this.configManager.getConfig(request.configId))!;
        
        // 2. 如果有 modelOverride，创建临时配置覆盖 model
        if (request.modelOverride) {
            config = { ...config, model: request.modelOverride };
        }
        
        // 3. 获取格式转换器
        const formatter = formatterRegistry.get(config.type);
        if (!formatter) {
            throw new ChannelError(
                ErrorType.CONFIG_ERROR,
                t('modules.channel.errors.unsupportedChannelType', { type: config.type })
            );
        }
        
        // 4. 验证配置
        if (!formatter.validateConfig(config)) {
            throw new ChannelError(
                ErrorType.VALIDATION_ERROR,
                t('modules.channel.errors.configValidationFailed', { configId: request.configId })
            );
        }
        
        // 5. 获取过滤后的工具声明（除非请求指定跳过工具）
        // 传递配置信息以便动态生成工具描述
        const tools = request.skipTools ? undefined : this.getFilteredTools(
            (config as any).multimodalToolsEnabled,
            config.type as 'gemini' | 'openai' | 'anthropic' | 'openai-responses' | 'custom',
            (config as any).toolMode
        );
        
        // 6. 构建请求
        let httpRequest: HttpRequestOptions;
        try {
            httpRequest = formatter.buildRequest(request, config, tools);
        } catch (error) {
            throw new ChannelError(
                ErrorType.VALIDATION_ERROR,
                t('modules.channel.errors.buildRequestFailed', { error: error instanceof Error ? error.message : t('errors.unknown') }),
                error
            );
        }
        
        // 7. 获取重试配置
        // 如果请求指定 skipRetry，则禁用重试
        const retryEnabled = request.skipRetry ? false : ((config as any).retryEnabled ?? true);  // 默认启用重试
        const maxRetries = (config as any).retryCount ?? 3;         // 默认3次
        const retryInterval = (config as any).retryInterval ?? 3000;  // 默认3秒
        
        // 8. 执行 HTTP 调用（带重试）
        let lastError: any;
        for (let attempt = 1; attempt <= (retryEnabled ? maxRetries : 1); attempt++) {
            // 在每次重试前检查是否已取消
            if (request.abortSignal?.aborted) {
                throw new ChannelError(
                    ErrorType.CANCELLED_ERROR,
                    t('modules.channel.errors.requestCancelled')
                );
            }
            
            try {
                const httpResponse = await this.executeRequest(httpRequest, request.abortSignal);
                
                // 检查 HTTP 状态
                if (httpResponse.status !== 200) {
                    throw new ChannelError(
                        ErrorType.API_ERROR,
                        t('modules.channel.errors.apiError', { status: httpResponse.status }),
                        httpResponse.body
                    );
                }
                
                // 如果是重试成功，通知前端
                if (attempt > 1 && this.retryStatusCallback) {
                    this.retryStatusCallback({
                        type: 'retrySuccess',
                        attempt,
                        maxAttempts: maxRetries
                    });
                }
                
                // 解析响应
                try {
                    return formatter.parseResponse(httpResponse.body);
                } catch (error) {
                    throw new ChannelError(
                        ErrorType.PARSE_ERROR,
                        t('modules.channel.errors.parseResponseFailed', { error: error instanceof Error ? error.message : t('errors.unknown') }),
                        { response: httpResponse.body, error }
                    );
                }
            } catch (error) {
                lastError = error;
                
                // 获取错误详情
                const errorMessage = error instanceof Error ? error.message : '未知错误';
                const errorDetails = error instanceof ChannelError ? error.details : undefined;
                
                // 检查是否可重试
                if (!retryEnabled || !this.isRetryableError(error) || attempt >= maxRetries) {
                    // 不能重试或已达到最大重试次数
                    if (attempt > 1 && this.retryStatusCallback) {
                        this.retryStatusCallback({
                            type: 'retryFailed',
                            attempt,
                            maxAttempts: maxRetries,
                            error: errorMessage,
                            errorDetails
                        });
                    }
                    break;
                }
                
                // 在调用重试回调之前再次检查是否已取消
                if (request.abortSignal?.aborted) {
                    throw new ChannelError(
                        ErrorType.CANCELLED_ERROR,
                        t('modules.channel.errors.requestCancelled')
                    );
                }
                
                // 通知前端正在重试
                if (this.retryStatusCallback) {
                    // 计算指数退避时间：retryInterval * 2^(attempt-1)
                    let currentInterval = retryInterval * Math.pow(2, attempt - 1);
                    if (config.type === 'gemini' && this.isRateLimitError(error, errorDetails)) {
                        currentInterval = Math.max(currentInterval, ChannelManager.RATE_LIMIT_RETRY_MIN_INTERVAL_MS);
                        currentInterval += Math.floor(Math.random() * 500); // jitter
                    }
                    
                    this.retryStatusCallback({
                        type: 'retrying',
                        attempt: attempt + 1,
                        maxAttempts: maxRetries,
                        error: errorMessage,
                        errorDetails,
                        nextRetryIn: currentInterval
                    });
                    
                    // 等待后重试（支持取消）
                    await this.delay(currentInterval, request.abortSignal);
                } else {
                    // 如果没有回调，也要等待
                    let currentInterval = retryInterval * Math.pow(2, attempt - 1);
                    if (config.type === 'gemini' && this.isRateLimitError(error, errorDetails)) {
                        currentInterval = Math.max(currentInterval, ChannelManager.RATE_LIMIT_RETRY_MIN_INTERVAL_MS);
                        currentInterval += Math.floor(Math.random() * 500); // jitter
                    }
                    await this.delay(currentInterval, request.abortSignal);
                }
            }
        }
        
        // 所有重试都失败
        if (lastError instanceof ChannelError) {
            throw lastError;
        }
        throw new ChannelError(
            ErrorType.NETWORK_ERROR,
            t('modules.channel.errors.httpRequestFailed', { error: lastError instanceof Error ? lastError.message : t('errors.unknown') }),
            lastError
        );
    }
    
    /**
     * 生成内容（流式）
     *
     * @param request 生成请求
     * @returns 异步生成器，产生流式响应块
     */
    async *generateStream(request: GenerateRequest): AsyncGenerator<StreamChunk> {
        // 1. 获取配置
        let config = await this.configManager.getConfig(request.configId);
        if (!config) {
            throw new ChannelError(
                ErrorType.CONFIG_ERROR,
                t('modules.channel.errors.configNotFound', { configId: request.configId })
            );
        }
        
        if (!config.enabled) {
            throw new ChannelError(
                ErrorType.CONFIG_ERROR,
                t('modules.channel.errors.configDisabled', { configId: request.configId })
            );
        }
        
        // 2. 如果有 modelOverride，创建临时配置覆盖 model
        if (request.modelOverride) {
            config = { ...config, model: request.modelOverride };
        }
        
        // 3. 获取格式转换器
        const formatter = formatterRegistry.get(config.type);
        if (!formatter) {
            throw new ChannelError(
                ErrorType.CONFIG_ERROR,
                t('modules.channel.errors.unsupportedChannelType', { type: config.type })
            );
        }
        
        // 4. 获取过滤后的工具声明（除非请求指定跳过工具）
        // 传递配置信息以便动态生成工具描述
        const tools = request.skipTools ? undefined : this.getFilteredTools(
            (config as any).multimodalToolsEnabled,
            config.type as 'gemini' | 'openai' | 'anthropic' | 'openai-responses' | 'custom',
            (config as any).toolMode
        );
        
        // 5. 构建请求
        const httpRequest = formatter.buildRequest(request, config, tools);
        
        // 6. 获取重试配置
        // 如果请求指定 skipRetry，则禁用重试
        const retryEnabled = request.skipRetry ? false : ((config as any).retryEnabled ?? true);  // 默认启用重试
        const maxRetries = (config as any).retryCount ?? 3;         // 默认3次
        const retryInterval = (config as any).retryInterval ?? 3000;  // 默认3秒
        
        // 7. 执行流式请求（带重试）
        let lastError: any;
        for (let attempt = 1; attempt <= (retryEnabled ? maxRetries : 1); attempt++) {
            try {
                const stream = await this.executeStreamRequest(httpRequest, request.abortSignal);
                
                // 如果是重试成功，通知前端
                if (attempt > 1 && this.retryStatusCallback) {
                    this.retryStatusCallback({
                        type: 'retrySuccess',
                        attempt,
                        maxAttempts: maxRetries
                    });
                }
                
                // 逐块解析和产出
                for await (const rawChunk of stream) {
                    try {
                        const chunk = formatter.parseStreamChunk(rawChunk);
                        yield chunk;
                    } catch (error) {
                        throw new ChannelError(
                            ErrorType.PARSE_ERROR,
                            t('modules.channel.errors.parseStreamChunkFailed', { error: error instanceof Error ? error.message : t('errors.unknown') }),
                            { chunk: rawChunk, error }
                        );
                    }
                }
                
                // 正常完成，退出重试循环
                return;
            } catch (error) {
                lastError = error;
                
                // 获取错误详情
                const errorMessage = error instanceof Error ? error.message : '未知错误';
                const errorDetails = error instanceof ChannelError ? error.details : undefined;
                
                // 检查是否可重试
                if (!retryEnabled || !this.isRetryableError(error) || attempt >= maxRetries) {
                    // 不能重试或已达到最大重试次数
                    if (attempt > 1 && this.retryStatusCallback) {
                        this.retryStatusCallback({
                            type: 'retryFailed',
                            attempt,
                            maxAttempts: maxRetries,
                            error: errorMessage,
                            errorDetails
                        });
                    }
                    break;
                }
                
                // 在调用重试回调之前检查是否已取消
                if (request.abortSignal?.aborted) {
                    throw new ChannelError(
                        ErrorType.CANCELLED_ERROR,
                        t('modules.channel.errors.requestCancelled')
                    );
                }
                
                // 通知前端正在重试
                if (this.retryStatusCallback) {
                    // 计算指数退避时间：retryInterval * 2^(attempt-1)
                    let currentInterval = retryInterval * Math.pow(2, attempt - 1);
                    if (config.type === 'gemini' && this.isRateLimitError(error, errorDetails)) {
                        currentInterval = Math.max(currentInterval, ChannelManager.RATE_LIMIT_RETRY_MIN_INTERVAL_MS);
                        currentInterval += Math.floor(Math.random() * 500); // jitter
                    }
                    
                    this.retryStatusCallback({
                        type: 'retrying',
                        attempt: attempt + 1,
                        maxAttempts: maxRetries,
                        error: errorMessage,
                        errorDetails,
                        nextRetryIn: currentInterval
                    });
                    
                    // 等待后重试（支持取消）
                    await this.delay(currentInterval, request.abortSignal);
                } else {
                    // 如果没有回调，也要等待
                    let currentInterval = retryInterval * Math.pow(2, attempt - 1);
                    if (config.type === 'gemini' && this.isRateLimitError(error, errorDetails)) {
                        currentInterval = Math.max(currentInterval, ChannelManager.RATE_LIMIT_RETRY_MIN_INTERVAL_MS);
                        currentInterval += Math.floor(Math.random() * 500); // jitter
                    }
                    await this.delay(currentInterval, request.abortSignal);
                }
            }
        }
        
        // 所有重试都失败
        if (lastError instanceof ChannelError) {
            throw lastError;
        }
        throw new ChannelError(
            ErrorType.NETWORK_ERROR,
            t('modules.channel.errors.streamRequestFailed', { error: lastError instanceof Error ? lastError.message : t('errors.unknown') }),
            lastError
        );
    }
    
    /**
     * 获取有效的代理 URL
     */
    private getProxyUrl(): string | undefined {
        return this.settingsManager?.getEffectiveProxyUrl();
    }
    
    /**
     * 执行 HTTP 请求
     *
     * @param options 请求选项
     * @param externalSignal 外部取消信号
     * @returns HTTP 响应
     */
    private async executeRequest(options: HttpRequestOptions, externalSignal?: AbortSignal): Promise<HttpResponse> {
        const { url, method, headers, body, timeout = 60000 } = options;
        const proxyUrl = this.getProxyUrl();
        
        // 使用代理 fetch 或原生 fetch
        const fetchFn = createProxyFetch(proxyUrl);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        // 监听外部取消信号
        const onExternalAbort = () => controller.abort();
        if (externalSignal) {
            externalSignal.addEventListener('abort', onExternalAbort);
        }
        
        try {
            const response = await fetchFn(url, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
                signal: controller.signal
            });
            
            // 解析响应体
            const responseBody = await response.json();
            
            return {
                status: response.status,
                headers: Object.fromEntries(response.headers.entries()),
                body: responseBody
            };
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                // 检查是外部取消还是超时
                if (externalSignal?.aborted) {
                    throw new ChannelError(
                        ErrorType.CANCELLED_ERROR,
                        t('modules.channel.errors.requestCancelled')
                    );
                }
                throw new ChannelError(
                    ErrorType.TIMEOUT_ERROR,
                    t('modules.channel.errors.requestTimeout', { timeout })
                );
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
            // 移除外部信号监听
            if (externalSignal) {
                externalSignal.removeEventListener('abort', onExternalAbort);
            }
        }
    }
    
    /**
     * 执行流式 HTTP 请求
     *
     * @param options 请求选项
     * @param externalSignal 外部取消信号
     * @returns 异步生成器，产生原始响应块
     */
    private async *executeStreamRequest(
        options: HttpRequestOptions,
        externalSignal?: AbortSignal
    ): AsyncGenerator<any> {
        const { url, method, headers, body, timeout = 120000 } = options;
        const proxyUrl = this.getProxyUrl();
        
        const controller = new AbortController();
        
        // 使用可重置的超时机制
        // 每次收到有效内容时重置超时，避免模型慢速生成时被误判为超时
        let timeoutId: NodeJS.Timeout;
        let isTimedOut = false;
        
        const resetTimeout = () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            timeoutId = setTimeout(() => {
                isTimedOut = true;
                controller.abort();
            }, timeout);
        };
        
        // 初始化超时
        resetTimeout();
        
        // 监听外部取消信号
        const onExternalAbort = () => controller.abort();
        if (externalSignal) {
            externalSignal.addEventListener('abort', onExternalAbort);
        }
        
        try {
            // 使用代理流式请求
            if (proxyUrl) {
                let buffer = '';
                
                for await (const chunk of proxyStreamFetch(url, {
                    method,
                    headers,
                    body: body ? JSON.stringify(body) : undefined,
                    timeout,
                    signal: controller.signal
                }, proxyUrl)) {
                    // 检查是否已取消
                    if (externalSignal?.aborted) {
                        break;
                    }
                    
                    // 收到数据，重置超时计时器
                    resetTimeout();
                    
                    buffer += chunk;
                    
                    // 处理流式响应
                    const result = parseStreamBuffer(buffer);
                    buffer = result.remaining;
                    
                    for (const parsed of result.chunks) {
                        yield parsed;
                    }
                }
                
                // 处理剩余的 buffer
                if (buffer.trim()) {
                    const result = parseStreamBuffer(buffer, true);
                    for (const chunk of result.chunks) {
                        yield chunk;
                    }
                }
                
                // 检查是否因超时而结束（proxyStreamFetch 在信号中止时会 break 而非 throw）
                if (isTimedOut) {
                    throw new ChannelError(
                        ErrorType.TIMEOUT_ERROR,
                        t('modules.channel.errors.requestTimeoutNoResponse', { timeout })
                    );
                }
            } else {
                // 原生 fetch 流式请求
                const response = await fetch(url, {
                    method,
                    headers,
                    body: body ? JSON.stringify(body) : undefined,
                    signal: controller.signal
                });
                
                if (!response.ok) {
                    // 尝试获取错误详情
                    let errorBody: any;
                    try {
                        errorBody = await response.json();
                    } catch {
                        errorBody = await response.text();
                    }
                    throw new ChannelError(
                        ErrorType.API_ERROR,
                        t('modules.channel.errors.apiError', { status: response.status }),
                        errorBody
                    );
                }
                
                if (!response.body) {
                    throw new ChannelError(
                        ErrorType.NETWORK_ERROR,
                        t('modules.channel.errors.noResponseBody')
                    );
                }
                
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        
                        // 收到数据，重置超时计时器
                        resetTimeout();
                        
                        buffer += decoder.decode(value, { stream: true });
                        
                        // 处理流式响应
                        const result = parseStreamBuffer(buffer);
                        buffer = result.remaining;
                        
                        for (const chunk of result.chunks) {
                            yield chunk;
                        }
                    }

                    // flush TextDecoder 内部缓冲，避免最后一个字符/字节丢失导致 JSON 无法解析
                    buffer += decoder.decode();
                    
                    // 处理剩余的 buffer
                    if (buffer.trim()) {
                        const result = parseStreamBuffer(buffer, true);
                        for (const chunk of result.chunks) {
                            yield chunk;
                        }
                    }
                    
                    // 检查是否因超时而结束
                    if (isTimedOut) {
                        throw new ChannelError(
                            ErrorType.TIMEOUT_ERROR,
                            t('modules.channel.errors.requestTimeoutNoResponse', { timeout })
                        );
                    }
                } finally {
                    reader.releaseLock();
                }
            }
        } catch (error) {
            if (error instanceof ChannelError) {
                throw error;
            }
            if (error instanceof Error && error.name === 'AbortError') {
                // 检查是外部取消还是超时
                if (externalSignal?.aborted) {
                    // 用户手动取消，使用 CANCELLED_ERROR，不应重试
                    throw new ChannelError(
                        ErrorType.CANCELLED_ERROR,
                        t('modules.channel.errors.requestCancelled')
                    );
                }
                if (isTimedOut) {
                    throw new ChannelError(
                        ErrorType.TIMEOUT_ERROR,
                        t('modules.channel.errors.requestTimeoutNoResponse', { timeout })
                    );
                }
                throw new ChannelError(
                    ErrorType.NETWORK_ERROR,
                    t('modules.channel.errors.requestAborted')
                );
            }
            throw new ChannelError(
                ErrorType.NETWORK_ERROR,
                t('modules.channel.errors.streamRequestFailed', { error: error instanceof Error ? error.message : t('errors.unknown') }),
                error
            );
        } finally {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            // 移除外部信号监听
            if (externalSignal) {
                externalSignal.removeEventListener('abort', onExternalAbort);
            }
        }
    }
    
    /**
     * 解析流式响应缓冲区
     *
     * 支持两种格式：
     * 1. SSE (Server-Sent Events): data: {...}\n\n (Gemini ?alt=sse, OpenAI, Anthropic)
     * 2. JSON 数组格式（逐步发送）
     */
    // parseStreamBuffer 已抽离到 ./streamParsing.ts（纯函数），避免与 VSCode 运行时耦合
    
    /**
     * 获取过滤后的工具声明
     *
     * 根据 SettingsManager 的配置过滤启用的工具
     * 同时合并 MCP 服务器提供的工具
     * 所有工具的 schema 都会被清理，移除不支持的字段
     *
     * @param multimodalEnabled 是否启用多模态工具
     * @param channelType 渠道类型
     * @param toolMode 工具调用模式
     */
    private getFilteredTools(
        multimodalEnabled?: boolean,
        channelType?: 'gemini' | 'openai' | 'anthropic' | 'openai-responses' | 'custom',
        toolMode?: 'function_call' | 'xml' | 'json'
    ) {
        const tools: any[] = [];
        
        // 1. 获取内置工具
        if (this.toolRegistry) {
            let builtinTools: any[] | undefined;
            
            if (this.settingsManager) {
                // 使用设置管理器过滤工具
                builtinTools = this.toolRegistry.getDeclarationsBy(
                    toolName => this.settingsManager!.isToolEnabled(toolName)
                );
            } else {
                // 没有设置管理器，返回所有工具
                builtinTools = this.toolRegistry.getAllDeclarations();
            }
            
            // 清理内置工具的 schema，并动态更新特定工具的描述
            if (builtinTools) {
                for (const tool of builtinTools) {
                    let declaration = { ...tool };
                    
                    // 对 read_file 工具动态生成描述
                    if (tool.name === 'read_file') {
                        const dynamicTool = createReadFileTool(multimodalEnabled, channelType, toolMode);
                        declaration = { ...declaration, description: dynamicTool.declaration.description };
                    }
                    
                    // 对 generate_image 工具：
                    // 1. 未启用多模态时不包含此工具
                    // 2. OpenAI Function Call 模式不包含此工具（不支持多模态返回）
                    if (tool.name === 'generate_image') {
                        // 检查是否应该排除此工具
                        const shouldExclude = !multimodalEnabled ||
                            (channelType === 'openai' && toolMode === 'function_call');
                        
                        if (shouldExclude) {
                            continue;  // 跳过此工具
                        }
                        
                        // 从设置获取配置
                        const imageConfig = this.settingsManager?.getGenerateImageConfig();
                        const maxBatchTasks = imageConfig?.maxBatchTasks || 5;
                        const maxImagesPerTask = imageConfig?.maxImagesPerTask || 1;
                        
                        // 构建参数配置
                        const paramsConfig = {
                            enableAspectRatio: imageConfig?.enableAspectRatio ?? false,
                            forcedAspectRatio: imageConfig?.defaultAspectRatio || undefined,
                            enableImageSize: imageConfig?.enableImageSize ?? false,
                            forcedImageSize: imageConfig?.defaultImageSize || undefined
                        };
                        
                        // 根据配置动态创建工具（影响工具参数定义）
                        const dynamicTool = createGenerateImageTool(maxBatchTasks, maxImagesPerTask, paramsConfig);
                        declaration = {
                            ...declaration,
                            description: dynamicTool.declaration.description,
                            parameters: dynamicTool.declaration.parameters  // 使用动态生成的参数定义
                        };
                    }
                    
                    // 对 remove_background 工具：
                    // 1. 未启用多模态时不包含此工具
                    // 2. OpenAI Function Call 模式不包含此工具（不支持多模态返回）
                    if (tool.name === 'remove_background') {
                        // 检查是否应该排除此工具
                        const shouldExclude = !multimodalEnabled ||
                            (channelType === 'openai' && toolMode === 'function_call');
                        
                        if (shouldExclude) {
                            continue;  // 跳过此工具
                        }
                        
                        // 从设置获取配置（复用 generate_image 配置的批量限制）
                        const imageConfig = this.settingsManager?.getGenerateImageConfig();
                        const maxBatchTasks = imageConfig?.maxBatchTasks || 5;
                        const dynamicTool = createRemoveBackgroundTool(maxBatchTasks);
                        declaration = { ...declaration, description: dynamicTool.declaration.description };
                    }
                    
                    // 对 crop_image 工具：
                    // 1. 未启用多模态时不包含此工具（需要读取和返回图片）
                    // 2. OpenAI Function Call 模式不包含此工具（不支持多模态返回）
                    if (tool.name === 'crop_image') {
                        // 检查是否应该排除此工具
                        const shouldExclude = !multimodalEnabled ||
                            (channelType === 'openai' && toolMode === 'function_call');
                        
                        if (shouldExclude) {
                            continue;  // 跳过此工具
                        }
                        
                        // 从设置获取配置（复用 generate_image 配置的批量限制）
                        const imageConfig = this.settingsManager?.getGenerateImageConfig();
                        const maxBatchTasks = imageConfig?.maxBatchTasks || 10;
                        const dynamicTool = createCropImageTool(maxBatchTasks);
                        declaration = { ...declaration, description: dynamicTool.declaration.description };
                    }
                    
                    // 对 resize_image 工具：
                    // 1. 未启用多模态时不包含此工具（需要读取和返回图片）
                    // 2. OpenAI Function Call 模式不包含此工具（不支持多模态返回）
                    if (tool.name === 'resize_image') {
                        // 检查是否应该排除此工具
                        const shouldExclude = !multimodalEnabled ||
                            (channelType === 'openai' && toolMode === 'function_call');
                        
                        if (shouldExclude) {
                            continue;  // 跳过此工具
                        }
                        
                        // 从设置获取配置（复用 generate_image 配置的批量限制）
                        const imageConfig = this.settingsManager?.getGenerateImageConfig();
                        const maxBatchTasks = imageConfig?.maxBatchTasks || 10;
                        const dynamicTool = createResizeImageTool(maxBatchTasks);
                        declaration = { ...declaration, description: dynamicTool.declaration.description };
                    }
                    
                    // 对 rotate_image 工具：
                    // 1. 未启用多模态时不包含此工具（需要读取和返回图片）
                    // 2. OpenAI Function Call 模式不包含此工具（不支持多模态返回）
                    if (tool.name === 'rotate_image') {
                        // 检查是否应该排除此工具
                        const shouldExclude = !multimodalEnabled ||
                            (channelType === 'openai' && toolMode === 'function_call');
                        
                        if (shouldExclude) {
                            continue;  // 跳过此工具
                        }
                        
                        // 从设置获取配置（复用 generate_image 配置的批量限制）
                        const imageConfig = this.settingsManager?.getGenerateImageConfig();
                        const maxBatchTasks = imageConfig?.maxBatchTasks || 10;
                        const dynamicTool = createRotateImageTool(maxBatchTasks);
                        declaration = { ...declaration, description: dynamicTool.declaration.description };
                    }
                    
                    tools.push({
                        ...declaration,
                        parameters: this.cleanJsonSchema(declaration.parameters)
                    });
                }
            }
        }
        
        // 2. 获取 MCP 工具
        if (this.mcpManager) {
            const mcpTools = this.mcpManager.getAllTools();
            for (const serverTools of mcpTools) {
                for (const tool of serverTools.tools || []) {
                    // 将 MCP 工具转换为函数声明格式
                    // 工具名称格式：mcp__{serverId}__{toolName}
                    // 使用双下划线分隔，因为 Gemini API 不允许函数名中包含多个冒号
                    const toolName = `mcp__${serverTools.serverId}__${tool.name}`;
                    
                    // 根据服务器配置决定是否清理 schema
                    const rawSchema = tool.inputSchema || { type: 'object', properties: {} };
                    const schema = serverTools.cleanSchema
                        ? this.cleanJsonSchema(rawSchema)
                        : rawSchema;
                    
                    tools.push({
                        name: toolName,
                        description: tool.description || `MCP tool: ${tool.name}`,
                        parameters: schema
                    });
                }
            }
        }
        
        return tools.length > 0 ? tools : undefined;
    }
    
    /**
     * 清理 JSON Schema，移除不支持的字段
     *
     * Gemini 不支持以下字段：
     * - $schema
     * - additionalProperties
     */
    private cleanJsonSchema(schema: any): any {
        if (!schema || typeof schema !== 'object') {
            return schema;
        }
        
        const cleaned: any = {};
        
        for (const key of Object.keys(schema)) {
            // 跳过不支持的字段
            if (key === '$schema' || key === 'additionalProperties') {
                continue;
            }
            
            const value = schema[key];
            
            // 递归处理嵌套对象
            if (value && typeof value === 'object') {
                if (Array.isArray(value)) {
                    cleaned[key] = value.map(item => this.cleanJsonSchema(item));
                } else {
                    cleaned[key] = this.cleanJsonSchema(value);
                }
            } else {
                cleaned[key] = value;
            }
        }
        
        return cleaned;
    }
    
    /**
     * 清理资源（如果需要）
     */
    async dispose(): Promise<void> {
        // 目前无需特殊清理
    }
}
