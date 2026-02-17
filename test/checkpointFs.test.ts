import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as path from 'path';
import { collectFilesWithPatterns } from '../backend/modules/checkpoint/checkpointFs';

// Mock fs/promises
const mockReaddir = vi.fn();
const mockReadFile = vi.fn();
const mockRmdir = vi.fn();

vi.mock('fs/promises', () => ({
  readdir: (...args: any[]) => mockReaddir(...args),
  readFile: (...args: any[]) => mockReadFile(...args),
  rmdir: (...args: any[]) => mockRmdir(...args),
}));

describe('collectFilesWithPatterns', () => {
  const rootDir = '/app';

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should collect files and respect ignore patterns', async () => {
    // Setup file structure:
    // /app/file1.ts
    // /app/ignored.js
    // /app/src/file2.ts
    // /app/node_modules/pkg/index.js (should be ignored by default 'node_modules')

    mockReaddir.mockImplementation(async (dirPath: string) => {
      if (dirPath === rootDir) {
        return [
          { name: 'file1.ts', isFile: () => true, isDirectory: () => false },
          { name: 'ignored.js', isFile: () => true, isDirectory: () => false },
          { name: 'src', isFile: () => false, isDirectory: () => true },
          { name: 'node_modules', isFile: () => false, isDirectory: () => true },
        ];
      }
      if (dirPath === path.join(rootDir, 'src')) {
        return [
          { name: 'file2.ts', isFile: () => true, isDirectory: () => false },
        ];
      }
      // node_modules shouldn't be traversed if ignored, but if traversal happens we mock it
      if (dirPath === path.join(rootDir, 'node_modules')) {
         // Should not be called if 'node_modules' is in patterns and handled correctly
         return [
             { name: 'pkg', isFile: () => false, isDirectory: () => true },
         ];
      }
      return [];
    });

    const patterns = ['*.js', 'node_modules'];
    const result = await collectFilesWithPatterns(rootDir, patterns);

    expect(result).toContain(path.join(rootDir, 'file1.ts'));
    expect(result).toContain(path.join(rootDir, 'src/file2.ts'));
    expect(result).not.toContain(path.join(rootDir, 'ignored.js'));
    // Ensure ignored directories are not traversed or collected
    expect(result).not.toContain(path.join(rootDir, 'node_modules/pkg/index.js'));
  });

  it('should handle recursive patterns', async () => {
    // /app/logs/error.log
    // /app/src/utils.log

    mockReaddir.mockImplementation(async (dirPath: string) => {
        if (dirPath === rootDir) {
            return [
                { name: 'logs', isFile: () => false, isDirectory: () => true },
                { name: 'src', isFile: () => false, isDirectory: () => true },
            ];
        }
        if (dirPath === path.join(rootDir, 'logs')) {
             return [{ name: 'error.log', isFile: () => true, isDirectory: () => false }];
        }
        if (dirPath === path.join(rootDir, 'src')) {
             return [{ name: 'utils.log', isFile: () => true, isDirectory: () => false }];
        }
        return [];
    });

    const patterns = ['**/*.log'];
    const result = await collectFilesWithPatterns(rootDir, patterns);

    expect(result).toHaveLength(0);
  });
});
