import type { AnthropicConfig } from '../../../config/types';
import { applyCustomBody } from '../../../config/configs/base';
import type { ToolDeclaration } from '../../../../tools/types';
import { convertToolsToXML } from '../../../../tools/xmlFormatter';
import { convertToolsToJSON } from '../../../../tools/jsonFormatter';
import type { GenerateRequest, HttpRequestOptions } from '../../types';
import { buildAnthropicGenerationConfig } from './generationConfig';
import { convertToAnthropicMessages, convertThoughtSignatures } from './history';
import { convertAnthropicTools } from './tools';

export function buildAnthropicRequest(
  request: GenerateRequest,
  config: AnthropicConfig,
  tools?: ToolDeclaration[],
): HttpRequestOptions {
  const { history } = request;
  const toolMode = (config as any).toolMode || 'function_call';

  let systemInstruction = (config as any).systemInstruction || '';

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
  systemInstruction = systemInstruction.replace(/\{\{\$MCP_TOOLS\}\}/g, '');
  if (systemInstruction.includes('{{$TOOLS}}')) {
    systemInstruction = systemInstruction.replace(/\{\{\$TOOLS\}\}/g, toolsContent);
=======
  if (request.mcpToolsContent) {
    mcpToolsContent = request.mcpToolsContent;
  }

  if (systemInstruction.includes('{{$TOOLS}}') || systemInstruction.includes('{{$MCP_TOOLS}}')) {
    systemInstruction = systemInstruction.replace(/\{\{\$TOOLS\}\}/g, toolsContent);
    systemInstruction = systemInstruction.replace(/\{\{\$MCP_TOOLS\}\}/g, mcpToolsContent);
>>>>>>> f327a97 (merge: dev into main for v1.2.0)
  } else if (toolsContent) {
    systemInstruction = systemInstruction ? `${systemInstruction}\n\n${toolsContent}` : toolsContent;
  }

  const processedHistory = convertThoughtSignatures(history);
  const messages = convertToAnthropicMessages(processedHistory, toolMode);

  const body: any = {
    model: config.model,
    messages,
  };

  if (systemInstruction) {
    body.system = systemInstruction;
  }

  if (tools && tools.length > 0 && toolMode === 'function_call') {
    body.tools = convertAnthropicTools(tools);
  }

  const genConfig = buildAnthropicGenerationConfig(config);
  Object.assign(body, genConfig);

  const useStream = request.streamOverride ?? (config.options as any)?.stream ?? (config as any).preferStream ?? true;
  body.stream = useStream;

  let baseUrl = config.url.replace(/\/+$/, '');
  if (baseUrl.endsWith('/messages/count_tokens')) {
    baseUrl = baseUrl.replace(/\/messages\/count_tokens$/, '/messages');
  }
  const url = baseUrl.endsWith('/messages') ? baseUrl : `${baseUrl}/messages`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
  };

  if (useStream) {
    headers['Accept'] = 'text/event-stream';
  }

  if (config.apiKey) {
    if ((config as any).useAuthorizationHeader) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    } else {
      headers['x-api-key'] = config.apiKey;
    }
  }

  if ((config as any).customHeadersEnabled && (config as any).customHeaders) {
    for (const header of (config as any).customHeaders) {
      if (header.enabled && header.key && header.key.trim()) {
        headers[header.key.trim()] = header.value || '';
      }
    }
  }

  let finalBody: any = applyCustomBody(body, (config as any).customBody, (config as any).customBodyEnabled);
  if (!finalBody || typeof finalBody !== 'object' || Array.isArray(finalBody)) {
    finalBody = body;
  }

  finalBody.stream = useStream;

  return {
    url,
    method: 'POST',
    headers,
    body: finalBody,
    timeout: config.timeout,
    stream: useStream,
  };
}
