import type { OpenAIConfig } from '../../../config/types';

export function buildOpenAIGenerationConfig(config: OpenAIConfig, options?: any): any {
  const genConfig: any = {};
  const optionsEnabled = (config as any).optionsEnabled || {};

  const temperature = options?.temperature ?? config.options?.temperature;
  const maxTokens = options?.maxTokens ?? config.options?.max_tokens;
  const topP = options?.topP ?? config.options?.top_p;
  const frequencyPenalty = options?.frequencyPenalty ?? config.options?.frequency_penalty;
  const presencePenalty = options?.presencePenalty ?? config.options?.presence_penalty;
  const stop = options?.stopSequences ?? config.options?.stop;
  const n = options?.candidateCount ?? config.options?.n;

  if (optionsEnabled.temperature && temperature !== undefined) {
    genConfig.temperature = temperature;
  }

  if (optionsEnabled.max_tokens && maxTokens !== undefined) {
    genConfig.max_tokens = maxTokens;
  }

  if (optionsEnabled.top_p && topP !== undefined) {
    genConfig.top_p = topP;
  }

  if (optionsEnabled.frequency_penalty && frequencyPenalty !== undefined) {
    genConfig.frequency_penalty = frequencyPenalty;
  }

  if (optionsEnabled.presence_penalty && presencePenalty !== undefined) {
    genConfig.presence_penalty = presencePenalty;
  }

  if (stop && stop.length > 0) {
    genConfig.stop = stop;
  }

  if (n !== undefined) {
    genConfig.n = n;
  }

  const reasoningEnabled = (config as any).optionsEnabled?.reasoning;
  const reasoning = config.options?.reasoning;

  if (reasoningEnabled && reasoning) {
    const reasoningConfig: any = {};

    if (reasoning.effort && reasoning.effort !== 'none') {
      reasoningConfig.effort = reasoning.effort;
    }

    if (reasoning.summaryEnabled && reasoning.summary) {
      reasoningConfig.summary = reasoning.summary;
    }

    if (Object.keys(reasoningConfig).length > 0) {
      genConfig.reasoning = reasoningConfig;
    }
  }

  return genConfig;
}

