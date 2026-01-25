import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { describe, expect, it } from 'vitest';

import { resolveExecuteCommandWorkingDir } from '../backend/tools/terminal/cwdValidation';

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'acopilot-cwd-'));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

describe('resolveExecuteCommandWorkingDir', () => {
  it('uses the workspace root when cwd is omitted', async () => {
    await withTempDir(async (tmp) => {
      const wsRoot = path.join(tmp, 'ws');
      await fs.mkdir(wsRoot, { recursive: true });

      const result = await resolveExecuteCommandWorkingDir([{ name: 'ws', fsPath: wsRoot }], undefined);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.workingDir).toBe(wsRoot);
      }
    });
  });

  it('rejects traversal outside the workspace', async () => {
    await withTempDir(async (tmp) => {
      const wsRoot = path.join(tmp, 'ws');
      await fs.mkdir(wsRoot, { recursive: true });

      const result = await resolveExecuteCommandWorkingDir([{ name: 'ws', fsPath: wsRoot }], '..');
      expect(result.ok).toBe(false);
    });
  });

  it('rejects absolute cwd paths', async () => {
    await withTempDir(async (tmp) => {
      const wsRoot = path.join(tmp, 'ws');
      await fs.mkdir(wsRoot, { recursive: true });

      const abs = path.join(tmp, 'outside');
      await fs.mkdir(abs, { recursive: true });

      const result = await resolveExecuteCommandWorkingDir([{ name: 'ws', fsPath: wsRoot }], abs);
      expect(result.ok).toBe(false);
    });
  });

  it('requires explicit workspace prefix in multi-root when cwd is set', async () => {
    await withTempDir(async (tmp) => {
      const wsA = path.join(tmp, 'wsA');
      const wsB = path.join(tmp, 'wsB');
      await fs.mkdir(path.join(wsA, 'sub'), { recursive: true });
      await fs.mkdir(wsB, { recursive: true });

      const ok = await resolveExecuteCommandWorkingDir(
        [
          { name: 'wsA', fsPath: wsA },
          { name: 'wsB', fsPath: wsB },
        ],
        'wsA/sub'
      );
      expect(ok.ok).toBe(true);
      if (ok.ok) {
        expect(ok.workingDir).toBe(path.join(wsA, 'sub'));
      }

      const missingPrefix = await resolveExecuteCommandWorkingDir(
        [
          { name: 'wsA', fsPath: wsA },
          { name: 'wsB', fsPath: wsB },
        ],
        'sub'
      );
      expect(missingPrefix.ok).toBe(false);
    });
  });

  it('rejects symlink cwd that resolves outside the workspace', async () => {
    if (process.platform === 'win32') {
      return;
    }

    await withTempDir(async (tmp) => {
      const wsRoot = path.join(tmp, 'ws');
      const outside = path.join(tmp, 'outside');
      await fs.mkdir(wsRoot, { recursive: true });
      await fs.mkdir(outside, { recursive: true });

      await fs.symlink(outside, path.join(wsRoot, 'link'));

      const result = await resolveExecuteCommandWorkingDir([{ name: 'ws', fsPath: wsRoot }], 'link');
      expect(result.ok).toBe(false);
    });
  });
});
