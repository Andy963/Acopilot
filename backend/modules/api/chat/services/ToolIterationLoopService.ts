import type { ChannelManager } from '../../../channel/ChannelManager';
import type { ConversationManager } from '../../../conversation/ConversationManager';
import type { BaseChannelConfig } from '../../../config/configs/base';
import { PromptManager } from '../../../prompt';
import type { SettingsManager } from '../../../settings/SettingsManager';

import type { ChatStreamCheckpointsData } from '../types';
import type { ToolCallParserService } from './ToolCallParserService';
import type { MessageBuilderService } from './MessageBuilderService';
import type { TokenEstimationService } from './TokenEstimationService';
import type { ContextTrimService } from './ContextTrimService';
import type { ToolExecutionService } from './ToolExecutionService';
import type { SummarizeService } from './SummarizeService';
import type { CheckpointService } from './CheckpointService';

import { runToolLoop } from './toolIterationLoop/runToolLoop';
import { runNonStreamLoop } from './toolIterationLoop/runNonStreamLoop';
import type { ToolIterationLoopDeps } from './toolIterationLoop/deps';
import type { ToolIterationLoopConfig, ToolIterationLoopOutput, NonStreamToolLoopResult } from './toolIterationLoop/types';
export type { ToolIterationLoopConfig, ToolIterationLoopOutput, NonStreamToolLoopResult } from './toolIterationLoop/types';

import {
    AUTO_SUMMARIZE_STATE_KEY,
    OPENAI_RESPONSES_CONTINUATION_KEY,
    OPENAI_RESPONSES_PROMPT_CACHE_STATE_KEY,
    createOpenAIResponsesPromptCacheKey,
    type AutoSummarizeState,
    type OpenAIResponsesPromptCacheState
} from './toolIterationLoop/helpers';

import { LOCATE_CARRYOVER_METADATA_KEY, parseLocateCarryoverState, withOpenedFile } from './locateCarryover';

export class ToolIterationLoopService {
    private promptManager: PromptManager;
    private settingsManager?: SettingsManager;

    constructor(
        private channelManager: ChannelManager,
        private conversationManager: ConversationManager,
        private toolCallParserService: ToolCallParserService,
        private messageBuilderService: MessageBuilderService,
        private tokenEstimationService: TokenEstimationService,
        private contextTrimService: ContextTrimService,
        private toolExecutionService: ToolExecutionService,
        private summarizeService: SummarizeService,
        private checkpointService: CheckpointService
    ) {
        this.promptManager = new PromptManager();
    }

    setPromptManager(promptManager: PromptManager): void {
        this.promptManager = promptManager;
    }

    setSettingsManager(settingsManager: SettingsManager): void {
        this.settingsManager = settingsManager;
    }

    runToolLoop(loopConfig: ToolIterationLoopConfig): AsyncGenerator<ToolIterationLoopOutput> {
        return runToolLoop(this.createDeps(), loopConfig);
    }

    runNonStreamLoop(
        conversationId: string,
        configId: string,
        config: BaseChannelConfig,
        maxIterations: number
    ): Promise<NonStreamToolLoopResult> {
        return runNonStreamLoop(this.createDeps(), conversationId, configId, config, maxIterations);
    }

    private createDeps(): ToolIterationLoopDeps {
        return {
            channelManager: this.channelManager,
            conversationManager: this.conversationManager,
            toolCallParserService: this.toolCallParserService,
            messageBuilderService: this.messageBuilderService,
            tokenEstimationService: this.tokenEstimationService,
            contextTrimService: this.contextTrimService,
            toolExecutionService: this.toolExecutionService,
            summarizeService: this.summarizeService,
            checkpointService: this.checkpointService,
            promptManager: this.promptManager,
            settingsManager: this.settingsManager,
            delay: this.delay.bind(this),
            maybeAutoSummarizeIfNeeded: this.maybeAutoSummarizeIfNeeded.bind(this),
            resetOpenAIResponsesContinuationState: this.resetOpenAIResponsesContinuationState.bind(this),
            updateLocateCarryoverFromOpenFileCalls: this.updateLocateCarryoverFromOpenFileCalls.bind(this),
            createBeforeModelCheckpoint: this.createBeforeModelCheckpoint.bind(this),
        };
    }

    private delay(ms: number, signal?: AbortSignal): Promise<void> {
        if (ms <= 0) return Promise.resolve();

        return new Promise((resolve) => {
            if (signal?.aborted) {
                resolve();
                return;
            }

            let done = false;

            const finish = () => {
                if (done) return;
                done = true;

                clearTimeout(timeoutId);
                if (signal) {
                    signal.removeEventListener('abort', onAbort);
                }
                resolve();
            };

            const onAbort = () => finish();
            const timeoutId = setTimeout(finish, ms);

            if (signal) {
                signal.addEventListener('abort', onAbort);
            }
        });
    }

    private static normalizePositiveInt(value: unknown): number | undefined {
        if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
        const n = Math.trunc(value);
        return n > 0 ? n : undefined;
    }

    private async updateLocateCarryoverFromOpenFileCalls(
        conversationId: string,
        enabled: boolean,
        calls: Array<{ name: string; args: Record<string, unknown> }>
    ): Promise<void> {
        if (!enabled) return;

        const openFileCalls = calls.filter((c) => c?.name === 'open_file');
        if (openFileCalls.length === 0) return;

        const last = openFileCalls[openFileCalls.length - 1];
        const rawPath = typeof (last.args as any)?.path === 'string' ? String((last.args as any).path) : '';
        const path = rawPath.trim();
        if (!path) return;

        const openedFile = {
            path,
            startLine: ToolIterationLoopService.normalizePositiveInt((last.args as any)?.start_line),
            startColumn: ToolIterationLoopService.normalizePositiveInt((last.args as any)?.start_column),
            endLine: ToolIterationLoopService.normalizePositiveInt((last.args as any)?.end_line),
            endColumn: ToolIterationLoopService.normalizePositiveInt((last.args as any)?.end_column),
        };

        const existing = parseLocateCarryoverState(
            await this.conversationManager.getCustomMetadata(conversationId, LOCATE_CARRYOVER_METADATA_KEY)
        );
        if (!existing) return;

        await this.conversationManager.setCustomMetadata(
            conversationId,
            LOCATE_CARRYOVER_METADATA_KEY,
            withOpenedFile(existing, openedFile)
        );
    }

    private static parseAutoSummarizeState(value: unknown): AutoSummarizeState | null {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
        const v = value as any;
        if (typeof v.lastAt !== 'number' || !Number.isFinite(v.lastAt)) return null;
        if (typeof v.lastHistoryLength !== 'number' || !Number.isFinite(v.lastHistoryLength)) return null;
        return { lastAt: v.lastAt, lastHistoryLength: v.lastHistoryLength };
    }

    async resetOpenAIResponsesContinuationState(conversationId: string, configId: string): Promise<void> {
        await this.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_CONTINUATION_KEY, null);
        const promptCacheKey = createOpenAIResponsesPromptCacheKey(conversationId, configId);
        const nextState: OpenAIResponsesPromptCacheState = { configId, promptCacheKey };
        await this.conversationManager.setCustomMetadata(conversationId, OPENAI_RESPONSES_PROMPT_CACHE_STATE_KEY, nextState);
    }

    private async maybeAutoSummarizeIfNeeded(opts: {
        conversationId: string;
        configId: string;
        config: BaseChannelConfig;
        abortSignal?: AbortSignal;
        isLocateMode: boolean;
        estimatedTotalTokens?: number;
        maxContextTokens?: number;
        fullHistoryLength: number;
    }): Promise<boolean> {
        if (!this.settingsManager) return false;
        if (opts.isLocateMode) return false;
        if (opts.abortSignal?.aborted) return false;
        if (typeof opts.estimatedTotalTokens !== 'number' || !Number.isFinite(opts.estimatedTotalTokens)) return false;

        const summarizeConfig = this.settingsManager.getSummarizeConfig();
        if (!summarizeConfig?.autoSummarize) return false;

        const rawPct = typeof summarizeConfig.autoSummarizeThreshold === 'number' ? summarizeConfig.autoSummarizeThreshold : 80;
        const pct = Math.max(1, Math.min(100, Math.floor(rawPct)));
        const maxTokens =
            typeof opts.maxContextTokens === 'number' && Number.isFinite(opts.maxContextTokens)
                ? opts.maxContextTokens
                : ((opts.config as any).maxContextTokens ?? 128000);
        const thresholdTokens = Math.floor(maxTokens * pct / 100);

        if (opts.estimatedTotalTokens < thresholdTokens) return false;

        const now = Date.now();
        const previousState = ToolIterationLoopService.parseAutoSummarizeState(
            await this.conversationManager.getCustomMetadata(opts.conversationId, AUTO_SUMMARIZE_STATE_KEY)
        );

        if (previousState) {
            if (now - previousState.lastAt < 30_000) return false;
            if (previousState.lastHistoryLength === opts.fullHistoryLength) return false;
        }

        const result = await this.summarizeService.handleSummarizeContext({
            conversationId: opts.conversationId,
            configId: opts.configId,
            abortSignal: opts.abortSignal
        });

        if (!result.success) return false;

        if (opts.config.type === 'openai-responses') {
            await this.resetOpenAIResponsesContinuationState(opts.conversationId, opts.configId);
        }

        const nextHistory = await this.conversationManager.getHistoryRef(opts.conversationId);
        await this.conversationManager.setCustomMetadata(opts.conversationId, AUTO_SUMMARIZE_STATE_KEY, {
            lastAt: now,
            lastHistoryLength: nextHistory.length
        } satisfies AutoSummarizeState);

        return true;
    }

    private async createBeforeModelCheckpoint(
        conversationId: string,
        iteration: number
    ): Promise<ChatStreamCheckpointsData | null> {
        const checkpoint = await this.checkpointService.createModelMessageCheckpoint(
            conversationId,
            'before',
            iteration
        );
        if (!checkpoint) {
            return null;
        }

        return {
            conversationId,
            checkpoints: [checkpoint],
            checkpointOnly: true as const
        };
    }
}

