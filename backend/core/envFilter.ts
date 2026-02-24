function isSensitiveEnvKey(key: string): boolean {
  const normalized = (key || '').trim();
  if (!normalized) return false;

  const patterns: RegExp[] = [
    /api[-_]?key/i,
    /access[-_]?token/i,
    /refresh[-_]?token/i,
    /auth[-_]?token/i,
    /bearer[-_]?token/i,
    /session[-_]?token/i,
    /github[-_]?token/i,
    /gitlab[-_]?token/i,
    /openai[-_]?key/i,
    /anthropic[-_]?key/i,
    /gemini[-_]?key/i,
    /private[-_]?key/i,
    /client[-_]?secret/i,
    /secret/i,
    /password/i,
    /credential/i,
    /(?:^|[-_])token(?:$|[-_])/i,
    /(?:^|[-_])key(?:$|[-_])/i,
    /(?:^|[-_])secret(?:$|[-_])/i,
  ];

  return patterns.some((pattern) => pattern.test(normalized));
}

export function filterSensitiveEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const filtered: NodeJS.ProcessEnv = {};

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) continue;
    if (isSensitiveEnvKey(key)) continue;
    filtered[key] = value;
  }

  return filtered;
}
