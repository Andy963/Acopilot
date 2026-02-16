/**
 * Filter sensitive environment variables to prevent leakage.
 */
export function filterSensitiveEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const filteredEnv: NodeJS.ProcessEnv = {};
  const sensitivePatterns = [
    /api[-_]?key/i,
    /access[-_]?token/i,
    /refresh[-_]?token/i,
    /secret/i,
    /password/i,
    /credential/i,
    /auth[-_]?token/i,
    /github[-_]?token/i,
    /gemini[-_]?key/i,
    /openai[-_]?key/i,
    /anthropic[-_]?key/i,
    /private[-_]?key/i,
  ];

  for (const key in env) {
    if (Object.prototype.hasOwnProperty.call(env, key)) {
      const isSensitive = sensitivePatterns.some((pattern) => pattern.test(key));
      if (!isSensitive) {
        filteredEnv[key] = env[key];
      }
    }
  }

  return filteredEnv;
}
