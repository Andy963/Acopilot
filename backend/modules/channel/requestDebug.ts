export type RequestDebugInfo = {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  auth?: {
    present: boolean;
    nonEmpty: boolean;
    scheme?: string;
  };
};

function findHeaderValue(headers: Record<string, string> | undefined, targetName: string): string | undefined {
  if (!headers) return undefined;
  const targetLower = targetName.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === targetLower) return value;
  }
  return undefined;
}

function redactSensitiveHeaderValue(headerName: string, value: string): string {
  const name = headerName.toLowerCase();
  if (name === 'authorization') {
    const trimmed = String(value || '').trim();
    const bearerMatch = trimmed.match(/^bearer\s+/i);
    if (bearerMatch) return 'Bearer ***REDACTED***';
    return '***REDACTED***';
  }
  if (name === 'x-api-key' || name === 'api-key' || name === 'x-goog-api-key') {
    return '***REDACTED***';
  }
  return value;
}

function redactHeaders(headers: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!headers) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    out[key] = redactSensitiveHeaderValue(key, String(value ?? ''));
  }
  return out;
}

export function buildRequestDebugInfo(input: {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
}): RequestDebugInfo {
  const authValueRaw = findHeaderValue(input.headers, 'Authorization');
  const authValueTrimmed = String(authValueRaw || '').trim();
  const scheme = authValueTrimmed ? authValueTrimmed.split(/\s+/, 1)[0]?.toLowerCase() : undefined;

  return {
    url: input.url,
    method: input.method,
    headers: redactHeaders(input.headers),
    auth: {
      present: authValueRaw !== undefined,
      nonEmpty: authValueTrimmed.length > 0,
      scheme,
    },
  };
}

