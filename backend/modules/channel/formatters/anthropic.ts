/**
 * Anthropic formatter entrypoint.
 *
 * The implementation is split into smaller modules under `./anthropic/*` to
 * keep file sizes manageable.
 */

import { BaseFormatter } from './base';
import type { AnthropicConfig } from '../../config/types';
import type { ToolDeclaration } from '../../../tools/types';
import type {
  GenerateRequest,
  GenerateResponse,
  StreamChunk,
  HttpRequestOptions,
} from '../types';
import { buildAnthropicRequest } from './anthropic/buildRequest';
import { parseAnthropicResponse } from './anthropic/parseResponse';
import { parseAnthropicStreamChunk } from './anthropic/parseStreamChunk';
import { convertAnthropicTools } from './anthropic/tools';

export class AnthropicFormatter extends BaseFormatter {
  buildRequest(
    request: GenerateRequest,
    config: AnthropicConfig,
    tools?: ToolDeclaration[],
  ): HttpRequestOptions {
    return buildAnthropicRequest(request, config, tools);
  }

  parseResponse(response: any): GenerateResponse {
    return parseAnthropicResponse(response);
  }

  parseStreamChunk(chunk: any): StreamChunk {
    return parseAnthropicStreamChunk(chunk);
  }

  validateConfig(config: any): boolean {
    if (config.type !== 'anthropic') {
      return false;
    }

    const anthropicConfig = config as AnthropicConfig;
    if (!anthropicConfig.url || !anthropicConfig.model) {
      return false;
    }

    return true;
  }

  getSupportedType(): string {
    return 'anthropic';
  }

  convertTools(tools: ToolDeclaration[]): any {
    return convertAnthropicTools(tools);
  }
}
