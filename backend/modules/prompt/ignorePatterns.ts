export function shouldIgnorePath(relativePath: string, ignorePatterns: string[]): boolean {
  for (const pattern of ignorePatterns) {
    if (matchGlobPattern(relativePath, pattern)) {
      return true;
    }
  }
  return false;
}

const GLOB_REGEX_CACHE = new Map<string, RegExp>();
const GLOB_REGEX_CACHE_MAX_SIZE = 2048;

export function matchGlobPattern(inputPath: string, pattern: string): boolean {
  let regex = GLOB_REGEX_CACHE.get(pattern);

  if (!regex) {
    const regexPattern = pattern
      .replace(/\\/g, '/')
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '<<<GLOBSTAR>>>')
      .replace(/\*/g, '[^/]*')
      .replace(/<<<GLOBSTAR>>>/g, '.*')
      .replace(/\//g, '[/\\\\]');

    regex = new RegExp(
      `^${regexPattern}$|[/\\\\]${regexPattern}$|^${regexPattern}[/\\\\]|[/\\\\]${regexPattern}[/\\\\]`,
      'i'
    );

    if (GLOB_REGEX_CACHE.size >= GLOB_REGEX_CACHE_MAX_SIZE) {
      GLOB_REGEX_CACHE.clear();
    }
    GLOB_REGEX_CACHE.set(pattern, regex);
  }

  return regex.test(inputPath.replace(/\\/g, '/'));
}

