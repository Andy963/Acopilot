/**
 * OpenAI formatter entrypoint.
 *
 * The implementation is split into smaller modules under `./openai/*` to keep
 * the per-file size manageable.
 */

import { BaseFormatter } from './base';
import type { OpenAIConfig } from '../../config/types';
import type { ToolDeclaration } from '../../../tools/types';
import type { GenerateRequest, GenerateResponse, StreamChunk, HttpRequestOptions } from '../types';
import { convertOpenAITools } from './openaiTooling';
import { buildOpenAIRequest } from './openai/buildRequest';
import { parseOpenAIResponse } from './openai/parseResponse';
import { parseOpenAIStreamChunk } from './openai/parseStreamChunk';

export class OpenAIFormatter extends BaseFormatter {
  buildRequest(request: GenerateRequest, config: OpenAIConfig, tools?: ToolDeclaration[]): HttpRequestOptions {
    return buildOpenAIRequest(request, config, tools);
  }

  parseResponse(response: any): GenerateResponse {
    return parseOpenAIResponse(response);
  }

  parseStreamChunk(chunk: any): StreamChunk {
    return parseOpenAIStreamChunk(chunk);
  }

  validateConfig(config: any): boolean {
    if (config.type !== 'openai') {
      return false;
    }

    const openaiConfig = config as OpenAIConfig;
    if (!openaiConfig.url || !openaiConfig.model) {
      return false;
    }

    return true;
  }

  getSupportedType(): string {
    return 'openai';
  }

  convertTools(tools: ToolDeclaration[]): any {
    return convertOpenAITools(tools);
  }
}

