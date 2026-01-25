const REDACTED = '***REDACTED***';

function replaceAll(text: string, pattern: RegExp, replacer: string): string {
  return text.replace(pattern, replacer);
}

function redactBearerTokens(text: string): string {
  return replaceAll(text, /\bBearer\s+([^\s'"]+)/gi, `Bearer ${REDACTED}`);
}

function redactAuthHeaderLines(text: string): string {
  return replaceAll(text, /(\bauthorization\s*:\s*)([^\r\n]+)/gi, `$1${REDACTED}`);
}

function redactBasicAuthInUrls(text: string): string {
  return replaceAll(text, /\/\/([^\/\s:@]+):([^\/\s@]+)@/g, `//$1:${REDACTED}@`);
}

function redactKnownQueryParams(text: string): string {
  return replaceAll(
    text,
    /([?&](?:api_key|apikey|token|access_token|refresh_token|key|authorization)=)([^&#\s]+)/gi,
    `$1${REDACTED}`
  );
}

function redactJsonLikeSecrets(text: string): string {
  return replaceAll(
    text,
    /(["'](?:apiKey|apikey|token|accessToken|access_token|refreshToken|refresh_token|password|secret|proxyUrl|authorization)["']\s*:\s*["'])([^"']*)(["'])/gi,
    `$1${REDACTED}$3`
  );
}

function redactInlineAssignments(text: string): string {
  return replaceAll(
    text,
    /(\b(?:apiKey|apikey|token|accessToken|access_token|refreshToken|refresh_token|password|secret|proxyUrl|authorization)\b\s*[=:]\s*)([^\s,'";&#\)\]\}]+)/gi,
    `$1${REDACTED}`
  );
}

function redactCommonTokenFormats(text: string): string {
  let out = text;
  out = replaceAll(out, /\bsk-[A-Za-z0-9]{10,}\b/g, REDACTED);
  out = replaceAll(out, /\bsk-ant-[A-Za-z0-9_-]{10,}\b/g, REDACTED);
  out = replaceAll(out, /\bAIza[0-9A-Za-z\-_]{10,}\b/g, REDACTED);
  out = replaceAll(out, /\bghp_[A-Za-z0-9]{10,}\b/g, REDACTED);
  out = replaceAll(out, /\bglpat-[A-Za-z0-9_-]{10,}\b/g, REDACTED);
  return out;
}

export function redactSensitiveText(input: string): string {
  const text = String(input ?? '');
  if (!text) return text;

  let out = text;
  out = redactBearerTokens(out);
  out = redactAuthHeaderLines(out);
  out = redactBasicAuthInUrls(out);
  out = redactKnownQueryParams(out);
  out = redactJsonLikeSecrets(out);
  out = redactInlineAssignments(out);
  out = redactCommonTokenFormats(out);
  return out;
}
