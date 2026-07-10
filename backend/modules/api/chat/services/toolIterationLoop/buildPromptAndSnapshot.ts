import type { Content, ContextSnapshot, ContextSnapshotTools, ContextSnapshotTrim } from '../../../../conversation/types';

import { convertToolsToJSON } from '../../../../../tools/jsonFormatter';
import { convertToolsToXML } from '../../../../../tools/xmlFormatter';

import type { ToolIterationLoopDeps } from './deps';
import type { ToolIterationLoopConfig } from './types';
import {
    appendConversationMessageSemantics,
    buildSnapshotModules,
    getOrInitConversationStartTime,
    truncatePreview
} from './helpers';

import { applyPinnedPromptPlaceholders, getPinnedPromptBlocks, getPinnedPromptInjectedInfo } from '../pinnedPrompt';
import { getSelectionReferencesInjectedInfo } from '../selectionReferences';
import { buildLastMessageAttachmentsInjectedInfo, buildPinnedFilesInjectedInfo } from '../contextInjectionInfo';
import { buildSummaryPreview } from '../../summaryPreview';

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
    estimatedTotalTokens?: number;
    maxContextTokens?: number;
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
        toolAllowList,
        estimatedTotalTokens,
        maxContextTokens
    } = params;

    const { conversationId, configId, config, isFirstMessage = false } = loopConfig;

    const baseSystemPrompt = (isFirstMessage && iteration === 1)
        ? deps.promptManager.refreshAndGetPrompt(contextOverrides)
        : deps.promptManager.getSystemPrompt(true, contextOverrides);

    const pinnedPromptBlocks = pinnedPromptEnabled
        ? await getPinnedPromptBlocks(deps.conversationManager, conversationId)
        : [];

    let dynamicSystemPrompt = applyPinnedPromptPlaceholders(baseSystemPrompt, pinnedPromptBlocks);

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

    systemInstruction = systemInstruction.replace(/\{\{\$MCP_TOOLS\}\}/g, '');
    if (systemInstruction && systemInstruction.includes('{{$TOOLS}}')) {
        systemInstruction = systemInstruction.replace(/\{\{\$TOOLS\}\}/g, toolsDefinition);
    } else if (toolsDefinition) {
        systemInstruction = systemInstruction
            ? `${systemInstruction}\n\n${toolsDefinition}`
            : toolsDefinition;
    }

    systemInstruction = appendConversationMessageSemantics(systemInstruction);

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
    const summary = lastSummaryIndex >= 0
        ? buildSummaryPreview(fullHistory[lastSummaryIndex])
        : undefined;

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
        estimatedTotalTokens,
        maxContextTokens,
        tools: {
            toolMode,
            total: declarations.length,
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
            summary,
        } as ContextSnapshotTrim,
    };

    return {
        dynamicSystemPrompt,
        toolMode,
        declarations,
        contextSnapshot
    };
}
