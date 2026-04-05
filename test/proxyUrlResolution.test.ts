import { describe, expect, it } from 'vitest'

import {
  normalizeProxyUrl,
  resolveProxyUrl,
} from '../backend/modules/channel/proxyFetch/resolveProxyUrl'

describe('proxy URL resolution', () => {
  it('accepts http and https proxy URLs', () => {
    expect(normalizeProxyUrl('http://127.0.0.1:7890')).toBe('http://127.0.0.1:7890/')
    expect(normalizeProxyUrl('https://proxy.example.com:8443')).toBe('https://proxy.example.com:8443/')
  })

  it('rejects unsupported proxy protocols', () => {
    expect(normalizeProxyUrl('socks5://127.0.0.1:7890')).toBeUndefined()
  })

  it('uses explicit proxy before env proxy', () => {
    expect(resolveProxyUrl({
      targetUrl: 'https://api.openai.com/v1/models',
      configuredProxyUrl: 'http://127.0.0.1:7890',
      fallbackToGlobalSettings: false
    })).toBe('http://127.0.0.1:7890/')
  })

  it('returns undefined when no Acopilot proxy is configured', () => {
    expect(resolveProxyUrl({
      targetUrl: 'https://api.openai.com/v1/models',
      fallbackToGlobalSettings: false
    })).toBeUndefined()
  })
})
