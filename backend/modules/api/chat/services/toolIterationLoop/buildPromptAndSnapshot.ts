import type { Content, ContextSnapshot, ContextSnapshotTools, ContextSnapshotTrim } from '../../../../conversation/types';

import { convertToolsToJSON } from '../../../../../tools/jsonFormatter';
import { convertToolsToXML } from '../../../../../tools/xmlFormatter';

import type { ToolIterationLoopDeps } from './deps';
import type { ToolIterationLoopConfig } from './types';
import { buildSnapshotModules, countMcpTools, getOrInitConversationStartTime, truncatePreview } from './helpers';

import { getPinnedPromptBlock, getPinnedPromptInjectedInfo } from '../pinnedPrompt';
import { getSelectionReferencesInjectedInfo } from '../selectionReferences';
import { buildLastMessageAttachmentsInjectedInfo, buildPinnedFilesInjectedInfo } from '../contextInjectionInfo';

export async function buildPromptAndSnapshot(params: {
    deps: ToolIterationLoopDeps;
    loopConfig: ToolIterationLoopConfig;
    iteration: number;
    history: Content[];
    fullHistory: Content[];
    trimStartIndex: number;
    contextOverrides: any;
    selectionReferences: any;
    toolsEnabled: boolean;
    pinnedPromptEnabled: boolean;
    toolAllowList?: string[];
}): Promise<{
    dynamicSystemPrompt: string;
    toolMode: ContextSnapshotTools['toolMode'];
    declarations: any[];
    contextSnapshot: ContextSnapshot;
}> {
    const {
        deps,
        loopConfig,
        iteration,
        history,
        fullHistory,
        trimStartIndex,
        contextOverrides,
        selectionReferences,
        toolsEnabled,
        pinnedPromptEnabled,
        toolAllowList
    } = params;

    const { conversationId, configId, config, isFirstMessage = false } = loopConfig;

    const baseSystemPrompt = (isFirstMessage && iteration === 1)
        ? deps.promptManager.refreshAndGetPrompt(contextOverrides)
        : deps.promptManager.getSystemPrompt(true, contextOverrides);

    const pinnedPromptBlock = pinnedPromptEnabled
        ? await getPinnedPromptBlock(deps.conversationManager, conversationId)
        : '';

    let dynamicSystemPrompt = [pinnedPromptBlock, baseSystemPrompt]
        .filter(Boolean)
        .join('\n\n');

    if (isFirstMessage && iteration === 1) {
        const startTime = await getOrInitConversationStartTime(deps.conversationManager, conversationId);
        dynamicSystemPrompt = [dynamicSystemPrompt, `====\n\nSESSION\n\nConversation Start Time: ${startTime}`]
            .filter(Boolean)
            .join('\n\n');
    }

    const toolMode = ((config.toolMode || 'function_call') as ContextSnapshotTools['toolMode']);
    let declarations = toolsEnabled
        ? deps.channelManager.getToolDeclarationsForPreview(config as any)
        : [];
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

    let systemInstruction = (config.systemInstruction as string | undefined) || '';
    if (dynamicSystemPrompt) {
        systemInstruction = systemInstruction
            ? `${systemInstruction}\n\n${dynamicSystemPrompt}`
            : dynamicSystemPrompt;
    }

    const mcpToolsDefinition = '';
    if (systemInstruction && (systemInstruction.includes('{{$TOOLS}}') || systemInstruction.includes('{{$MCP_TOOLS}}'))) {
        systemInstruction = systemInstruction.replace(/\{\{\$TOOLS\}\}/g, toolsDefinition);
        systemInstruction = systemInstruction.replace(/\{\{\$MCP_TOOLS\}\}/g, mcpToolsDefinition);
    } else if (toolsDefinition) {
        systemInstruction = systemInstruction
            ? `${systemInstruction}\n\n${toolsDefinition}`
            : toolsDefinition;
    }

    const sysPreview = truncatePreview(systemInstruction, 25000);
    const toolDefPreview = toolsDefinition
        ? truncatePreview(toolsDefinition, 12000)
        : null;

    let lastSummaryIndex = -1;
    for (let i = fullHistory.length - 1; i >= 0; i--) {
        if ((fullHistory[i] as any).isSummary === true) {
            lastSummaryIndex = i;
            break;
        }
    }
    const effectiveStartIndex = lastSummaryIndex >= 0 ? lastSummaryIndex : 0;

    const injected = {
        pinnedFiles: contextOverrides?.includePinnedFiles === false
            ? undefined
            : buildPinnedFilesInjectedInfo(),
        pinnedPrompt: pinnedPromptEnabled
            ? await getPinnedPromptInjectedInfo(deps.conversationManager, conversationId)
            : { mode: 'none' as const },
        attachments: buildLastMessageAttachmentsInjectedInfo(history),
        pinnedSelections: getSelectionReferencesInjectedInfo(selectionReferences),
    };
    const hasInjected = Boolean(
        injected.pinnedFiles ||
        injected.attachments ||
        injected.pinnedSelections ||
        (injected.pinnedPrompt && injected.pinnedPrompt.mode !== 'none')
    );

    const contextSnapshot: ContextSnapshot = {
        generatedAt: Date.now(),
        conversationId,
        configId,
        providerType: config.type,
        model: (config as any).model || '',
        tools: {
            toolMode,
            total: declarations.length,
            mcp: mcpCount,
            definitionPreview: toolDefPreview?.preview,
            definitionCharCount: toolDefPreview?.charCount,
            definitionTruncated: toolDefPreview?.truncated,
        } as ContextSnapshotTools,
        systemInstructionPreview: sysPreview.preview,
        systemInstructionCharCount: sysPreview.charCount,
        systemInstructionTruncated: sysPreview.truncated,
        modules: buildSnapshotModules(systemInstruction, 6000),
        injected: hasInjected ? injected : undefined,
        trim: {
            fullHistoryCount: fullHistory.length,
            trimmedHistoryCount: history.length,
            trimStartIndex,
            lastSummaryIndex,
            effectiveStartIndex,
        } as ContextSnapshotTrim,
    };

    return {
        dynamicSystemPrompt,
        toolMode,
        declarations,
        contextSnapshot
    };
}

