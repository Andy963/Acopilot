import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { describe, expect, it } from 'vitest';

import { isPathWithinRoot } from '../backend/tools/pathSafety';

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'acopilot-path-'));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

describe('isPathWithinRoot', () => {
  it('allows paths under the root', async () => {
    await withTempDir(async (tmp) => {
      const wsRoot = path.join(tmp, 'ws');
      await fs.mkdir(wsRoot, { recursive: true });

      const candidate = path.join(wsRoot, 'file.txt');
      expect(isPathWithinRoot(wsRoot, candidate)).toBe(true);
    });
  });

  it('rejects traversal outside the root', async () => {
    await withTempDir(async (tmp) => {
      const wsRoot = path.join(tmp, 'ws');
      const outside = path.join(tmp, 'outside');
      await fs.mkdir(wsRoot, { recursive: true });
      await fs.mkdir(outside, { recursive: true });

      const candidate = path.join(wsRoot, '..', 'outside', 'file.txt');
      expect(isPathWithinRoot(wsRoot, candidate)).toBe(false);
    });
  });

  it('rejects symlink escapes', async () => {
    await withTempDir(async (tmp) => {
      if (process.platform === 'win32') {
        return;
      }

      const wsRoot = path.join(tmp, 'ws');
      const outside = path.join(tmp, 'outside');
      await fs.mkdir(wsRoot, { recursive: true });
      await fs.mkdir(outside, { recursive: true });

      const link = path.join(wsRoot, 'link');
      await fs.symlink(outside, link);

      const escaped = path.join(link, 'file.txt');
      expect(isPathWithinRoot(wsRoot, escaped)).toBe(false);
    });
  });
});

