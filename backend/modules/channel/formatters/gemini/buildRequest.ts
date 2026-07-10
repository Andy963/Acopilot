import type { GeminiConfig } from '../../../config/types';
import { applyCustomBody } from '../../../config/configs/base';
import type { ToolDeclaration } from '../../../../tools/types';
import { convertToolsToXML } from '../../../../tools/xmlFormatter';
import { convertToolsToJSON } from '../../../../tools/jsonFormatter';
import type { GenerateRequest, HttpRequestOptions } from '../../types';
import { buildGeminiGenerationConfig } from './generationConfig';
import {
  convertGeminiThoughtSignatures,
  convertHistoryToJSONMode,
  convertHistoryToXMLMode,
  convertTextInlineDataToTextParts,
  normalizeHistoryRoles,
  sanitizeContents,
} from './history';
import { buildGeminiGenerateContentUrl } from './url';
import { convertGeminiTools } from './tools';

export function buildGeminiRequest(
  request: GenerateRequest,
  config: GeminiConfig,
  tools?: ToolDeclaration[],
): HttpRequestOptions {
  const { history } = request;
  const toolMode = config.toolMode || 'function_call';

  let processedHistory = history;
  if (toolMode === 'xml') {
    processedHistory = convertHistoryToXMLMode(history);
  } else if (toolMode === 'json') {
    processedHistory = convertHistoryToJSONMode(history);
  }

  processedHistory = normalizeHistoryRoles(processedHistory);
  processedHistory = convertGeminiThoughtSignatures(processedHistory);
  processedHistory = convertTextInlineDataToTextParts(processedHistory);

  const sanitizedHistory = sanitizeContents(processedHistory);
  const body: any = {
    contents: sanitizedHistory,
    generationConfig: buildGeminiGenerationConfig(config),
  };

  let systemInstruction = config.systemInstruction || '';

  if (request.dynamicSystemPrompt) {
    systemInstruction = systemInstruction ? `${systemInstruction}\n\n${request.dynamicSystemPrompt}` : request.dynamicSystemPrompt;
  }

  let toolsContent = '';

  if (tools && tools.length > 0) {
    if (toolMode === 'function_call') {
      body.tools = convertGeminiTools(tools);
    } else if (toolMode === 'xml') {
      toolsContent = convertToolsToXML(tools);
    } else if (toolMode === 'json') {
      toolsContent = convertToolsToJSON(tools);
    }
  }

  systemInstruction = systemInstruction.replace(/\{\{\$MCP_TOOLS\}\}/g, '');
  if (systemInstruction.includes('{{$TOOLS}}')) {
    systemInstruction = systemInstruction.replace(/\{\{\$TOOLS\}\}/g, toolsContent);
  } else if (toolsContent) {
    systemInstruction = systemInstruction ? `${systemInstruction}\n\n${toolsContent}` : toolsContent;
  }

  if (systemInstruction) {
    body.systemInstruction = {
      role: 'user',
      parts: [{ text: systemInstruction }],
    };
  }

  const useStream = request.streamOverride ?? config.options?.stream ?? config.preferStream ?? true;
  const url = buildGeminiGenerateContentUrl(config.url, config.model, useStream);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (useStream) {
    headers['Accept'] = 'text/event-stream';
  }

  if (config.apiKey) {
    if (config.useAuthorizationHeader) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    } else {
      headers['x-goog-api-key'] = config.apiKey;
    }
  }

  if (config.customHeadersEnabled && config.customHeaders) {
    for (const header of config.customHeaders) {
      if (header.enabled && header.key && header.key.trim()) {
        headers[header.key.trim()] = header.value || '';
      }
    }
  }

  let finalBody: any = applyCustomBody(body, config.customBody, config.customBodyEnabled);
  if (!finalBody || typeof finalBody !== 'object' || Array.isArray(finalBody)) {
    finalBody = body;
  }

  let sanitizedContents = sanitizeContents(finalBody.contents);
  if (sanitizedContents.length === 0) {
    sanitizedContents = sanitizedHistory;
  }
  if (sanitizedContents.length === 0) {
    throw new Error('Gemini request requires a non-empty contents array');
  }
  finalBody.contents = sanitizedContents;

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

  return {
    url,
    method: 'POST',
    headers,
    body: finalBody,
    timeout: config.timeout,
    stream: useStream,
  };
}
