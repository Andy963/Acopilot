import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as path from 'path';

import { collectFilesWithPatterns } from '../backend/modules/checkpoint/checkpointFs';

const mockReaddir = vi.fn();
const mockReadFile = vi.fn();

vi.mock('fs/promises', () => ({
  readdir: (...args: any[]) => mockReaddir(...args),
  readFile: (...args: any[]) => mockReadFile(...args),
}));

describe('collectFilesWithPatterns', () => {
  const rootDir = '/app';

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('collects files and respects ignore patterns', async () => {
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
        return [{ name: 'file2.ts', isFile: () => true, isDirectory: () => false }];
      }

      if (dirPath === path.join(rootDir, 'node_modules')) {
        return [{ name: 'pkg', isFile: () => false, isDirectory: () => true }];
      }

      return [];
    });

    const patterns = ['*.js', 'node_modules'];
    const result = await collectFilesWithPatterns(rootDir, patterns);

    expect(result).toContain(path.join(rootDir, 'file1.ts'));
    expect(result).toContain(path.join(rootDir, 'src/file2.ts'));
    expect(result).not.toContain(path.join(rootDir, 'ignored.js'));
    expect(result).not.toContain(path.join(rootDir, 'node_modules/pkg/index.js'));
  });

  it('handles recursive patterns', async () => {
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
    expect(result).toEqual([]);
  });
});

