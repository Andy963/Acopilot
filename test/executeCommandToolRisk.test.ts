import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as cp from 'child_process';

vi.mock('vscode', () => ({
  window: {
    showWarningMessage: vi.fn(),
  },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/workspace' }, name: 'workspace' }],
    getWorkspaceFolder: vi.fn(),
    asRelativePath: vi.fn(),
  },
}));

vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn((event, cb) => {
      if (event === 'close') cb(0);
    }),
    kill: vi.fn(),
    pid: 123,
  })),
}));

const mockGetExecuteCommandConfig = vi.fn();
vi.mock('../backend/core/settingsContext', () => ({
  getGlobalSettingsManager: () => ({
    getExecuteCommandConfig: mockGetExecuteCommandConfig,
  }),
}));

vi.mock('../backend/tools/terminal/cwdValidation', () => ({
  resolveExecuteCommandWorkingDir: vi.fn().mockResolvedValue({ ok: true, workingDir: '/workspace' }),
}));

vi.mock('../backend/tools/terminal/executeCommandShells', () => ({
  checkShellAvailability: vi.fn().mockResolvedValue({ available: true }),
  getShellConfig: vi.fn().mockReturnValue({ shell: 'bash', shellArgs: ['-c'] }),
  getDefaultShellName: vi.fn().mockReturnValue('bash'),
  getEnabledShellTypesForEnum: vi.fn().mockReturnValue(['bash']),
  getAvailableShellsDescription: vi.fn().mockReturnValue('Bash'),
  getEnabledShellTypes: vi.fn().mockReturnValue(['bash']),
  checkAllShellsAvailability: vi.fn(),
}));

vi.mock('../backend/tools/terminal/executeCommandWorkspace', () => ({
  getAllWorkspaceRoots: vi.fn().mockReturnValue([{ name: 'workspace', path: '/workspace' }]),
}));

vi.mock('../backend/tools/terminal/executeCommandGitChanges', () => ({
  getGitChangesFingerprint: vi.fn().mockResolvedValue('fingerprint'),
  collectExecuteCommandChangedFiles: vi.fn().mockResolvedValue({ changedFiles: [], summary: {} }),
}));

vi.mock('../backend/tools/utils', () => ({
  getAllWorkspaces: vi.fn().mockReturnValue([{ name: 'workspace', fsPath: '/workspace' }]),
}));

import * as vscode from 'vscode';
import { DEFAULT_EXECUTE_COMMAND_RISK_POLICY } from '../backend/core/commandRisk';
import { createExecuteCommandTool } from '../backend/tools/terminal/execute_command';

describe('execute_command risk gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetExecuteCommandConfig.mockReturnValue({
      defaultShell: 'bash',
      shells: [{ type: 'bash', enabled: true }],
      riskPolicy: DEFAULT_EXECUTE_COMMAND_RISK_POLICY,
      maxOutputLines: 50,
      defaultTimeout: 60000,
    });
  });

  it('executes low-risk commands without prompting', async () => {
    const tool = createExecuteCommandTool();
    const result = await tool.handler({ command: 'echo hello' });
    expect(result.success).toBe(true);
    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
  });

  it('cancels execution when user rejects high-risk command', async () => {
    const tool = createExecuteCommandTool();
    (vscode.window.showWarningMessage as any).mockResolvedValue('Cancel');

    const result = await tool.handler({ command: 'rm -rf /' });

    expect(vscode.window.showWarningMessage).toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect((result as any).cancelled).toBe(true);
    expect((result as any).error).toContain('cancelled by user');
  });

  it('executes when user confirms high-risk command', async () => {
    const tool = createExecuteCommandTool();
    (vscode.window.showWarningMessage as any).mockResolvedValue('Execute');

    const result = await tool.handler({ command: 'rm -rf /' });

    expect(vscode.window.showWarningMessage).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('filters sensitive env vars before spawning child processes', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.GITHUB_TOKEN = 'ghp-test';
    process.env.PATH = process.env.PATH || '/usr/bin';

    try {
      const tool = createExecuteCommandTool();
      const result = await tool.handler({ command: 'echo hello' });

      expect(result.success).toBe(true);

      const spawnCalls = vi.mocked(cp.spawn).mock.calls;
      expect(spawnCalls.length).toBeGreaterThan(0);

      const options = spawnCalls.at(-1)?.[2] as { env?: NodeJS.ProcessEnv } | undefined;
      expect(options?.env).toBeDefined();
      expect(options?.env?.OPENAI_API_KEY).toBeUndefined();
      expect(options?.env?.GITHUB_TOKEN).toBeUndefined();
      expect(options?.env?.PATH).toBeDefined();
    } finally {
      delete process.env.OPENAI_API_KEY;
      delete process.env.GITHUB_TOKEN;
    }
  });
});
