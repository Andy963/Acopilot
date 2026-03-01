import { t } from '../../../i18n';
import type { ConfigManager } from '../../config/ConfigManager';
import type { SettingsManager } from '../../settings/SettingsManager';
import type { McpManager } from '../../mcp/McpManager';
import type { ToolRegistry } from '../../../tools/ToolRegistry';
import type { ToolDeclaration } from '../../../tools/types';
import { ChannelError, ErrorType } from '../types';
import { getFilteredTools } from '../channelToolFiltering';

export type RetryStatusCallback = (status: {
  type: 'retrying' | 'retrySuccess' | 'retryFailed';
  attempt: number;
  maxAttempts: number;
  error?: string;
  errorDetails?: any;
  nextRetryIn?: number;
}) => void;

export class ChannelManagerBase {
  protected mcpManager?: McpManager;
  protected retryStatusCallback?: RetryStatusCallback;

  constructor(
    protected configManager: ConfigManager,
    protected toolRegistry?: ToolRegistry,
    protected settingsManager?: SettingsManager
  ) {}

  setRetryStatusCallback(callback: RetryStatusCallback): void {
    this.retryStatusCallback = callback;
  }

  setMcpManager(mcpManager: McpManager): void {
    this.mcpManager = mcpManager;
  }

  getToolDeclarationsForPreview(config: {
    type: string;
    toolMode?: 'function_call' | 'xml' | 'json';
    multimodalToolsEnabled?: boolean;
  }): ToolDeclaration[] {
    const declarations = getFilteredTools(
      this.toolRegistry,
      this.settingsManager,
      this.mcpManager,
      (config as any).multimodalToolsEnabled,
      config.type as any,
      (config as any).toolMode
    );

    return declarations || [];
  }

  protected delay(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new ChannelError(ErrorType.CANCELLED_ERROR, t('modules.channel.errors.requestCancelled')));
        return;
      }

      const timeoutId = setTimeout(resolve, ms);

      if (signal) {
        const onAbort = () => {
          clearTimeout(timeoutId);
          reject(new ChannelError(ErrorType.CANCELLED_ERROR, t('modules.channel.errors.requestCancelled')));
        };
        signal.addEventListener('abort', onAbort, { once: true });
      }
    });
  }

  protected isApiErrorDetailsWrapper(details: unknown): details is { status: number; body?: unknown } {
    return (
      !!details &&
      typeof details === 'object' &&
      !Array.isArray(details) &&
      typeof (details as any).status === 'number' &&
      Object.prototype.hasOwnProperty.call(details as any, 'body')
    );
  }

  protected unwrapApiErrorBody(details: unknown): unknown {
    return this.isApiErrorDetailsWrapper(details) ? (details as any).body : details;
  }

  protected getHttpStatusFromErrorDetails(details: unknown, depth = 0): number | undefined {
    if (!details || depth > 2) return undefined;

    if (typeof details === 'object' && !Array.isArray(details)) {
      const anyDetails = details as any;

      if (typeof anyDetails.status === 'number') return anyDetails.status;
      if (typeof anyDetails.code === 'number') return anyDetails.code;

      const err = anyDetails.error;
      if (err && typeof err === 'object') {
        if (typeof err.status === 'number') return err.status;
        if (typeof err.code === 'number') return err.code;
      }

      if (Object.prototype.hasOwnProperty.call(anyDetails, 'body')) {
        return this.getHttpStatusFromErrorDetails(anyDetails.body, depth + 1);
      }
    }

    return undefined;
  }

  protected isRetryableError(error: any): boolean {
    if (error instanceof ChannelError) {
      if (error.type === ErrorType.CANCELLED_ERROR) {
        return false;
      }

      if (error.type === ErrorType.API_ERROR) {
        const status = this.getHttpStatusFromErrorDetails(error.details);
        if (typeof status === 'number') {
          return status === 429 || status === 408 || (status >= 500 && status <= 599);
        }
        return true;
      }

      return error.type === ErrorType.NETWORK_ERROR || error.type === ErrorType.TIMEOUT_ERROR;
    }

    return true;
  }

  protected isRateLimitError(error: unknown, errorDetails?: any): boolean {
    if (!(error instanceof ChannelError)) return false;
    if (error.type !== ErrorType.API_ERROR) return false;

    const details = errorDetails ?? error.details;
    const status = this.getHttpStatusFromErrorDetails(details);
    if (status === 429) return true;

    const body = this.unwrapApiErrorBody(details) as any;
    const code = body?.error?.code ?? body?.code;
    if (code === 429) return true;

    const upstreamStatus = body?.error?.status ?? body?.status;
    if (upstreamStatus === 429) return true;
    if (typeof upstreamStatus === 'string' && upstreamStatus.toUpperCase() === 'RESOURCE_EXHAUSTED') return true;

    const message = body?.error?.message ?? body?.message;
    const messageText = [typeof message === 'string' ? message : '', typeof body === 'string' ? body : '', error.message]
      .filter(Boolean)
      .join(' ');

    const haystack = messageText.toLowerCase();
    if (haystack.includes('429')) return true;

    return (
      haystack.includes('rate limit') ||
      haystack.includes('too many requests') ||
      haystack.includes('resource_exhausted') ||
      haystack.includes('quota')
    );
  }

  protected isStreamRequiredError(error: unknown, errorDetails?: any): boolean {
    if (!(error instanceof ChannelError)) return false;
    if (error.type !== ErrorType.API_ERROR) return false;

    const details = errorDetails ?? error.details;
    const body = this.unwrapApiErrorBody(details) as any;
    const msg =
      (body?.error && typeof body.error.message === 'string' ? body.error.message : undefined) ??
      (typeof body?.message === 'string' ? body.message : undefined) ??
      (typeof body === 'string' ? body : undefined) ??
      error.message;

    const haystack = String(msg || '').toLowerCase();
    if (!haystack.includes('stream')) return false;

    return (
      haystack.includes('set to true') ||
      (haystack.includes('must') && haystack.includes('true')) ||
      (haystack.includes('required') && haystack.includes('true'))
    );
  }
}

