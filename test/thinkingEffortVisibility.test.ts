import { describe, expect, it } from 'vitest';

import {
  isOpenAIProtocolConfigType,
  isThinkingEffort,
  isThinkingEffortVisibleForModel,
  THINKING_EFFORT_OPTIONS,
} from '../frontend/src/utils/thinking';

describe('thinking utils', () => {
  it('recognizes supported effort values', () => {
    for (const value of THINKING_EFFORT_OPTIONS) {
      expect(isThinkingEffort(value)).toBe(true);
    }
    expect(isThinkingEffort('none')).toBe(false);
    expect(isThinkingEffort('minimal')).toBe(false);
    expect(isThinkingEffort('')).toBe(false);
    expect(isThinkingEffort(null)).toBe(false);
  });

  it('recognizes OpenAI protocol config types', () => {
    expect(isOpenAIProtocolConfigType('openai')).toBe(true);
    expect(isOpenAIProtocolConfigType('openai-responses')).toBe(true);
    expect(isOpenAIProtocolConfigType('gemini')).toBe(false);
    expect(isOpenAIProtocolConfigType('anthropic')).toBe(false);
    expect(isOpenAIProtocolConfigType(undefined)).toBe(false);
  });

  it('shows thinking effort only for OpenAI protocol + gpt models', () => {
    expect(
      isThinkingEffortVisibleForModel({ configType: 'openai', modelId: 'gpt-4o' })
    ).toBe(true);

    expect(
      isThinkingEffortVisibleForModel({
        configType: 'openai',
        modelId: 'anything',
        modelName: 'GPT-4o',
      })
    ).toBe(true);

    expect(
      isThinkingEffortVisibleForModel({
        configType: 'openai-responses',
        modelId: 'gpt-4.1',
      })
    ).toBe(true);

    expect(
      isThinkingEffortVisibleForModel({
        configType: 'openai',
        modelId: 'deepseek-r1',
      })
    ).toBe(false);

    expect(
      isThinkingEffortVisibleForModel({
        configType: 'gemini',
        modelId: 'gpt-4o',
      })
    ).toBe(false);
  });
});

