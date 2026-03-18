import * as cp from 'child_process';
import * as os from 'os';
import { StringDecoder } from 'string_decoder';
import * as vscode from 'vscode';

import type { Tool, ToolContext, ToolResult } from '../../types';

import { shouldConfirmExecuteCommand } from '../../../core/commandRisk';
import { filterSensitiveEnv } from '../../../core/envFilter';
import { getGlobalSettingsManager } from '../../../core/settingsContext';
import { getDefaultExecuteCommandConfig } from '../../../modules/settings';
import { TaskManager } from '../../taskManager';
import { getAllWorkspaces } from '../../utils';

import { resolveExecuteCommandWorkingDir } from '../cwdValidation';
import {
    collectExecuteCommandChangedFiles,
    getGitChangesFingerprint,
    type ExecuteCommandChangedFile,
    type ExecuteCommandChangesSummary
} from '../executeCommandGitChanges';
import {
    checkShellAvailability,
    getAvailableShellsDescription,
    getDefaultShellName,
    getEnabledShellTypesForEnum,
    getShellConfig,
    type ShellType
} from '../executeCommandShells';
import { getAllWorkspaceRoots } from '../executeCommandWorkspace';

import { TASK_TYPE_TERMINAL } from './constants';
import { emitTerminalOutput } from './events';
import { activeProcesses, killTerminalProcess } from './processRegistry';
import type { TerminalProcess } from './types';
import { generateTerminalId, getLastLines, getMaxOutputLines, getOSName } from './utils';

export function createExecuteCommandTool(): Tool {
    const osName = getOSName();
    const osArch = os.arch();
    const osRelease = os.release();

    const workspaceRoots = getAllWorkspaceRoots();
    const isMultiRoot = workspaceRoots.length > 1;

    let workspaceDescription = '';
    if (isMultiRoot) {
        workspaceDescription = '\n\n**Multi-root Workspace Mode:**\n' +
            workspaceRoots.map(ws => `- ${ws.name}: ${ws.path}`).join('\n') +
            '\n\nUse "workspace_name/path" format to specify the working directory';
    }

    let cwdDescription = 'Working directory (relative to workspace root and must stay within the workspace), defaults to workspace root';
    if (isMultiRoot) {
        cwdDescription = `Working directory, must use "workspace_name/path" format and must stay within that workspace. Available workspaces: ${workspaceRoots.map(w => w.name).join(', ')}`;
    }

    return {
        declaration: {
            name: 'execute_command',
            category: 'terminal',
            description: `Execute a Shell command and return the output.

**User Environment:**
- OS: ${osName} (${osArch})
- OS Version: ${osRelease}
- Default Shell: ${getDefaultShellName()}

**Enabled Shells:**
${getAvailableShellsDescription()}${workspaceDescription}

**Usage Notes:**
- If the shell parameter is empty or set to "default", ${getDefaultShellName()} will be used
- Returns the last ${getMaxOutputLines() === -1 ? 'all' : getMaxOutputLines()} lines of output (configurable in settings)
- For long-running commands, you can set the timeout parameter (in milliseconds)`,
            parameters: {
                type: 'object',
                properties: {
                    command: {
                        type: 'string',
                        description: 'The Shell command to execute'
                    },
                    cwd: {
                        type: 'string',
                        description: cwdDescription
                    },
                    shell: {
                        type: 'string',
                        description: `Shell type, optional values: ${getEnabledShellTypesForEnum().join(', ')}`,
                        enum: getEnabledShellTypesForEnum(),
                        default: 'default'
                    },
                    timeout: {
                        type: 'number',
                        description: 'Timeout (milliseconds), 0 means no timeout, default is 60000 (60 seconds)',
                        default: 60000
                    }
                },
                required: ['command']
            }
        },
        handler: async (args, context?: ToolContext): Promise<ToolResult> => {
            const command = args.command as string;
            const cwd = args.cwd as string | undefined;
            const shell = (args.shell as ShellType) || 'default';
            const timeout = (args.timeout as number) ?? 60000;

            const terminalId = context?.toolId as string || generateTerminalId();
            const externalAbortSignal = context?.abortSignal as AbortSignal | undefined;

            if (!command) {
                return { success: false, error: 'command is required' };
            }

            const workspaces = getAllWorkspaces();
            if (workspaces.length === 0) {
                return { success: false, error: 'No workspace folder open' };
            }

            const settingsManager = getGlobalSettingsManager();
            const config = settingsManager?.getExecuteCommandConfig() || getDefaultExecuteCommandConfig();

            const { confirm, assessment } = shouldConfirmExecuteCommand(command, config.riskPolicy);
            if (confirm) {
                const reasonText = assessment.reasons.length > 0 ? ` (${assessment.reasons.join(', ')})` : '';
                const choice = await vscode.window.showWarningMessage(
                    `High-risk command detected [${assessment.level}]${reasonText}: ${command}`,
                    { modal: true },
                    'Execute',
                    'Cancel'
                );

                if (choice !== 'Execute') {
                    return {
                        success: false,
                        cancelled: true,
                        error: 'Command execution cancelled by user',
                    };
                }
            }

            let actualShellType = shell;
            if (shell === 'default') {
                actualShellType = config.defaultShell as ShellType;
            }

            const shellInfo = config.shells.find(s => s.type === actualShellType);
            if (shellInfo && !shellInfo.enabled) {
                return {
                    success: false,
                    error: `Shell "${actualShellType}" is not enabled, please enable it in settings and try again`
                };
            }

            const availability = await checkShellAvailability(actualShellType, shellInfo?.path);
            if (!availability.available) {
                return {
                    success: false,
                    error: `Shell "${actualShellType}" is not available: ${availability.reason || 'unknown reason'}. Please configure the correct path in settings.`
                };
            }

            const resolvedWorkingDir = await resolveExecuteCommandWorkingDir(
                workspaces.map(w => ({ name: w.name, fsPath: w.fsPath })),
                cwd
            );
            if (resolvedWorkingDir.ok === false) {
                return { success: false, error: resolvedWorkingDir.error };
            }

            const workingDir = resolvedWorkingDir.workingDir;

            const shellConfig = getShellConfig(shell);

            const baselineGitChangesFingerprint = await getGitChangesFingerprint(workingDir);

            return new Promise((resolve) => {
                if (externalAbortSignal?.aborted) {
                    resolve({
                        success: false,
                        error: '⚠️ User cancelled the command execution. Please wait for user\'s next instruction.',
                        cancelled: true
                    });
                    return;
                }

                try {
                    let finalCommand = shellConfig.prependCommand
                        ? `${shellConfig.prependCommand} ${command}`
                        : command;

                    const isCmdWithS = shellConfig.shell.toLowerCase().includes('cmd') &&
                        shellConfig.shellArgs?.includes('/s');
                    const isWindows = os.platform() === 'win32';
                    if (isCmdWithS) {
                        // cmd.exe /s /c requires the whole command wrapped in quotes.
                        finalCommand = `"${finalCommand}"`;
                    }

                    const spawnArgs = shellConfig.shellArgs
                        ? [...shellConfig.shellArgs, finalCommand]
                        : [finalCommand];

                    const env = filterSensitiveEnv(process.env);
                    if (isWindows) {
                        if (!env.LANG) env.LANG = 'en_US.UTF-8';
                        if (!env.PYTHONIOENCODING) env.PYTHONIOENCODING = 'utf-8';
                    }

                    const proc = cp.spawn(shellConfig.shell, spawnArgs, {
                        cwd: workingDir,
                        shell: false,
                        env,
                        windowsHide: true,
                        // @ts-ignore - windowsVerbatimArguments is a valid option on Windows
                        windowsVerbatimArguments: isWindows && isCmdWithS
                    });

                    const terminalProcess: TerminalProcess = {
                        id: terminalId,
                        command,
                        cwd: workingDir,
                        shell,
                        process: proc,
                        output: [],
                        startTime: Date.now()
                    };

                    activeProcesses.set(terminalId, terminalProcess);

                    const taskAbortController = new AbortController();
                    TaskManager.registerTask(terminalId, TASK_TYPE_TERMINAL, taskAbortController, {
                        command,
                        cwd: workingDir,
                        shell
                    });

                    if (externalAbortSignal) {
                        const abortHandler = () => {
                            killTerminalProcess(terminalId);
                        };

                        externalAbortSignal.addEventListener('abort', abortHandler, { once: true });

                        proc.on('close', () => {
                            externalAbortSignal.removeEventListener('abort', abortHandler);
                        });
                    }

                    emitTerminalOutput({
                        terminalId,
                        type: 'start',
                        command,
                        cwd: workingDir,
                        shell
                    });

                    const stdoutDecoder = new StringDecoder('utf8');
                    const stderrDecoder = new StringDecoder('utf8');

                    let stdoutRemaining = '';
                    let stderrRemaining = '';

                    proc.stdout?.on('data', (data: Buffer) => {
                        const text = stdoutDecoder.write(data);
                        const content = stdoutRemaining + text;
                        const lines = content.split(/\r?\n/);
                        stdoutRemaining = lines.pop() || '';

                        if (lines.length > 0) {
                            terminalProcess.output.push(...lines);
                        }

                        emitTerminalOutput({
                            terminalId,
                            type: 'output',
                            data: text
                        });
                    });

                    proc.stderr?.on('data', (data: Buffer) => {
                        const text = stderrDecoder.write(data);
                        const content = stderrRemaining + text;
                        const lines = content.split(/\r?\n/);
                        stderrRemaining = lines.pop() || '';

                        if (lines.length > 0) {
                            terminalProcess.output.push(...lines);
                        }

                        emitTerminalOutput({
                            terminalId,
                            type: 'error',
                            data: text
                        });
                    });

                    proc.on('close', () => {
                        if (stdoutRemaining) {
                            terminalProcess.output.push(stdoutRemaining);
                        }
                        if (stderrRemaining) {
                            terminalProcess.output.push(stderrRemaining);
                        }
                    });

                    let timeoutHandle: NodeJS.Timeout | undefined;
                    if (timeout > 0) {
                        timeoutHandle = setTimeout(() => {
                            proc.kill('SIGTERM');
                            terminalProcess.killed = true;
                            terminalProcess.error = `Command timed out after ${timeout}ms`;
                        }, timeout);
                    }

                    proc.on('close', async (code) => {
                        if (timeoutHandle) {
                            clearTimeout(timeoutHandle);
                        }

                        terminalProcess.endTime = Date.now();
                        terminalProcess.exitCode = code ?? undefined;

                        const maxLines = getMaxOutputLines();
                        const lastOutput = maxLines === -1
                            ? terminalProcess.output
                            : getLastLines(terminalProcess.output, maxLines);
                        const duration = terminalProcess.endTime - terminalProcess.startTime;

                        activeProcesses.delete(terminalId);

                        const status = terminalProcess.killed ? 'cancelled' : (code === 0 ? 'completed' : 'error');
                        TaskManager.unregisterTask(terminalId, status, {
                            exitCode: code,
                            duration,
                            killed: terminalProcess.killed
                        });

                        const isExternalAbort = externalAbortSignal?.aborted && terminalProcess.killed;
                        const success = code === 0 || terminalProcess.killed === true;

                        let error: string | undefined;
                        if (isExternalAbort) {
                            error = 'User cancelled the command execution. Please wait for user\'s next instruction.';
                        } else if (terminalProcess.error) {
                            error = terminalProcess.error;
                        } else if (terminalProcess.killed) {
                            error = undefined;
                        } else if (code !== 0 && code !== null) {
                            error = `Command exited with code ${code}`;
                        }

                        emitTerminalOutput({
                            terminalId,
                            type: 'exit',
                            exitCode: code ?? undefined,
                            killed: terminalProcess.killed,
                            duration
                        });

                        const totalLines = terminalProcess.output.length;
                        const outputLines = lastOutput.length;
                        const wasTruncated = maxLines !== -1 && totalLines > outputLines;
                        const truncatedNote = wasTruncated
                            ? `(Output truncated: showing last ${outputLines} of ${totalLines} lines)`
                            : undefined;

                        let changedFiles: ExecuteCommandChangedFile[] | undefined;
                        let changesSummary: ExecuteCommandChangesSummary | undefined;
                        try {
                            const nextFingerprint = await getGitChangesFingerprint(workingDir);
                            const shouldCollectChanges = (
                                baselineGitChangesFingerprint === null ||
                                nextFingerprint === null ||
                                baselineGitChangesFingerprint !== nextFingerprint
                            );

                            if (shouldCollectChanges) {
                                const changes = await collectExecuteCommandChangedFiles(workingDir);
                                changedFiles = changes.changedFiles;
                                changesSummary = changes.summary;
                            }
                        } catch {
                            changedFiles = [];
                            changesSummary = {
                                totalFiles: 0,
                                diffAvailableFiles: 0,
                                skippedFiles: 0,
                                unsupportedReason: 'failed to collect file changes'
                            };
                        }

                        resolve({
                            success: isExternalAbort ? false : success,
                            data: {
                                terminalId,
                                command,
                                cwd: workingDir,
                                shell,
                                exitCode: code,
                                killed: terminalProcess.killed || false,
                                duration,
                                output: lastOutput.join('\n'),
                                truncated: wasTruncated,
                                totalLines,
                                outputLines,
                                truncatedNote,
                                changedFiles,
                                changesSummary
                            },
                            error,
                            cancelled: isExternalAbort
                        });
                    });

                    proc.on('error', (err) => {
                        if (timeoutHandle) {
                            clearTimeout(timeoutHandle);
                        }

                        terminalProcess.endTime = Date.now();
                        terminalProcess.error = err.message;

                        const errMaxLines = getMaxOutputLines();
                        const lastOutput = errMaxLines === -1
                            ? terminalProcess.output
                            : getLastLines(terminalProcess.output, errMaxLines);
                        const duration = terminalProcess.endTime - terminalProcess.startTime;
                        const totalLines = terminalProcess.output.length;
                        const outputLines = lastOutput.length;
                        const wasTruncated = errMaxLines !== -1 && totalLines > outputLines;

                        activeProcesses.delete(terminalId);

                        TaskManager.unregisterTask(terminalId, 'error', {
                            error: err.message,
                            duration
                        });

                        emitTerminalOutput({
                            terminalId,
                            type: 'exit',
                            exitCode: -1,
                            killed: false,
                            duration
                        });

                        resolve({
                            success: false,
                            data: {
                                terminalId,
                                command,
                                cwd: workingDir,
                                shell,
                                exitCode: -1,
                                killed: false,
                                duration,
                                output: lastOutput.join('\n'),
                                truncated: wasTruncated,
                                totalLines,
                                outputLines
                            },
                            error: `Failed to execute command: ${err.message}`
                        });
                    });
                } catch (error) {
                    resolve({
                        success: false,
                        error: `Failed to start command: ${error instanceof Error ? error.message : String(error)}`
                    });
                }
            });
        }
    };
}

export function registerExecuteCommand(): Tool {
    return createExecuteCommandTool();
}
