import { t } from '../../../i18n';
import type { SettingsManager } from '../../settings/SettingsManager';
import type { HttpRequestOptions, HttpResponse } from '../types';
import { ChannelError, ErrorType } from '../types';
import { createProxyFetch, proxyStreamFetch } from '../proxyFetch';
import { parseStreamBuffer } from '../streamParsing';
import { ChannelManagerBase } from './base';

async function parseJsonOrTextResponseBody(response: Response): Promise<any> {
  const raw = await response.text();
  if (!raw) return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

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

    const MAX_STREAM_PREVIEW_CHARS = 64 * 1024;
    let streamPreview = '';
    const appendPreview = (chunk: string) => {
      if (!chunk) return;
      if (streamPreview.length >= MAX_STREAM_PREVIEW_CHARS) return;
      const remaining = MAX_STREAM_PREVIEW_CHARS - streamPreview.length;
      streamPreview += chunk.length > remaining ? chunk.slice(0, remaining) : chunk;
    };

    let parsedChunkCount = 0;

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

          if (chunk) {
            resetTimeout();
            appendPreview(chunk);
          }

          buffer += chunk;

          if (!buffer.trim()) {
            buffer = '';
            continue;
          }

          const result = parseStreamBuffer(buffer);
          buffer = result.remaining;

          for (const parsed of result.chunks) {
            parsedChunkCount++;
            yield parsed;
          }
        }

        if (buffer.trim()) {
          const result = parseStreamBuffer(buffer, true);
          for (const chunk of result.chunks) {
            parsedChunkCount++;
            yield chunk;
          }
        }

        if (parsedChunkCount === 0) {
          const preview = streamPreview.trim();
          if (preview) {
            throw new ChannelError(
              ErrorType.PARSE_ERROR,
              t('modules.channel.errors.streamNoParsableChunks'),
              { url, preview: preview.slice(0, 4096) }
            );
          }
          throw new ChannelError(
            ErrorType.NETWORK_ERROR,
            t('modules.channel.errors.streamNoDataReceived'),
            { url }
          );
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
          const errorBody = await parseJsonOrTextResponseBody(response);
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

        const contentType = response.headers.get('content-type') || undefined;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            resetTimeout();

            const decoded = decoder.decode(value, { stream: true });
            appendPreview(decoded);
            buffer += decoded;

            if (!buffer.trim()) {
              buffer = '';
              continue;
            }

            const result = parseStreamBuffer(buffer);
            buffer = result.remaining;

            for (const chunk of result.chunks) {
              parsedChunkCount++;
              yield chunk;
            }
          }

          const rest = decoder.decode();
          appendPreview(rest);
          buffer += rest;

          if (buffer.trim()) {
            const result = parseStreamBuffer(buffer, true);
            for (const chunk of result.chunks) {
              parsedChunkCount++;
              yield chunk;
            }
          }

          if (parsedChunkCount === 0) {
            const preview = streamPreview.trim();
            if (preview) {
              throw new ChannelError(
                ErrorType.PARSE_ERROR,
                t('modules.channel.errors.streamNoParsableChunks'),
                { url, status: response.status, contentType, preview: preview.slice(0, 4096) }
              );
            }
            throw new ChannelError(
              ErrorType.NETWORK_ERROR,
              t('modules.channel.errors.streamNoDataReceived'),
              { url, status: response.status, contentType }
            );
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
