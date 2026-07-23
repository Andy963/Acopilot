import { describe, expect, it } from 'vitest';
import { matchGlobPattern, shouldIgnorePath } from '../backend/modules/prompt/ignorePatterns';

describe('ignorePatterns caching and correctness', () => {
  it('correctly matches folder and exact patterns', () => {
    // Exact match
    expect(matchGlobPattern('src/file.ts', 'src/file.ts')).toBe(true);
    expect(matchGlobPattern('src/file.ts', 'src/other.ts')).toBe(false);

    // Directory match
    expect(matchGlobPattern('node_modules/lodash/index.js', 'node_modules')).toBe(true);
    expect(matchGlobPattern('src/node_modules/lodash/index.js', 'node_modules')).toBe(true);
    expect(matchGlobPattern('src/node_modules_other/lodash/index.js', 'node_modules')).toBe(false);
  });

  it('correctly determines whether a path should be ignored', () => {
    const ignorePatterns = ['node_modules', 'dist', 'build'];
    expect(shouldIgnorePath('node_modules/lodash/index.js', ignorePatterns)).toBe(true);
    expect(shouldIgnorePath('src/index.js', ignorePatterns)).toBe(false);
    expect(shouldIgnorePath('dist/bundle.js', ignorePatterns)).toBe(true);
  });

  it('performs matching with cached patterns and handles bounded eviction', () => {
    // Warm up/cache a pattern
    const pattern = 'node_modules';
    const path = 'node_modules/lodash/index.js';
    expect(matchGlobPattern(path, pattern)).toBe(true);

    // Run a high-frequency loop to benchmark/verify cache correctness
    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      matchGlobPattern(path, pattern);
    }
    const duration = performance.now() - start;
    console.log(`Matched same pattern 10,000 times in ${duration.toFixed(2)}ms`);

    // Force eviction by adding more than 2048 distinct patterns
    for (let i = 0; i < 2100; i++) {
      matchGlobPattern(path, `temp_pattern_${i}`);
    }

    // Verify original cached pattern still matches perfectly after eviction
    expect(matchGlobPattern(path, pattern)).toBe(true);
  });
});
