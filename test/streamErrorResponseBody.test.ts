import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({}));

import type { HttpRequestOptions } from '../backend/modules/channel/types';
import { ChannelError, ErrorType } from '../backend/modules/channel/types';
import { ChannelManagerHttp } from '../backend/modules/channel/channelManager/http';
import { proxyStreamFetch } from '../backend/modules/channel/proxyFetch/streamFetch';

class TestChannelManagerHttp extends ChannelManagerHttp {
  constructor() {
    super({} as any);
  }

  streamRequest(options: HttpRequestOptions) {
    return this.executeStreamRequest(options);
  }

  protected override getProxyUrl(): string | undefined {
    return undefined;
  }
}

describe('stream error response body parsing', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    (globalThis as any).fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('ChannelManagerHttp throws API_ERROR with text body when upstream error is non-JSON', async () => {
    (globalThis as any).fetch = vi.fn(async () => {
      return new Response('not-json', {
        status: 500,
        headers: { 'content-type': 'text/plain' },
      });
    });

    const manager = new TestChannelManagerHttp();
    const gen = manager.streamRequest({
      url: 'https://example.com/v1/stream',
      method: 'POST',
      headers: {},
      body: { test: true },
    });

    let thrown: unknown;
    try {
      await gen.next();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ChannelError);
    expect((thrown as ChannelError).type).toBe(ErrorType.API_ERROR);
    expect((thrown as ChannelError).details?.body).toBe('not-json');
  });

  it('proxyStreamFetch throws API_ERROR with text body when upstream error is non-JSON', async () => {
    (globalThis as any).fetch = vi.fn(async () => {
      return new Response('not-json', {
        status: 400,
        headers: { 'content-type': 'text/plain' },
      });
    });

    const gen = proxyStreamFetch('https://example.com/v1/stream', {
      method: 'POST',
      headers: {},
      body: JSON.stringify({ test: true }),
    });

    let thrown: unknown;
    try {
      await gen.next();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ChannelError);
    expect((thrown as ChannelError).type).toBe(ErrorType.API_ERROR);
    expect((thrown as ChannelError).details?.body).toBe('not-json');
  });
});
