import type { AnthropicConfig } from '../../../config/types';

export function buildAnthropicGenerationConfig(config: AnthropicConfig): any {
  const genConfig: any = {};
  const optionsEnabled = (config as any).optionsEnabled || {};

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

