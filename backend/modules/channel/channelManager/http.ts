import { t } from '../../../i18n';
import type { SettingsManager } from '../../settings/SettingsManager';
import type { HttpRequestOptions, HttpResponse } from '../types';
import { ChannelError, ErrorType } from '../types';
import { createProxyFetch, proxyStreamFetch } from '../proxyFetch';
import { parseStreamBuffer } from '../streamParsing';
import { ChannelManagerBase } from './base';

export class ChannelManagerHttp extends ChannelManagerBase {
  protected getProxyUrl(): string | undefined {
    return (this.settingsManager as SettingsManager | undefined)?.getEffectiveProxyUrl();
  }

  protected async executeRequest(options: HttpRequestOptions, externalSignal?: AbortSignal): Promise<HttpResponse> {
    const { url, method, headers, body, timeout = 60000 } = options;
    const proxyUrl = this.getProxyUrl();

    const fetchFn = createProxyFetch(proxyUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const onExternalAbort = () => controller.abort();
    if (externalSignal) {
      externalSignal.addEventListener('abort', onExternalAbort);
    }

    try {
      const response = await fetchFn(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const responseBody = await response.json();

      return {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseBody,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        if (externalSignal?.aborted) {
          throw new ChannelError(ErrorType.CANCELLED_ERROR, t('modules.channel.errors.requestCancelled'));
        }
        throw new ChannelError(ErrorType.TIMEOUT_ERROR, t('modules.channel.errors.requestTimeout', { timeout }));
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
    }
  }

  protected async *executeStreamRequest(options: HttpRequestOptions, externalSignal?: AbortSignal): AsyncGenerator<any> {
    const { url, method, headers, body, timeout = 120000 } = options;
    const proxyUrl = this.getProxyUrl();

    const controller = new AbortController();

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

    resetTimeout();

    const onExternalAbort = () => controller.abort();
    if (externalSignal) {
      externalSignal.addEventListener('abort', onExternalAbort);
    }

    try {
      if (proxyUrl) {
        let buffer = '';

        for await (const chunk of proxyStreamFetch(
          url,
          {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            timeout,
            signal: controller.signal,
          },
          proxyUrl
        )) {
          if (externalSignal?.aborted) {
            break;
          }

          buffer += chunk;

          if (!buffer.trim()) {
            buffer = '';
            continue;
          }

          const result = parseStreamBuffer(buffer);
          buffer = result.remaining;

          if (result.chunks.length > 0 || buffer.length > 0) {
            resetTimeout();
          }

          for (const parsed of result.chunks) {
            yield parsed;
          }
        }

        if (buffer.trim()) {
          const result = parseStreamBuffer(buffer, true);
          for (const chunk of result.chunks) {
            yield chunk;
          }
        }

        if (isTimedOut) {
          throw new ChannelError(ErrorType.TIMEOUT_ERROR, t('modules.channel.errors.requestTimeoutNoResponse', { timeout }));
        }
      } else {
        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        if (!response.ok) {
          let errorBody: any;
          try {
            errorBody = await response.json();
          } catch {
            errorBody = await response.text();
          }
          throw new ChannelError(ErrorType.API_ERROR, t('modules.channel.errors.apiError', { status: response.status }), {
            status: response.status,
            headers: Object.fromEntries(response.headers.entries()),
            url,
            body: errorBody,
          });
        }

        if (!response.body) {
          throw new ChannelError(ErrorType.NETWORK_ERROR, t('modules.channel.errors.noResponseBody'));
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            if (!buffer.trim()) {
              buffer = '';
              continue;
            }

            const result = parseStreamBuffer(buffer);
            buffer = result.remaining;

            if (result.chunks.length > 0 || buffer.length > 0) {
              resetTimeout();
            }

            for (const chunk of result.chunks) {
              yield chunk;
            }
          }

          buffer += decoder.decode();

          if (buffer.trim()) {
            const result = parseStreamBuffer(buffer, true);
            for (const chunk of result.chunks) {
              yield chunk;
            }
          }

          if (isTimedOut) {
            throw new ChannelError(ErrorType.TIMEOUT_ERROR, t('modules.channel.errors.requestTimeoutNoResponse', { timeout }));
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
        if (externalSignal?.aborted) {
          throw new ChannelError(ErrorType.CANCELLED_ERROR, t('modules.channel.errors.requestCancelled'));
        }
        if (isTimedOut) {
          throw new ChannelError(ErrorType.TIMEOUT_ERROR, t('modules.channel.errors.requestTimeoutNoResponse', { timeout }));
        }
        throw new ChannelError(ErrorType.NETWORK_ERROR, t('modules.channel.errors.requestAborted'));
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
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
    }
  }

  async dispose(): Promise<void> {
    return;
  }
}

