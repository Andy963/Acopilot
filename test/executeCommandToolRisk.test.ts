import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock vscode
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

// Mock child_process
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

// Mock settingsContext
const mockGetExecuteCommandConfig = vi.fn();
vi.mock('../backend/core/settingsContext', () => ({
  getGlobalSettingsManager: () => ({
    getExecuteCommandConfig: mockGetExecuteCommandConfig,
  }),
}));

// Mock cwdValidation
vi.mock('../backend/tools/terminal/cwdValidation', () => ({
  resolveExecuteCommandWorkingDir: vi.fn().mockResolvedValue({ ok: true, workingDir: '/workspace' }),
}));

// Mock executeCommandShells
vi.mock('../backend/tools/terminal/executeCommandShells', () => ({
  checkShellAvailability: vi.fn().mockResolvedValue({ available: true }),
  getShellConfig: vi.fn().mockReturnValue({ shell: 'bash', shellArgs: ['-c'] }),
  getDefaultShellName: vi.fn().mockReturnValue('bash'),
  getEnabledShellTypesForEnum: vi.fn().mockReturnValue(['bash']),
  getAvailableShellsDescription: vi.fn().mockReturnValue('Bash'),
  getEnabledShellTypes: vi.fn().mockReturnValue(['bash']),
  checkAllShellsAvailability: vi.fn(),
}));

// Mock executeCommandWorkspace
vi.mock('../backend/tools/terminal/executeCommandWorkspace', () => ({
  getAllWorkspaceRoots: vi.fn().mockReturnValue([{ name: 'workspace', path: '/workspace' }]),
}));

// Mock executeCommandGitChanges
vi.mock('../backend/tools/terminal/executeCommandGitChanges', () => ({
  getGitChangesFingerprint: vi.fn().mockResolvedValue('fingerprint'),
  collectExecuteCommandChangedFiles: vi.fn().mockResolvedValue({ changedFiles: [], summary: {} }),
}));

// Mock utils
vi.mock('../backend/tools/utils', () => ({
  getAllWorkspaces: vi.fn().mockReturnValue([{ name: 'workspace', fsPath: '/workspace' }]),
}));


import * as vscode from 'vscode';
import { createExecuteCommandTool } from '../backend/tools/terminal/execute_command';
import { DEFAULT_EXECUTE_COMMAND_RISK_POLICY } from '../backend/core/commandRisk';

describe('execute_command tool risk assessment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetExecuteCommandConfig.mockReturnValue({
      defaultShell: 'bash',
      shells: [{ type: 'bash', enabled: true }],
      riskPolicy: DEFAULT_EXECUTE_COMMAND_RISK_POLICY,
    });
  });

  it('should execute low risk command directly', async () => {
    const tool = createExecuteCommandTool();
    const result = await tool.handler({ command: 'echo hello' });
    expect(result.success).toBe(true);
    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
  });

  it('should prompt for high risk command (e.g. rm -rf /)', async () => {
    const tool = createExecuteCommandTool();
    // Simulate user rejecting the prompt
    (vscode.window.showWarningMessage as any).mockResolvedValue('Cancel');

    const result = await tool.handler({ command: 'rm -rf /' });

    expect(vscode.window.showWarningMessage).toHaveBeenCalled();
    // Since we haven't implemented it yet, it should actually SUCCEED in current codebase (failing test)
    // But we expect it to fail once implemented.
    // For TDD, this test should fail now.
    expect(result.success).toBe(false);
    expect(result.error).toContain('Command execution cancelled by user due to security risk');
  });

  it('should execute if user confirms high risk command', async () => {
    const tool = createExecuteCommandTool();
    // Simulate user accepting the prompt
    (vscode.window.showWarningMessage as any).mockResolvedValue('Execute');

    const result = await tool.handler({ command: 'rm -rf /' });

    expect(vscode.window.showWarningMessage).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });
});
