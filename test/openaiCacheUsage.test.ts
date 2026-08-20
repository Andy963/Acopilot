import { describe, expect, it } from 'vitest';
import { parseOpenAIResponse } from '../backend/modules/channel/formatters/openai/parseResponse';
import { parseOpenAIStreamChunk } from '../backend/modules/channel/formatters/openai/parseStreamChunk';

describe('OpenAI cache usage parsing', () => {
  const usage = {
    prompt_tokens: 1200,
    prompt_tokens_details: { cached_tokens: 960 },
    completion_tokens: 80,
    total_tokens: 1280,
  };

  it('preserves cached input tokens from a non-stream response', () => {
    const result = parseOpenAIResponse({
      model: 'openrouter/test',
      choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
      usage,
    });

    expect(result.content.usageMetadata).toMatchObject({
      promptTokenCount: 1200,
      cachedPromptTokenCount: 960,
      totalTokenCount: 1280,
    });
  });

  it('preserves cached input tokens from the final stream chunk', () => {
    const result = parseOpenAIStreamChunk({
      model: 'openrouter/test',
      choices: [{ delta: {}, finish_reason: 'stop' }],
      usage,
    });

    expect(result.usage).toMatchObject({
      promptTokenCount: 1200,
      cachedPromptTokenCount: 960,
      totalTokenCount: 1280,
    });
  });
});
