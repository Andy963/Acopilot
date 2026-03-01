import type { AnthropicConfig } from '../../../config/types';

export function buildAnthropicGenerationConfig(config: AnthropicConfig): any {
  const genConfig: any = {};
  const optionsEnabled = (config as any).optionsEnabled || {};

  // Anthropic Messages API requires max_tokens.
  // Keep behavior for optional fields behind optionsEnabled, but always send max_tokens
  // with a safe fallback to avoid invalid requests.
  {
    const configured = (config as any)?.options?.max_tokens;
    const fallback = 8192;
    const rawValue = typeof configured === 'number' ? configured : fallback;
    const maxTokens = Number.isFinite(rawValue) && rawValue > 0 ? Math.floor(rawValue) : fallback;
    genConfig.max_tokens = maxTokens;
  }

  if (optionsEnabled.max_tokens && config.options?.max_tokens !== undefined) {
    genConfig.max_tokens = config.options.max_tokens;
  }

  if (optionsEnabled.temperature && config.options?.temperature !== undefined) {
    genConfig.temperature = config.options.temperature;
  }

  if (optionsEnabled.top_p && config.options?.top_p !== undefined) {
    genConfig.top_p = config.options.top_p;
  }

  if (optionsEnabled.top_k && config.options?.top_k !== undefined) {
    genConfig.top_k = config.options.top_k;
  }

  if (config.options?.stop_sequences && config.options.stop_sequences.length > 0) {
    genConfig.stop_sequences = config.options.stop_sequences;
  }

  const thinkingEnabled = optionsEnabled.thinking;
  const thinking = config.options?.thinking;

  if (thinkingEnabled && thinking) {
    const thinkingConfig: any = {
      type: 'enabled',
    };

    if (thinking.budget_tokens && thinking.budget_tokens > 0) {
      thinkingConfig.budget_tokens = thinking.budget_tokens;
    } else {
      thinkingConfig.budget_tokens = 10000;
    }

    genConfig.thinking = thinkingConfig;
  }

  return genConfig;
}
