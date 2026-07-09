import { t } from '../../../i18n';
import type { ConfigManager } from '../../config/ConfigManager';
import type { ChannelManager } from '../../channel/ChannelManager';
import type { ConversationManager } from '../../conversation/ConversationManager';
import type { SettingsManager } from '../../settings/SettingsManager';
import type { SelectionReference, ContextInjectionOverrides } from '../../conversation/types';
import type { ToolDeclaration } from '../../../tools/types';
import { convertToolsToJSON } from '../../../tools/jsonFormatter';
import { convertToolsToXML } from '../../../tools/xmlFormatter';
import { applyPinnedPromptPlaceholders, getPinnedPromptBlocks, getPinnedPromptInjectedInfo } from './services/pinnedPrompt';
import { getSelectionReferencesInjectedInfo } from './services/selectionReferences';
import { buildPinnedFilesInjectedInfo, buildPreviewAttachmentsInjectedInfo } from './services/contextInjectionInfo';
import { resolveChatModePolicy } from './services/chatMode';
import { buildSummaryPreview } from './summaryPreview';
import type { PromptManager } from '../../prompt/PromptManager';
import type { MessageBuilderService, ContextTrimService } from './services';
import type {
  ChatMode,
  ContextInspectorData,
  ContextInspectorModule,
  ContextInspectorTrim,
  ContextInspectorTools
} from './types';

export async function buildContextInspectorData(params: {
  request: {
    conversationId?: string;
    configId: string;
    chatMode?: ChatMode;
    attachments?: unknown;
    selectionReferences?: SelectionReference[];
    contextOverrides?: ContextInjectionOverrides;
  };
  configManager: ConfigManager;
  channelManager: ChannelManager;
  conversationManager: ConversationManager;
  promptManager: PromptManager;
  messageBuilderService: MessageBuilderService;
  contextTrimService: ContextTrimService;
  settingsManager?: SettingsManager;
}): Promise<ContextInspectorData> {
  const conversationId = params.request.conversationId?.trim();
  const configId = params.request.configId;
  const chatModePolicy = resolveChatModePolicy({
    chatMode: params.request.chatMode ?? 'chat',
    contextOverrides: params.request.contextOverrides,
    taskContext: undefined,
  });
  const contextOverrides = chatModePolicy.effectiveContextOverrides;
  const selectionReferences = params.request.selectionReferences;
  const toolsEnabled = contextOverrides?.includeTools !== false;
  const pinnedPromptEnabled = contextOverrides?.includePinnedPrompt !== false;

  const config = await params.configManager.getConfig(configId);
  if (!config) {
    throw new Error(t('modules.api.chat.errors.configNotFound', { configId }));
  }
  if (!config.enabled) {
    throw new Error(t('modules.api.chat.errors.configDisabled', { configId }));
  }

  const baseSystemPrompt = params.promptManager.getSystemPrompt(true, contextOverrides);
  const pinnedPromptBlocks = (conversationId && pinnedPromptEnabled)
    ? await getPinnedPromptBlocks(params.conversationManager, conversationId)
    : [];
  const dynamicSystemPrompt = applyPinnedPromptPlaceholders(baseSystemPrompt, pinnedPromptBlocks);

  let systemInstruction = (config.systemInstruction as string | undefined) || '';
  if (dynamicSystemPrompt) {
    systemInstruction = systemInstruction ? `${systemInstruction}\n\n${dynamicSystemPrompt}` : dynamicSystemPrompt;
  }

  const toolMode = ((config.toolMode || 'function_call') as ContextInspectorTools['toolMode']);
  let declarations: ToolDeclaration[] = toolsEnabled
    ? params.channelManager.getToolDeclarationsForPreview(config as any)
    : [];
  const toolAllowList = Array.isArray(contextOverrides?.toolAllowList)
    ? contextOverrides!.toolAllowList!.filter((n) => typeof n === 'string' && n.trim()).map((n) => n.trim())
    : undefined;
  if (Array.isArray(toolAllowList) && toolAllowList.length > 0) {
    const allowSet = new Set(toolAllowList);
    declarations = declarations.filter((d) => allowSet.has(d.name));
  }
  const mcpCount = countMcpTools(declarations);

  let toolsDefinition = '';
  if (toolMode === 'xml') {
    toolsDefinition = convertToolsToXML(declarations);
  } else if (toolMode === 'json') {
    toolsDefinition = convertToolsToJSON(declarations);
  }

  const mcpToolsDefinition = '';
  if (systemInstruction && (systemInstruction.includes('{{$TOOLS}}') || systemInstruction.includes('{{$MCP_TOOLS}}'))) {
    systemInstruction = systemInstruction.replace(/\{\{\$TOOLS\}\}/g, toolsDefinition);
    systemInstruction = systemInstruction.replace(/\{\{\$MCP_TOOLS\}\}/g, mcpToolsDefinition);
  } else if (toolsDefinition) {
    systemInstruction = systemInstruction ? `${systemInstruction}\n\n${toolsDefinition}` : toolsDefinition;
  }

  const systemInstructionPreviewLimit = 80000;
  const modulePreviewLimit = 12000;
  const toolDefinitionPreviewLimit = 40000;

  const systemInstructionPreviewInfo = truncatePreview(systemInstruction, systemInstructionPreviewLimit);
  const modules = buildModules(systemInstruction, modulePreviewLimit);
  const toolDefPreview = toolsDefinition ? truncatePreview(toolsDefinition, toolDefinitionPreviewLimit) : null;

  const tools: ContextInspectorTools = {
    toolMode,
    total: declarations.length,
    mcp: mcpCount,
    definitionPreview: toolDefPreview?.preview,
    definitionCharCount: toolDefPreview?.charCount,
    definitionTruncated: toolDefPreview?.truncated,
  };

  let trim: ContextInspectorTrim | undefined;
  if (conversationId) {
    await params.conversationManager.getHistory(conversationId);

    const historyOptions = params.messageBuilderService.buildHistoryOptions(config);
    const trimInfo = await params.contextTrimService.getHistoryWithContextTrimInfo(
      conversationId,
      config,
      historyOptions,
      contextOverrides,
      selectionReferences
    );

    const fullHistory = await params.conversationManager.getHistoryRef(conversationId);
    let lastSummaryIndex = -1;
    for (let i = fullHistory.length - 1; i >= 0; i--) {
      if ((fullHistory[i] as any).isSummary === true) {
        lastSummaryIndex = i;
        break;
      }
    }
    const effectiveStartIndex = lastSummaryIndex >= 0 ? lastSummaryIndex : 0;
    const summary = lastSummaryIndex >= 0
      ? buildSummaryPreview(fullHistory[lastSummaryIndex])
      : undefined;

    trim = {
      fullHistoryCount: fullHistory.length,
      trimmedHistoryCount: trimInfo.history.length,
      trimStartIndex: trimInfo.trimStartIndex,
      lastSummaryIndex,
      effectiveStartIndex,
      summary,
    };
  }

  const injected = {
    pinnedFiles: contextOverrides?.includePinnedFiles === false
      ? undefined
      : buildPinnedFilesInjectedInfo(params.settingsManager),
    pinnedPrompt: conversationId
      ? (pinnedPromptEnabled ? await getPinnedPromptInjectedInfo(params.conversationManager, conversationId) : { mode: 'none' as const })
      : undefined,
    attachments: buildPreviewAttachmentsInjectedInfo(params.request.attachments),
    pinnedSelections: getSelectionReferencesInjectedInfo(selectionReferences),
  };
  const hasInjected = Boolean(
    injected.pinnedFiles ||
    injected.attachments ||
    injected.pinnedSelections ||
    (injected.pinnedPrompt && injected.pinnedPrompt.mode !== 'none')
  );

  return {
    generatedAt: Date.now(),
    conversationId: conversationId || undefined,
    configId,
    providerType: config.type,
    model: (config as any).model || '',
    tools,
    systemInstructionPreview: systemInstructionPreviewInfo.preview,
    systemInstructionCharCount: systemInstructionPreviewInfo.charCount,
    systemInstructionTruncated: systemInstructionPreviewInfo.truncated,
    modules,
    injected: hasInjected ? injected : undefined,
    trim,
  };
}

function truncatePreview(text: string, maxChars: number): { preview: string; truncated: boolean; charCount: number } {
  const safeText = text || '';
  const charCount = safeText.length;
  if (charCount <= maxChars) {
    return { preview: safeText, truncated: false, charCount };
  }
  return { preview: safeText.slice(0, maxChars), truncated: true, charCount };
}

function parseSections(text: string): Array<{ title: string; content: string }> {
  const marker = '====\n\n';
  const sections: Array<{ title: string; content: string }> = [];
  let index = 0;

  while (index < text.length) {
    const markerPos = text.indexOf(marker, index);
    if (markerPos === -1) {
      const tail = text.slice(index).trim();
      if (tail) {
        sections.push({ title: 'TEXT', content: tail });
      }
      break;
    }

    if (markerPos > index) {
      const prefix = text.slice(index, markerPos).trim();
      if (prefix) {
        sections.push({ title: 'TEXT', content: prefix });
      }
    }

    const titleStart = markerPos + marker.length;
    const titleEnd = text.indexOf('\n\n', titleStart);
    if (titleEnd === -1) {
      const rest = text.slice(markerPos).trim();
      if (rest) {
        sections.push({ title: 'TEXT', content: rest });
      }
      break;
    }

    const title = text.slice(titleStart, titleEnd).trim() || 'SECTION';
    const contentStart = titleEnd + 2;
    const nextMarkerPos = text.indexOf(marker, contentStart);
    const rawContent = nextMarkerPos === -1
      ? text.slice(contentStart)
      : text.slice(contentStart, nextMarkerPos);

    sections.push({ title, content: rawContent.trim() });
    index = nextMarkerPos === -1 ? text.length : nextMarkerPos;
  }

  return sections;
}

function buildModules(systemInstruction: string, maxCharsPerSection: number): ContextInspectorModule[] {
  const sections = parseSections(systemInstruction);
  const out: ContextInspectorModule[] = [];

  for (const s of sections) {
    const preview = truncatePreview(s.content, maxCharsPerSection);
    out.push({
      title: s.title,
      contentPreview: preview.preview,
      charCount: preview.charCount,
      truncated: preview.truncated
    });
  }

  return out;
}

function countMcpTools(tools: Array<{ name: string }>): number {
  return tools.filter(t => typeof t.name === 'string' && t.name.startsWith('mcp__')).length;
}
