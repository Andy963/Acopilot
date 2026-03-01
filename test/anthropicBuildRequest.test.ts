import { describe, expect, it } from 'vitest';

import type { Content } from '../backend/modules/conversation/types';
import type { GenerateRequest } from '../backend/modules/channel/types';
import type { AnthropicConfig } from '../backend/modules/config/types';
import { buildAnthropicRequest } from '../backend/modules/channel/formatters/anthropic/buildRequest';

function makeHistory(text: string): Content[] {
  return [{ role: 'user', parts: [{ text }] }];
}

function makeConfig(overrides: Partial<AnthropicConfig> = {}): AnthropicConfig {
  return {
    id: 'cfg-1',
    name: 'Anthropic',
    type: 'anthropic',
    enabled: true,
    createdAt: 1,
    updatedAt: 1,
    url: 'https://api.anthropic.com/v1',
    apiKey: 'test-api-key',
    model: 'claude-3-5-sonnet-latest',
    timeout: 120000,
    options: { stream: true },
    ...overrides,
  } as AnthropicConfig;
}

describe('buildAnthropicRequest', () => {
  it('appends /messages when url is base /v1', () => {
    const request: GenerateRequest = {
      configId: 'cfg-1',
      history: makeHistory('hi'),
      streamOverride: true,
    };

    const http = buildAnthropicRequest(request, makeConfig(), undefined);
    expect(http.url).toBe('https://api.anthropic.com/v1/messages');
    expect(http.headers.Accept).toBe('text/event-stream');
  });

  it('does not double-append /messages when url already ends with /messages', () => {
    const request: GenerateRequest = {
      configId: 'cfg-1',
      history: makeHistory('hi'),
      streamOverride: true,
    };

    const http = buildAnthropicRequest(
      request,
      makeConfig({ url: 'https://api.anthropic.com/v1/messages' }),
      undefined
    );

    expect(http.url).toBe('https://api.anthropic.com/v1/messages');
  });

  it('always includes max_tokens with a default fallback', () => {
    const request: GenerateRequest = {
      configId: 'cfg-1',
      history: makeHistory('hi'),
      streamOverride: true,
    };

    const http = buildAnthropicRequest(request, makeConfig({ options: { stream: true } }), undefined);
    expect(typeof http.body.max_tokens).toBe('number');
    expect(http.body.max_tokens).toBeGreaterThan(0);
  });

  it('uses configured max_tokens when provided', () => {
    const request: GenerateRequest = {
      configId: 'cfg-1',
      history: makeHistory('hi'),
      streamOverride: true,
    };

    const http = buildAnthropicRequest(
      request,
      makeConfig({ options: { stream: true, max_tokens: 1234 } as any }),
      undefined
    );

    expect(http.body.max_tokens).toBe(1234);
  });
});

