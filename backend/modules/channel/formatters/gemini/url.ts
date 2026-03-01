function normalizeBaseUrl(raw: string): URL {
  const value = (raw || '').trim();
  if (!value) {
    throw new Error('Gemini config url is required');
  }

  try {
    return new URL(value);
  } catch {
    if (!/^https?:\/\//i.test(value)) {
      return new URL(`https://${value}`);
    }
    throw new Error(`Invalid Gemini url: ${value}`);
  }
}

function joinPath(basePath: string, nextPath: string): string {
  const a = basePath || '';
  const b = nextPath || '';
  const aTrim = a.endsWith('/') ? a.slice(0, -1) : a;
  const bTrim = b.startsWith('/') ? b : `/${b}`;
  return `${aTrim || ''}${bTrim}`;
}

function normalizeGeminiModelPath(modelId: string): string {
  const raw = (modelId || '').trim();
  if (!raw) {
    throw new Error('Gemini config model is required');
  }

  if (raw.startsWith('models/') || raw.startsWith('tunedModels/')) {
    return raw;
  }

  const modelsIndex = raw.indexOf('models/');
  if (modelsIndex >= 0) {
    return raw.slice(modelsIndex);
  }
  const tunedIndex = raw.indexOf('tunedModels/');
  if (tunedIndex >= 0) {
    return raw.slice(tunedIndex);
  }

  return `models/${raw}`;
}

export function buildGeminiGenerateContentUrl(rawBaseUrl: string, modelId: string, useStream: boolean): string {
  const u0 = normalizeBaseUrl(rawBaseUrl);
  const u = new URL(u0.toString());

  const method = useStream ? 'streamGenerateContent' : 'generateContent';
  let basePath = (u.pathname || '').replace(/\/+$/, '') || '/';

  if (/:generateContent$/i.test(basePath) || /:streamGenerateContent$/i.test(basePath)) {
    u.pathname = basePath.replace(/:(streamGenerateContent|generateContent)$/i, `:${method}`);
    if (useStream) {
      u.searchParams.set('alt', 'sse');
    } else {
      u.searchParams.delete('alt');
    }
    return u.toString();
  }

  if (/\/models$/i.test(basePath)) {
    basePath = basePath.replace(/\/models$/i, '') || '/';
  }

  if (!/\/v1beta$/i.test(basePath) && !/\/v1beta\//i.test(`${basePath}/`)) {
    basePath = joinPath(basePath, '/v1beta');
  }

  const modelPath = normalizeGeminiModelPath(modelId);
  u.pathname = joinPath(basePath, `/${modelPath}:${method}`);

  if (useStream) {
    u.searchParams.set('alt', 'sse');
  } else {
    u.searchParams.delete('alt');
  }

  return u.toString();
}
