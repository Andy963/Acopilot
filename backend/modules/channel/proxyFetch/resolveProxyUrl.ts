import { getGlobalSettingsManager } from '../../../core/settingsContext'

const SUPPORTED_PROXY_PROTOCOLS = new Set(['http:', 'https:'])

function normalizeHost(value: string): string {
  return value.trim().replace(/^\[|\]$/g, '').toLowerCase()
}

function getDefaultPort(protocol: string): string {
  return protocol === 'https:' ? '443' : '80'
}

export function normalizeProxyUrl(raw?: string | null): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined

  const trimmed = raw.trim()
  if (!trimmed) return undefined

  try {
    const parsed = new URL(trimmed)
    if (!SUPPORTED_PROXY_PROTOCOLS.has(parsed.protocol)) {
      return undefined
    }
    return parsed.toString()
  } catch {
    return undefined
  }
}

export function shouldBypassProxy(target: URL, rawNoProxy?: string | null): boolean {
  if (!rawNoProxy || typeof rawNoProxy !== 'string') return false

  const hostname = normalizeHost(target.hostname)
  const port = target.port || getDefaultPort(target.protocol)
  const entries = rawNoProxy
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

  for (const entry of entries) {
    if (entry === '*') return true
    if (entry.toLowerCase() === '<local>') {
      if (!hostname.includes('.')) return true
      continue
    }

    const withoutScheme = entry.replace(/^[a-z]+:\/\//i, '')
    const lastColon = withoutScheme.lastIndexOf(':')
    const hasPort = lastColon > -1 && withoutScheme.indexOf(']') < lastColon
    const rawHost = hasPort ? withoutScheme.slice(0, lastColon) : withoutScheme
    const rulePort = hasPort ? withoutScheme.slice(lastColon + 1) : undefined
    const ruleHost = normalizeHost(rawHost)

    if (!ruleHost) continue
    if (rulePort && rulePort !== port) continue

    if (ruleHost.startsWith('.')) {
      const suffix = ruleHost.slice(1)
      if (hostname === suffix || hostname.endsWith(`.${suffix}`)) {
        return true
      }
      continue
    }

    if (hostname === ruleHost) return true
  }

  return false
}

export function resolveProxyUrl(params: {
  targetUrl: string | URL
  configuredProxyUrl?: string
  fallbackToGlobalSettings?: boolean
}): string | undefined {
  const explicitProxy = normalizeProxyUrl(params.configuredProxyUrl)
  if (explicitProxy) {
    return explicitProxy
  }

  if (params.fallbackToGlobalSettings !== false) {
    const globalProxy = normalizeProxyUrl(getGlobalSettingsManager()?.getEffectiveProxyUrl())
    if (globalProxy) {
      return globalProxy
    }
  }
  return undefined
}
