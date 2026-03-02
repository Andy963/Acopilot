import { describe, expect, it } from 'vitest';

import { buildOpenAIRequest } from '../backend/modules/channel/formatters/openai/buildRequest';
import { OpenAIResponsesFormatter } from '../backend/modules/channel/formatters/openai-responses';

describe('OpenAI auth header normalization', () => {
  const request = {
    history: [{ role: 'user', parts: [{ text: 'hi' }] }],
  } as any;

  it('strips Bearer prefix from apiKey (chat.completions)', () => {
    const config = {
      url: 'https://example.com/v1',
      model: 'gpt-test',
      apiKey: 'Bearer test-key',
      customHeadersEnabled: false,
    } as any;

    const req = buildOpenAIRequest(request, config);
    expect(req.headers.Authorization).toBe('Bearer test-key');
  });

  it('does not let empty custom Authorization override apiKey (chat.completions)', () => {
    const config = {
      url: 'https://example.com/v1',
      model: 'gpt-test',
      apiKey: 'test-key',
      customHeadersEnabled: true,
      customHeaders: [{ enabled: true, key: 'Authorization', value: '' }],
    } as any;

    const req = buildOpenAIRequest(request, config);
    expect(req.headers.Authorization).toBe('Bearer test-key');
  });

  it('keeps non-empty custom Authorization as-is (chat.completions)', () => {
    const config = {
      url: 'https://example.com/v1',
      model: 'gpt-test',
      apiKey: 'test-key',
      customHeadersEnabled: true,
      customHeaders: [{ enabled: true, key: 'Authorization', value: 'Token custom' }],
    } as any;

    const req = buildOpenAIRequest(request, config);
    expect(req.headers.Authorization).toBe('Token custom');
  });

  it('does not let empty custom Authorization override apiKey (responses)', () => {
    const formatter = new OpenAIResponsesFormatter();
    const config = {
      url: 'https://example.com/v1',
      model: 'gpt-test',
      apiKey: 'test-key',
      customHeadersEnabled: true,
      customHeaders: [{ enabled: true, key: 'authorization', value: '' }],
      options: { stream: false },
    } as any;

    const req = formatter.buildRequest(request, config);
    expect(req.headers.Authorization).toBe('Bearer test-key');
  });
});

