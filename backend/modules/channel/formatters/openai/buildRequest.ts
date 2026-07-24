import type { OpenAIConfig } from '../../../config/types';
import { applyCustomBody } from '../../../config/configs/base';
import type { ToolDeclaration } from '../../../../tools/types';
import { convertToolsToXML } from '../../../../tools/xmlFormatter';
import { convertToolsToJSON } from '../../../../tools/jsonFormatter';
import type { GenerateRequest, HttpRequestOptions } from '../../types';
import { convertOpenAIThoughtSignatures, convertOpenAITools } from '../openaiTooling';
import { buildOpenAIGenerationConfig } from './generationConfig';
import { convertToOpenAIMessages } from './history';

function normalizeApiKey(apiKey: unknown): string {
  if (typeof apiKey !== 'string') return '';
  const trimmed = apiKey.trim();
  if (!trimmed) return '';
  const bearerMatch = trimmed.match(/^bearer\s+(.+)$/i);
  return (bearerMatch ? bearerMatch[1] : trimmed).trim();
}

function findHeaderKey(headers: Record<string, string>, targetName: string): string | undefined {
  const targetLower = targetName.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === targetLower) return key;
  }
  return undefined;
}

export function buildOpenAIRequest(
  request: GenerateRequest,
  config: OpenAIConfig,
  tools?: ToolDeclaration[],
): HttpRequestOptions {
  const { history } = request;
  const toolMode = config.toolMode || 'function_call';

  let systemInstruction = config.systemInstruction;

  if (request.dynamicSystemPrompt) {
    systemInstruction = systemInstruction ? `${systemInstruction}\n\n${request.dynamicSystemPrompt}` : request.dynamicSystemPrompt;
  }

  let toolsContent = '';
<<<<<<< HEAD
=======
  let mcpToolsContent = '';
>>>>>>> f327a97 (merge: dev into main for v1.2.0)

  if (tools && tools.length > 0) {
    if (toolMode === 'xml') {
      toolsContent = convertToolsToXML(tools);
    } else if (toolMode === 'json') {
      toolsContent = convertToolsToJSON(tools);
    }
  }

<<<<<<< HEAD
  systemInstruction = systemInstruction?.replace(/\{\{\$MCP_TOOLS\}\}/g, '');
  if (systemInstruction && systemInstruction.includes('{{$TOOLS}}')) {
    systemInstruction = systemInstruction.replace(/\{\{\$TOOLS\}\}/g, toolsContent);
=======
  if (request.mcpToolsContent) {
    mcpToolsContent = request.mcpToolsContent;
  }

  if (systemInstruction && (systemInstruction.includes('{{$TOOLS}}') || systemInstruction.includes('{{$MCP_TOOLS}}'))) {
    systemInstruction = systemInstruction.replace(/\{\{\$TOOLS\}\}/g, toolsContent);
    systemInstruction = systemInstruction.replace(/\{\{\$MCP_TOOLS\}\}/g, mcpToolsContent);
>>>>>>> f327a97 (merge: dev into main for v1.2.0)
  } else if (toolsContent) {
    systemInstruction = systemInstruction ? `${systemInstruction}\n\n${toolsContent}` : toolsContent;
  }

  const processedHistory = convertOpenAIThoughtSignatures(history);
  const messages = convertToOpenAIMessages(processedHistory, systemInstruction, toolMode);

  const body: any = {
    model: config.model,
    messages,
  };

  if (tools && tools.length > 0) {
    const effectiveToolMode = config.toolMode || 'function_call';
    if (effectiveToolMode === 'function_call') {
      body.tools = convertOpenAITools(tools);
    }
  }

  const genConfig = buildOpenAIGenerationConfig(config);
  Object.assign(body, genConfig);

  const useStream = request.streamOverride ?? config.options?.stream ?? config.preferStream ?? true;
  body.stream = useStream;

  if (useStream) {
    body.stream_options = {
      include_usage: true,
    };
  }

  const baseUrl = config.url.endsWith('/') ? config.url.slice(0, -1) : config.url;
  const url = `${baseUrl}/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (config.customHeadersEnabled && config.customHeaders) {
    for (const header of config.customHeaders) {
      if (header.enabled && header.key && header.key.trim()) {
        headers[header.key.trim()] = header.value || '';
      }
    }
  }

  const normalizedApiKey = normalizeApiKey(config.apiKey);
  if (normalizedApiKey) {
    const existingAuthKey = findHeaderKey(headers, 'Authorization');
    const existingAuthValue = existingAuthKey ? String(headers[existingAuthKey] || '').trim() : '';

    // Avoid accidentally overriding the Authorization header with an empty custom header value.
    // Keep a non-empty custom Authorization header as-is.
    if (!existingAuthKey || existingAuthValue.length === 0) {
      if (existingAuthKey && existingAuthKey !== 'Authorization') {
        delete headers[existingAuthKey];
      }
      headers['Authorization'] = `Bearer ${normalizedApiKey}`;
    }
  }

  let finalBody: any = applyCustomBody(body, (config as any).customBody, (config as any).customBodyEnabled);
  if (!finalBody || typeof finalBody !== 'object' || Array.isArray(finalBody)) {
    finalBody = body;
  }

  finalBody.stream = useStream;
  if (useStream) {
    const so =
      finalBody.stream_options && typeof finalBody.stream_options === 'object' && !Array.isArray(finalBody.stream_options)
        ? finalBody.stream_options
        : {};
    so.include_usage = true;
    finalBody.stream_options = so;
  } else if (finalBody.stream_options) {
    delete finalBody.stream_options;
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
