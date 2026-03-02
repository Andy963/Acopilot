import { t } from '../../../i18n';
import type { ToolDeclaration } from '../../../tools/types';
import { formatterRegistry } from '../formatters';
import type { GenerateRequest, GenerateResponse, HttpRequestOptions, StreamChunk } from '../types';
import { ChannelError, ErrorType } from '../types';
import { getFilteredTools } from '../channelToolFiltering';
import { ChannelManagerHttp } from './http';

export type { RetryStatusCallback } from './base';

export class ChannelManager extends ChannelManagerHttp {
  async generate(request: GenerateRequest): Promise<GenerateResponse | AsyncGenerator<StreamChunk>> {
    const config = await this.configManager.getConfig(request.configId);
    if (!config) {
      throw new ChannelError(ErrorType.CONFIG_ERROR, t('modules.channel.errors.configNotFound', { configId: request.configId }));
    }

    if (!config.enabled) {
      throw new ChannelError(ErrorType.CONFIG_ERROR, t('modules.channel.errors.configDisabled', { configId: request.configId }));
    }

    const optionsStream = (config as any).options?.stream;
    const useStream = request.streamOverride ?? optionsStream ?? config.preferStream ?? false;

    if (useStream) {
      return this.generateStream({ ...request, streamOverride: true });
    }

    try {
      return await this.generateNonStream({ ...request, streamOverride: false });
    } catch (error) {
      const errorDetails = error instanceof ChannelError ? error.details : undefined;
      if (request.streamOverride === undefined && this.isStreamRequiredError(error, errorDetails)) {
        return this.generateStream({ ...request, streamOverride: true });
      }
      throw error;
    }
  }

  override getToolDeclarationsForPreview(config: {
    type: string;
    toolMode?: 'function_call' | 'xml' | 'json';
    multimodalToolsEnabled?: boolean;
  }): ToolDeclaration[] {
    return super.getToolDeclarationsForPreview(config);
  }

  private async generateNonStream(request: GenerateRequest): Promise<GenerateResponse> {
    const nonStreamRequest: GenerateRequest = { ...request, streamOverride: false };
    if (nonStreamRequest.abortSignal?.aborted) {
      throw new ChannelError(ErrorType.CANCELLED_ERROR, t('modules.channel.errors.requestCancelled'));
    }

    let config = (await this.configManager.getConfig(nonStreamRequest.configId))!;

    if (nonStreamRequest.modelOverride) {
      config = { ...config, model: nonStreamRequest.modelOverride };
    }

    const formatter = formatterRegistry.get(config.type);
    if (!formatter) {
      throw new ChannelError(ErrorType.CONFIG_ERROR, t('modules.channel.errors.unsupportedChannelType', { type: config.type }));
    }

    if (!formatter.validateConfig(config)) {
      throw new ChannelError(
        ErrorType.VALIDATION_ERROR,
        t('modules.channel.errors.configValidationFailed', { configId: nonStreamRequest.configId })
      );
    }

    const tools = nonStreamRequest.skipTools
      ? undefined
      : getFilteredTools(
        this.toolRegistry,
        this.settingsManager,
        this.mcpManager,
        (config as any).multimodalToolsEnabled,
        config.type as 'gemini' | 'openai' | 'anthropic' | 'openai-responses' | 'custom',
        (config as any).toolMode,
        nonStreamRequest.toolAllowList
      );

    let httpRequest: HttpRequestOptions;
    try {
      httpRequest = formatter.buildRequest(nonStreamRequest, config, tools);
    } catch (error) {
      throw new ChannelError(
        ErrorType.VALIDATION_ERROR,
        t('modules.channel.errors.buildRequestFailed', {
          error: error instanceof Error ? error.message : t('errors.unknown'),
        }),
        error
      );
    }

    const retryEnabled = nonStreamRequest.skipRetry ? false : ((config as any).retryEnabled ?? true);
    const maxRetries = (config as any).retryCount ?? 3;
    const retryInterval = (config as any).retryInterval ?? 3000;

    let lastError: any;
    for (let attempt = 1; attempt <= (retryEnabled ? maxRetries : 1); attempt++) {
      if (nonStreamRequest.abortSignal?.aborted) {
        throw new ChannelError(ErrorType.CANCELLED_ERROR, t('modules.channel.errors.requestCancelled'));
      }

      try {
        const httpResponse = await this.executeRequest(httpRequest, nonStreamRequest.abortSignal);

	        if (httpResponse.status !== 200) {
	          throw new ChannelError(ErrorType.API_ERROR, t('modules.channel.errors.apiError', { status: httpResponse.status }), {
	            status: httpResponse.status,
	            headers: httpResponse.headers,
	            url: httpRequest.url,
	            body: httpResponse.body,
	          });
	        }

        if (attempt > 1 && this.retryStatusCallback) {
          this.retryStatusCallback({
            type: 'retrySuccess',
            attempt,
            maxAttempts: maxRetries,
          });
        }

        try {
          return formatter.parseResponse(httpResponse.body);
        } catch (error) {
          throw new ChannelError(
            ErrorType.PARSE_ERROR,
            t('modules.channel.errors.parseResponseFailed', {
              error: error instanceof Error ? error.message : t('errors.unknown'),
            }),
            { response: httpResponse.body, error }
          );
        }
      } catch (error) {
        lastError = error;

	        const errorMessage = error instanceof Error ? error.message : '未知错误';
	        const errorDetails = error instanceof ChannelError ? error.details : undefined;

        if (this.isStreamRequiredError(error, errorDetails)) {
          break;
        }

        if (!retryEnabled || !this.isRetryableError(error) || attempt >= maxRetries) {
          if (attempt > 1 && this.retryStatusCallback) {
            this.retryStatusCallback({
              type: 'retryFailed',
              attempt,
              maxAttempts: maxRetries,
              error: errorMessage,
              errorDetails,
            });
          }
          break;
        }

        if (nonStreamRequest.abortSignal?.aborted) {
          throw new ChannelError(ErrorType.CANCELLED_ERROR, t('modules.channel.errors.requestCancelled'));
        }

        let currentInterval = retryInterval * Math.pow(2, attempt - 1);
        if (config.type === 'gemini' && this.isRateLimitError(error, errorDetails)) {
          currentInterval += Math.floor(Math.random() * 500);
        }

        if (this.retryStatusCallback) {
          this.retryStatusCallback({
            type: 'retrying',
            attempt: attempt + 1,
            maxAttempts: maxRetries,
            error: errorMessage,
            errorDetails,
            nextRetryIn: currentInterval,
          });
        }

        await this.delay(currentInterval, nonStreamRequest.abortSignal);
      }
    }

	    if (lastError instanceof ChannelError) {
	      throw lastError;
	    }
    throw new ChannelError(
      ErrorType.NETWORK_ERROR,
      t('modules.channel.errors.httpRequestFailed', { error: lastError instanceof Error ? lastError.message : t('errors.unknown') }),
      lastError
    );
  }

	  async *generateStream(request: GenerateRequest): AsyncGenerator<StreamChunk> {
    const streamRequest: GenerateRequest = { ...request, streamOverride: true };

    let config = await this.configManager.getConfig(streamRequest.configId);
    if (!config) {
      throw new ChannelError(ErrorType.CONFIG_ERROR, t('modules.channel.errors.configNotFound', { configId: streamRequest.configId }));
    }

    if (!config.enabled) {
      throw new ChannelError(ErrorType.CONFIG_ERROR, t('modules.channel.errors.configDisabled', { configId: streamRequest.configId }));
    }

    if (streamRequest.modelOverride) {
      config = { ...config, model: streamRequest.modelOverride };
    }

    const formatter = formatterRegistry.get(config.type);
    if (!formatter) {
      throw new ChannelError(ErrorType.CONFIG_ERROR, t('modules.channel.errors.unsupportedChannelType', { type: config.type }));
    }

    const tools = streamRequest.skipTools
      ? undefined
      : getFilteredTools(
        this.toolRegistry,
        this.settingsManager,
        this.mcpManager,
        (config as any).multimodalToolsEnabled,
        config.type as 'gemini' | 'openai' | 'anthropic' | 'openai-responses' | 'custom',
        (config as any).toolMode,
        streamRequest.toolAllowList
      );

	    const httpRequest = formatter.buildRequest(streamRequest, config, tools);

    const retryEnabled = streamRequest.skipRetry ? false : ((config as any).retryEnabled ?? true);
    const maxRetries = (config as any).retryCount ?? 3;
    const retryInterval = (config as any).retryInterval ?? 3000;

	    let lastError: any;
	    for (let attempt = 1; attempt <= (retryEnabled ? maxRetries : 1); attempt++) {
	      try {
	        const stream = this.executeStreamRequest(httpRequest, streamRequest.abortSignal);

        if (attempt > 1 && this.retryStatusCallback) {
          this.retryStatusCallback({
            type: 'retrySuccess',
            attempt,
            maxAttempts: maxRetries,
          });
        }

        for await (const rawChunk of stream) {
          try {
            const chunk = formatter.parseStreamChunk(rawChunk);
            yield chunk;
          } catch (error) {
            throw new ChannelError(
              ErrorType.PARSE_ERROR,
              t('modules.channel.errors.parseStreamChunkFailed', {
                error: error instanceof Error ? error.message : t('errors.unknown'),
              }),
              { chunk: rawChunk, error }
            );
          }
        }

        return;
	      } catch (error) {
	        lastError = error;

	        const errorMessage = error instanceof Error ? error.message : '未知错误';
	        const errorDetails = error instanceof ChannelError ? error.details : undefined;

	        if (!retryEnabled || !this.isRetryableError(error) || attempt >= maxRetries) {
	          if (attempt > 1 && this.retryStatusCallback) {
	            this.retryStatusCallback({
	              type: 'retryFailed',
              attempt,
              maxAttempts: maxRetries,
              error: errorMessage,
              errorDetails,
            });
          }
          break;
        }

        if (streamRequest.abortSignal?.aborted) {
          throw new ChannelError(ErrorType.CANCELLED_ERROR, t('modules.channel.errors.requestCancelled'));
        }

        let currentInterval = retryInterval * Math.pow(2, attempt - 1);
        if (config.type === 'gemini' && this.isRateLimitError(error, errorDetails)) {
          currentInterval += Math.floor(Math.random() * 500);
        }

        if (this.retryStatusCallback) {
          this.retryStatusCallback({
            type: 'retrying',
            attempt: attempt + 1,
            maxAttempts: maxRetries,
            error: errorMessage,
            errorDetails,
            nextRetryIn: currentInterval,
          });
        }

        await this.delay(currentInterval, streamRequest.abortSignal);
      }
    }

    if (lastError instanceof ChannelError) {
      throw lastError;
    }
    throw new ChannelError(
      ErrorType.NETWORK_ERROR,
      t('modules.channel.errors.streamRequestFailed', { error: lastError instanceof Error ? lastError.message : t('errors.unknown') }),
      lastError
    );
  }
}
