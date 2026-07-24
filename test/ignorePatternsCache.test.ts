import { vi, describe, expect, it } from 'vitest';

// Mock vscode as required by WorkspaceUtils imports
vi.mock('vscode', () => ({
  workspace: {
    workspaceFolders: []
  }
}));

import { matchGlobPattern as matchIgnore, _TEST_CACHE_ as ignoreCache } from '../backend/modules/prompt/ignorePatterns';
import { _TEST_CACHE_ as fileTreeCache } from '../backend/modules/prompt/fileTree';
import { matchGlobPattern as matchWorkspace, _TEST_CACHE_ as workspaceCache } from '../webview/utils/WorkspaceUtils';

describe('RegExp Caches (Correctness, Reuse, Bounded Limits, and FIFO Eviction)', () => {

  describe('backend/modules/prompt/ignorePatterns.ts', () => {
    it('verifies cache reuse and reference equality', () => {
      ignoreCache.clearCache();
      expect(ignoreCache.getCacheSize()).toBe(0);

      const pattern = 'node_modules';
      matchIgnore('node_modules/lodash/index.js', pattern);
      expect(ignoreCache.getCacheSize()).toBe(1);

      const cachedRegex1 = ignoreCache.getCacheMap().get(pattern);
      expect(cachedRegex1).toBeInstanceOf(RegExp);

      // Subsequent call must retrieve the exact same RegExp object reference
      matchIgnore('node_modules/express/index.js', pattern);
      const cachedRegex2 = ignoreCache.getCacheMap().get(pattern);
      expect(cachedRegex1).toBe(cachedRegex2); // Reference equality!
      expect(ignoreCache.getCacheSize()).toBe(1);
    });

    it('verifies 2048-entry bound and FIFO eviction order', () => {
      ignoreCache.clearCache();

      // Seed with some initial pattern we will track
      const firstPattern = 'pattern_0';
      matchIgnore('some/path', firstPattern);
      expect(ignoreCache.getCacheMap().has(firstPattern)).toBe(true);

      const maxLimit = ignoreCache.MAX_CACHE_SIZE;

      // Fill the cache up to the maximum limit (firstPattern is at index 0)
      for (let i = 1; i < maxLimit; i++) {
        matchIgnore('some/path', `pattern_${i}`);
      }
      expect(ignoreCache.getCacheSize()).toBe(maxLimit);
      expect(ignoreCache.getCacheMap().has(firstPattern)).toBe(true);

      // Adding one more item must trigger FIFO eviction of the oldest item ('pattern_0')
      matchIgnore('some/path', `pattern_${maxLimit}`);
      expect(ignoreCache.getCacheSize()).toBe(maxLimit);
      expect(ignoreCache.getCacheMap().has(firstPattern)).toBe(false); // Evicted!
      expect(ignoreCache.getCacheMap().has(`pattern_1`)).toBe(true);  // Still there
    });
  });

  describe('backend/modules/prompt/fileTree.ts', () => {
    it('verifies ignore and gitignore cache reuse and reference equality', () => {
      fileTreeCache.clearCaches();
      expect(fileTreeCache.getIgnoreCacheSize()).toBe(0);
      expect(fileTreeCache.getGitignoreCacheSize()).toBe(0);

      const pattern = 'dist/**/*.js';
      fileTreeCache.matchIgnoreGlob('dist/index.js', pattern);
      fileTreeCache.matchGitignoreGlob('dist/index.js', pattern);

      expect(fileTreeCache.getIgnoreCacheSize()).toBe(1);
      expect(fileTreeCache.getGitignoreCacheSize()).toBe(1);

      const ignoreRegex1 = fileTreeCache.getIgnoreCacheMap().get(pattern);
      const gitignoreRegex1 = fileTreeCache.getGitignoreCacheMap().get(pattern);

      // Re-run matching to ensure the cached objects are reused
      fileTreeCache.matchIgnoreGlob('dist/other.js', pattern);
      fileTreeCache.matchGitignoreGlob('dist/other.js', pattern);

      const ignoreRegex2 = fileTreeCache.getIgnoreCacheMap().get(pattern);
      const gitignoreRegex2 = fileTreeCache.getGitignoreCacheMap().get(pattern);

      expect(ignoreRegex1).toBe(ignoreRegex2); // Reference equality!
      expect(gitignoreRegex1).toBe(gitignoreRegex2); // Reference equality!
    });

    it('verifies 2048-entry bound and FIFO eviction in fileTree caches', () => {
      fileTreeCache.clearCaches();

      const firstPattern = 'file_pattern_0';
      fileTreeCache.matchIgnoreGlob('path', firstPattern);
      fileTreeCache.matchGitignoreGlob('path', firstPattern);

      expect(fileTreeCache.getIgnoreCacheMap().has(firstPattern)).toBe(true);
      expect(fileTreeCache.getGitignoreCacheMap().has(firstPattern)).toBe(true);

      const maxLimit = fileTreeCache.MAX_CACHE_SIZE;

      for (let i = 1; i < maxLimit; i++) {
        fileTreeCache.matchIgnoreGlob('path', `file_pattern_${i}`);
        fileTreeCache.matchGitignoreGlob('path', `file_pattern_${i}`);
      }

      expect(fileTreeCache.getIgnoreCacheSize()).toBe(maxLimit);
      expect(fileTreeCache.getGitignoreCacheSize()).toBe(maxLimit);

      // Add one more pattern to trigger eviction
      fileTreeCache.matchIgnoreGlob('path', `file_pattern_${maxLimit}`);
      fileTreeCache.matchGitignoreGlob('path', `file_pattern_${maxLimit}`);

      expect(fileTreeCache.getIgnoreCacheSize()).toBe(maxLimit);
      expect(fileTreeCache.getGitignoreCacheSize()).toBe(maxLimit);

      expect(fileTreeCache.getIgnoreCacheMap().has(firstPattern)).toBe(false); // Evicted!
      expect(fileTreeCache.getGitignoreCacheMap().has(firstPattern)).toBe(false); // Evicted!
    });
  });

  describe('webview/utils/WorkspaceUtils.ts', () => {
    it('verifies workspace glob cache reuse and reference equality', () => {
      workspaceCache.clearCache();
      expect(workspaceCache.getCacheSize()).toBe(0);

      const pattern = 'src/**/*.vue';
      matchWorkspace('src/components/Button.vue', pattern);
      expect(workspaceCache.getCacheSize()).toBe(1);

      const cachedRegex1 = workspaceCache.getCacheMap().get(pattern);

      matchWorkspace('src/components/List.vue', pattern);
      const cachedRegex2 = workspaceCache.getCacheMap().get(pattern);

      expect(cachedRegex1).toBe(cachedRegex2); // Reference equality!
    });

    it('verifies 2048-entry bound and FIFO eviction in workspace glob cache', () => {
      workspaceCache.clearCache();

      const firstPattern = 'ws_pattern_0';
      matchWorkspace('path', firstPattern);
      expect(workspaceCache.getCacheMap().has(firstPattern)).toBe(true);

      const maxLimit = workspaceCache.MAX_CACHE_SIZE;

      for (let i = 1; i < maxLimit; i++) {
        matchWorkspace('path', `ws_pattern_${i}`);
      }

      expect(workspaceCache.getCacheSize()).toBe(maxLimit);

      // Add one more pattern to trigger eviction
      matchWorkspace('path', `ws_pattern_${maxLimit}`);
      expect(workspaceCache.getCacheSize()).toBe(maxLimit);

      expect(workspaceCache.getCacheMap().has(firstPattern)).toBe(false); // Evicted!
    });
  });
});
