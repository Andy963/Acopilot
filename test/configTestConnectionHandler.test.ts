import { describe, expect, it, vi } from 'vitest'

import { testConnection } from '../webview/handlers/ConfigHandlers'

function createContext(overrides: Partial<any> = {}) {
  return {
    configManager: {
      getConfig: vi.fn(async () => ({
        id: 'cfg-1',
        name: 'Test',
        type: 'openai',
        enabled: true,
        url: 'https://example.com/v1/chat/completions',
        apiKey: 'key',
        model: 'model',
      })),
      validateConfig: vi.fn(async () => ({ valid: true })),
    },
    channelManager: {
      generate: vi.fn(async () => ({
        content: { role: 'model', parts: [{ text: 'OK' }] },
      })),
    },
    sendResponse: vi.fn(),
    sendError: vi.fn(),
    ...overrides,
  }
}

describe('config.testConnection handler', () => {
  it('sends a minimal no-tools no-retry request and reports success', async () => {
    const ctx = createContext()

    await testConnection({ configId: 'cfg-1' }, 'req-1', ctx as any)

    expect(ctx.channelManager.generate).toHaveBeenCalledWith(expect.objectContaining({
      configId: 'cfg-1',
      skipTools: true,
      skipRetry: true,
      history: [{ role: 'user', parts: [{ text: 'Reply with exactly: OK' }] }],
    }))
    expect(ctx.sendResponse).toHaveBeenCalledWith('req-1', expect.objectContaining({
      ok: true,
      message: 'Connection test succeeded',
    }))
    expect(ctx.sendError).not.toHaveBeenCalled()
  })

  it('consumes stream responses before reporting success', async () => {
    async function* stream() {
      yield { delta: [{ text: 'O' }], done: false }
      yield { delta: [{ text: 'K' }], done: true }
    }
    const ctx = createContext({
      channelManager: {
        generate: vi.fn(async () => stream()),
      },
    })

    await testConnection({ configId: 'cfg-1' }, 'req-1', ctx as any)

    expect(ctx.sendResponse).toHaveBeenCalledWith('req-1', expect.objectContaining({ ok: true }))
  })

  it('returns validation errors without calling the channel', async () => {
    const ctx = createContext({
      configManager: {
        getConfig: vi.fn(async () => ({ id: 'cfg-1' })),
        validateConfig: vi.fn(async () => ({ valid: false, errors: ['missing api key'] })),
      },
    })

    await testConnection({ configId: 'cfg-1' }, 'req-1', ctx as any)

    expect(ctx.channelManager.generate).not.toHaveBeenCalled()
    expect(ctx.sendResponse).toHaveBeenCalledWith('req-1', expect.objectContaining({
      ok: false,
      message: 'missing api key',
    }))
  })

  it('returns redacted connection errors as a non-throwing result', async () => {
    const ctx = createContext({
      channelManager: {
        generate: vi.fn(async () => {
          throw new Error('401 unauthorized Bearer local-test-token')
        }),
      },
    })

    await testConnection({ configId: 'cfg-1' }, 'req-1', ctx as any)

    expect(ctx.sendResponse).toHaveBeenCalledWith('req-1', expect.objectContaining({
      ok: false,
      message: '401 unauthorized Bearer ***REDACTED***',
    }))
  })
})
