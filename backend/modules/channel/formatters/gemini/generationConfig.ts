import type { GeminiConfig } from '../../../config/types';

export function buildGeminiGenerationConfig(config: GeminiConfig): any {
  const genConfig: any = {};

  const { options, optionsEnabled } = config;
  if (!options) {
    return genConfig;
  }

  if (!optionsEnabled) {
    return genConfig;
  }

  if (optionsEnabled.temperature && options.temperature !== undefined) {
    genConfig.temperature = options.temperature;
  }

  if (optionsEnabled.maxOutputTokens && options.maxOutputTokens !== undefined) {
    genConfig.maxOutputTokens = options.maxOutputTokens;
  }

  const thinkingEnabled = optionsEnabled.thinkingConfig !== false;
  if (thinkingEnabled) {
    const thinkingConfig = options.thinkingConfig || {};
    const apiThinkingConfig: any = {};

    const includeThoughts = thinkingConfig.includeThoughts !== false;
    if (includeThoughts) {
      apiThinkingConfig.includeThoughts = true;
    }

    const mode = thinkingConfig.mode || 'default';
    if (mode === 'level' && thinkingConfig.thinkingLevel) {
      apiThinkingConfig.thinkingLevel = thinkingConfig.thinkingLevel;
    } else if (mode === 'budget' && thinkingConfig.thinkingBudget !== undefined) {
      apiThinkingConfig.thinkingBudget = thinkingConfig.thinkingBudget;
    }

    if (Object.keys(apiThinkingConfig).length > 0) {
      genConfig.thinkingConfig = apiThinkingConfig;
    }
  }

  return genConfig;
}

