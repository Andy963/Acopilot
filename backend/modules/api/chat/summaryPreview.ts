import type { Content } from '../../conversation/types';

export interface SummaryPreview {
    preview: string;
    charCount: number;
    truncated: boolean;
    summarizedMessageCount?: number;
    keptRecentRounds?: number;
    generatedAt?: number;
}

const SUMMARY_TITLE_RE = /^\[(?:Conversation Summary|对话总结|会話要約)\]\s*/;
const AUTHORITY_NOTICE_RE = /^Historical conversation summary\.[\s\S]*?latest user request\.\s*/;

export function buildSummaryPreview(summary: Content | undefined, maxChars = 2000): SummaryPreview | undefined {
    if (!summary?.isSummary) return undefined;

    const text = (summary.parts || [])
        .filter(part => part.text && !part.thought)
        .map(part => part.text)
        .join('\n')
        .replace(AUTHORITY_NOTICE_RE, '')
        .replace(SUMMARY_TITLE_RE, '')
        .trim();

    if (!text) return undefined;

    const truncated = text.length > maxChars;
    return {
        preview: truncated ? text.slice(0, maxChars) : text,
        charCount: text.length,
        truncated,
        summarizedMessageCount: summary.summarizedMessageCount,
        keptRecentRounds: summary.summaryKeptRecentRounds,
        generatedAt: summary.summaryGeneratedAt ?? summary.timestamp,
    };
}
