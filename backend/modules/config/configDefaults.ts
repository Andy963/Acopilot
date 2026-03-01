import type { ChannelType } from './types';

export function getDefaultConfig(type: ChannelType): Record<string, any> {
  const baseDefaults = {
    enabled: true,
    timeout: 120000,
    model: '',
    models: [],
    apiKey: '',
    toolMode: 'function_call' as const,
    retryEnabled: true,
    retryCount: 3,
    retryInterval: 3000,
    contextThresholdEnabled: false,
    contextThreshold: '80%',
    autoSummarizeEnabled: false,
    multimodalToolsEnabled: false,
    customHeadersEnabled: false,
    customHeaders: [],
    customBodyEnabled: false,
    customBody: { mode: 'simple' as const, items: [] },
    sendHistoryThoughts: false,
    sendHistoryThoughtSignatures: false,
    options: {
      stream: true
    }
  };

  switch (type) {
    case 'gemini':
      return {
        ...baseDefaults,
        url: 'https://generativelanguage.googleapis.com/v1beta',
        options: {
          ...baseDefaults.options,
          temperature: 1.0,
          maxOutputTokens: 65536,
          thinkingConfig: {
            includeThoughts: true,
            mode: 'default',
            thinkingLevel: 'low',
            thinkingBudget: 1024
          }
        },
        optionsEnabled: {
          temperature: false,
          maxOutputTokens: false,
          thinkingConfig: true
        }
      };

    case 'openai':
      return {
        ...baseDefaults,
        url: 'https://api.openai.com/v1',
        options: {
          ...baseDefaults.options,
          temperature: 1.0,
          max_tokens: 16384,
          reasoning: {
            effort: 'high',
            summaryEnabled: false,
            summary: 'auto'
          }
        },
        optionsEnabled: {
          temperature: false,
          max_tokens: false,
          top_p: false,
          frequency_penalty: false,
          presence_penalty: false,
          reasoning: false
        }
      };

    case 'anthropic':
      return {
        ...baseDefaults,
        url: 'https://api.anthropic.com/v1',
        options: {
          ...baseDefaults.options,
          temperature: 1.0,
          max_tokens: 8192,
          thinking: {
            type: 'enabled',
            budget_tokens: 10000
          }
        },
        optionsEnabled: {
          temperature: false,
          max_tokens: false,
          top_p: false,
          top_k: false,
          thinking: false
        }
      };

    case 'openai-responses':
      return {
        ...baseDefaults,
        url: 'https://api.openai.com/v1',
        options: {
          ...baseDefaults.options,
          temperature: 1.0,
          max_output_tokens: 16384,
          truncation: 'auto',
          reasoning: {
            effort: 'medium',
            summaryEnabled: false,
            summary: 'auto'
          }
        },
        optionsEnabled: {
          temperature: false,
          max_output_tokens: false,
          top_p: false,
          reasoning: false
        }
      };

    default:
      return baseDefaults;
  }
}

