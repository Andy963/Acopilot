/**
 * Gemini formatter entrypoint.
 *
 * The implementation is split into smaller modules under `./gemini/*` to keep
 * the per-file size manageable.
 */

import { BaseFormatter } from './base';
import type { GeminiConfig } from '../../config/types';
import type { ToolDeclaration } from '../../../tools/types';
import type { GenerateRequest, GenerateResponse, StreamChunk, HttpRequestOptions } from '../types';
import { buildGeminiRequest } from './gemini/buildRequest';
import { parseGeminiResponse } from './gemini/parseResponse';
import { parseGeminiStreamChunk } from './gemini/parseStreamChunk';
import { convertGeminiTools } from './gemini/tools';

export class GeminiFormatter extends BaseFormatter {
  buildRequest(request: GenerateRequest, config: GeminiConfig, tools?: ToolDeclaration[]): HttpRequestOptions {
    return buildGeminiRequest(request, config, tools);
  }

  parseResponse(response: any): GenerateResponse {
    return parseGeminiResponse(response);
  }

  parseStreamChunk(chunk: any): StreamChunk {
    return parseGeminiStreamChunk(chunk);
  }

  validateConfig(config: any): boolean {
    if (config.type !== 'gemini') {
      return false;
    }

    const geminiConfig = config as GeminiConfig;
    if (!geminiConfig.url || !geminiConfig.model) {
      return false;
    }

    return true;
  }

  getSupportedType(): string {
    return 'gemini';
  }

  convertTools(tools: ToolDeclaration[]): any {
    return convertGeminiTools(tools);
  }
}

