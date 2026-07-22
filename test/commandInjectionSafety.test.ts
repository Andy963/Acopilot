import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  exec: vi.fn(),
  execFile: vi.fn(),
  execSync: vi.fn(),
  execFileSync: vi.fn(),
  platform: vi.fn(),
  getExecuteCommandConfig: vi.fn(),
}));

vi.mock('child_process', () => ({
  exec: mocks.exec,
  execFile: mocks.execFile,
  execSync: mocks.execSync,
  execFileSync: mocks.execFileSync,
}));

vi.mock('os', async (importOriginal) => ({
  ...(await importOriginal<typeof import('os')>()),
  platform: mocks.platform,
}));

vi.mock('vscode', () => ({}));

vi.mock('../backend/core/settingsContext', () => ({
  getGlobalSettingsManager: () => ({
    getExecuteCommandConfig: mocks.getExecuteCommandConfig,
  }),
}));

vi.mock('../backend/modules/settings', () => ({
  getDefaultExecuteCommandConfig: () => ({
    defaultShell: 'bash',
    shells: [],
  }),
}));

import { DependencyManager } from '../backend/modules/dependencies/DependencyManager';
import {
  checkShellAvailability,
  getEnabledShellTypesForEnum,
} from '../backend/tools/terminal/executeCommandShells';

function completeExecFileSuccessfully(): void {
  mocks.execFile.mockImplementation((...args: unknown[]) => {
    const callback = args.at(-1) as (error: Error | null, stdout: string, stderr: string) => void;
    callback(null, '', '');
    return {} as never;
  });
}

describe('command injection safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.platform.mockReturnValue('linux');
    mocks.getExecuteCommandConfig.mockReturnValue({
      defaultShell: 'bash',
      shells: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the Windows dependency path out of shell arguments', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'acopilot deps & '));
    const tempDir = path.join(root, 'deps-temp');
    const sourcePackage = path.join(tempDir, 'node_modules', 'sharp');

    try {
      await fs.mkdir(sourcePackage, { recursive: true });
      await fs.writeFile(path.join(sourcePackage, 'package.json'), '{"name":"sharp"}');
      mocks.platform.mockReturnValue('win32');
      completeExecFileSuccessfully();

      const manager = DependencyManager.getInstance({} as never, root);
      await expect(manager.install('sharp')).resolves.toBe(true);

      expect(mocks.execFile).toHaveBeenCalledTimes(1);
      expect(mocks.execFile).toHaveBeenCalledWith(
        'npm.cmd',
        ['install', '--no-save'],
        {
          cwd: tempDir,
          timeout: 300000,
          shell: true,
        },
        expect.any(Function),
      );
      expect(mocks.execFile.mock.calls[0]?.[1]).not.toContain(root);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it.each([
    ['linux', 'which', 'bash; touch injected'],
    ['win32', 'where.exe', 'cmd.exe & whoami'],
  ])('passes an untrusted shell name as one argument on %s', async (platform, executable, shellPath) => {
    mocks.platform.mockReturnValue(platform);
    completeExecFileSuccessfully();

    await expect(checkShellAvailability('bash', shellPath)).resolves.toEqual({ available: true });

    expect(mocks.execFile).toHaveBeenCalledWith(
      executable,
      [shellPath],
      { timeout: 5000 },
      expect.any(Function),
    );
    expect(mocks.exec).not.toHaveBeenCalled();
  });

  it('uses argument arrays for synchronous shell availability checks', () => {
    const shellPath = 'bash; touch injected';
    mocks.getExecuteCommandConfig.mockReturnValue({
      defaultShell: 'bash',
      shells: [{
        type: 'bash',
        path: shellPath,
        enabled: true,
        displayName: 'Bash',
      }],
    });

    expect(getEnabledShellTypesForEnum()).toEqual(['default', 'bash']);
    expect(mocks.execFileSync).toHaveBeenCalledWith(
      'which',
      [shellPath],
      { timeout: 3000, stdio: 'ignore' },
    );
    expect(mocks.execSync).not.toHaveBeenCalled();
  });
});
