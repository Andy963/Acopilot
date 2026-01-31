export interface SummarizeConfig {
    autoSummarize: boolean;
    autoSummarizeThreshold: number;
    summarizePrompt: string;
    keepRecentRounds: number;
    useSeparateModel: boolean;
    summarizeChannelId: string;
    summarizeModelId: string;
    [key: string]: unknown;
}

export const DEFAULT_SUMMARIZE_CONFIG: SummarizeConfig = {
    autoSummarize: false,
    autoSummarizeThreshold: 80,
    summarizePrompt: 'Please summarize the above conversation, keeping key information and context points while removing redundant content.',
    keepRecentRounds: 2,
    useSeparateModel: false,
    summarizeChannelId: '',
    summarizeModelId: ''
};

