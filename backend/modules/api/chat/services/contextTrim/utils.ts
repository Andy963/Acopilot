import type { Content, SelectionReference } from '../../../../conversation/types';
import type { ConversationManager, GetHistoryOptions } from '../../../../conversation/ConversationManager';
import type { BaseChannelConfig } from '../../../../config/configs/base';
import type { ContextTrimInfo } from '../../utils';
import type { ConversationRound } from '../../utils';

export interface RoundTokenInfo {
    startIndex: number;
    endIndex: number;
    cumulativeTokens: number;
}

export function getLastUserSelectionReferences(history: Content[]): SelectionReference[] | undefined {
    for (let i = history.length - 1; i >= 0; i--) {
        const msg = history[i];
        if (!msg || msg.role !== 'user') continue;
        if ((msg as any).isFunctionResponse === true) continue;
        if ((msg as any).isSummary === true) continue;
        const refs = (msg as any).selectionReferences;
        return Array.isArray(refs) ? (refs as SelectionReference[]) : undefined;
    }
    return undefined;
}

export function getLastUserTaskContext(history: Content[]): string | undefined {
    for (let i = history.length - 1; i >= 0; i--) {
        const msg = history[i];
        if (!msg || msg.role !== 'user') continue;
        if ((msg as any).isFunctionResponse === true) continue;
        if ((msg as any).isSummary === true) continue;
        const ctx = (msg as any).taskContext;
        if (typeof ctx !== 'string') return undefined;
        const trimmed = ctx.trim();
        return trimmed ? trimmed : undefined;
    }
    return undefined;
}

export function getLastUserOpenFileContext(history: Content[]): string | undefined {
    for (let i = history.length - 1; i >= 0; i--) {
        const msg = history[i];
        if (!msg || msg.role !== 'user') continue;
        if ((msg as any).isFunctionResponse === true) continue;
        if ((msg as any).isSummary === true) continue;
        const ctx = (msg as any).openFileContext;
        if (typeof ctx !== 'string') return undefined;
        const trimmed = ctx.trim();
        return trimmed ? trimmed : undefined;
    }
    return undefined;
}

export function identifyConversationRounds(history: Content[]): ConversationRound[] {
    const rounds: ConversationRound[] = [];
    let currentRoundStart = -1;
    let currentRoundTokenCount: number | undefined;

    for (let i = 0; i < history.length; i++) {
        const message = history[i];

        if (isConversationRoundStart(message)) {
            if (currentRoundStart !== -1) {
                rounds.push({
                    startIndex: currentRoundStart,
                    endIndex: i,
                    tokenCount: currentRoundTokenCount
                });
            }

            currentRoundStart = i;
            currentRoundTokenCount = undefined;
        } else if (message.role === 'model') {
            if (message.usageMetadata?.totalTokenCount !== undefined) {
                currentRoundTokenCount = message.usageMetadata.totalTokenCount;
            }
        }
    }

    if (currentRoundStart !== -1) {
        rounds.push({
            startIndex: currentRoundStart,
            endIndex: history.length,
            tokenCount: currentRoundTokenCount
        });
    }

    return rounds;
}

export function isConversationRoundStart(message: Content): boolean {
    return message.role === 'user' && !message.isFunctionResponse && !message.isSummary;
}

export function calculateThreshold(threshold: number | string, maxContextTokens: number): number {
    if (typeof threshold === 'number') {
        return threshold;
    }

    if (threshold.endsWith('%')) {
        const percent = parseFloat(threshold.replace('%', ''));
        if (!isNaN(percent) && percent > 0 && percent <= 100) {
            return Math.floor((maxContextTokens * percent) / 100);
        }
    }

    return Math.floor(maxContextTokens * 0.8);
}

export function findLastSummaryIndex(history: Content[]): number {
    for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].isSummary) {
            return i;
        }
    }
    return -1;
}

export async function performContextTrim(
    conversationManager: ConversationManager,
    conversationId: string,
    config: BaseChannelConfig,
    historyOptions: GetHistoryOptions,
    effectiveStartIndex: number,
    estimatedTotalTokens: number,
    systemPromptTokens: number,
    roundsAfterStart: RoundTokenInfo[],
    threshold: number,
    maxContextTokens: number
): Promise<ContextTrimInfo> {
    if (roundsAfterStart.length <= 1) {
        const history = await conversationManager.getHistoryForAPI(conversationId, {
            ...historyOptions,
            startIndex: effectiveStartIndex
        });
        return { history, trimStartIndex: effectiveStartIndex };
    }

    const extraCutConfig = config.contextTrimExtraCut ?? 0;
    const extraCut = calculateThreshold(extraCutConfig, maxContextTokens);

    const targetTokens = Math.max(0, threshold - extraCut);

    let roundsToSkip = 0;
    for (let k = 1; k < roundsAfterStart.length; k++) {
        const skippedTokens = roundsAfterStart[k - 1].cumulativeTokens - systemPromptTokens;
        const remainingTokens = estimatedTotalTokens - skippedTokens;

        if (remainingTokens <= targetTokens) {
            roundsToSkip = k;
            break;
        }
    }

    if (roundsToSkip === 0 && estimatedTotalTokens > targetTokens) {
        roundsToSkip = roundsAfterStart.length - 1;
    }

    if (roundsToSkip === 0) {
        const history = await conversationManager.getHistoryForAPI(conversationId, {
            ...historyOptions,
            startIndex: effectiveStartIndex
        });
        return { history, trimStartIndex: effectiveStartIndex };
    }

    const trimStartIndex = roundsAfterStart[roundsToSkip].startIndex;
    let trimmedHistory = await conversationManager.getHistoryForAPI(conversationId, {
        ...historyOptions,
        startIndex: trimStartIndex
    });
    let finalTrimStartIndex = trimStartIndex;

    if (trimmedHistory.length > 0 && trimmedHistory[0].role !== 'user') {
        const firstUserIndex = trimmedHistory.findIndex((m) => m.role === 'user');
        if (firstUserIndex > 0) {
            trimmedHistory = trimmedHistory.slice(firstUserIndex);
            finalTrimStartIndex = trimStartIndex + firstUserIndex;
        }
    }

    return { history: trimmedHistory, trimStartIndex: finalTrimStartIndex };
}
