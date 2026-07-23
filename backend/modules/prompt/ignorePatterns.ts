// Module-level RegExp cache to prevent GC pressure and CPU overhead during file tree traversals.
const REGEX_CACHE = new Map<string, RegExp>();
const MAX_CACHE_SIZE = 2048;

/**
 * Retrieves a cached RegExp for the given glob pattern or compiles and caches a new one.
 */
function getOrCreateRegex(pattern: string): RegExp {
  let regex = REGEX_CACHE.get(pattern);
  if (regex !== undefined) {
    return regex;
  }

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

  // Maintain bounded cache size using simple oldest-entry (first key) eviction
  if (REGEX_CACHE.size >= MAX_CACHE_SIZE) {
    const firstKey = REGEX_CACHE.keys().next().value;
    if (firstKey !== undefined) {
      REGEX_CACHE.delete(firstKey);
    }
  }
  REGEX_CACHE.set(pattern, regex);
  return regex;
}

export function shouldIgnorePath(relativePath: string, ignorePatterns: string[]): boolean {
  for (const pattern of ignorePatterns) {
    if (matchGlobPattern(relativePath, pattern)) {
      return true;
    }
  }
  return false;
}

export function matchGlobPattern(inputPath: string, pattern: string): boolean {
  const regex = getOrCreateRegex(pattern);
  return regex.test(inputPath.replace(/\\/g, '/'));
}
