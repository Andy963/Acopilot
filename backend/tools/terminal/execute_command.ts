/**
 * 执行命令工具
 *
 * 使用 child_process 执行命令，捕获输出并返回
 * 支持实时输出推送到前端
 * 支持多工作区（Multi-root Workspaces）
 */

import * as cp from 'child_process';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { StringDecoder } from 'string_decoder';
import type { Tool, ToolResult, ToolContext } from '../types';

// tree-kill 库，用于跨平台终止进程树
// eslint-disable-next-line @typescript-eslint/no-var-requires
const treeKill = require('tree-kill') as (pid: number, signal?: string, callback?: (error?: Error) => void) => void;
import { getGlobalSettingsManager } from '../../core/settingsContext';
import { getDefaultExecuteCommandConfig } from '../../modules/settings';
import { TaskManager, type TaskEvent } from '../taskManager';
import { getAllWorkspaces } from '../utils';
import { t } from '../../i18n';
import { resolveExecuteCommandWorkingDir } from './cwdValidation';
import { collectExecuteCommandChangedFiles, getGitChangesFingerprint, type ExecuteCommandChangedFile, type ExecuteCommandChangesSummary } from './executeCommandGitChanges';
import { checkAllShellsAvailability, checkShellAvailability, getAvailableShellsDescription, getDefaultShellName, getEnabledShellTypes, getEnabledShellTypesForEnum, getShellConfig, type ShellType } from './executeCommandShells';
import { getAllWorkspaceRoots } from './executeCommandWorkspace';
import { filterSensitiveEnv } from '../../core/envFilter';

export { checkAllShellsAvailability, checkShellAvailability, getEnabledShellTypes };

/** 终端任务类型常量 */
const TASK_TYPE_TERMINAL = 'terminal';

/**
 * 终端进程信息
 */
interface TerminalProcess {
    id: string;
    command: string;
    cwd: string;
    shell: ShellType;
    process: cp.ChildProcess;
    output: string[];
    startTime: number;
    endTime?: number;
    exitCode?: number;
    killed?: boolean;
    error?: string;
}

/**
 * 活动终端进程管理
 */
const activeProcesses: Map<string, TerminalProcess> = new Map();

/**
 * 终端事件发射器
 * 用于实时推送终端输出到前端
 */
const terminalEmitter = new EventEmitter();

/**
 * 终端输出事件类型
 */
export interface TerminalOutputEvent {
    terminalId: string;
    type: 'start' | 'output' | 'error' | 'exit';
    data?: string;
    command?: string;  // start 事件时包含命令
    cwd?: string;      // start 事件时包含工作目录
    shell?: string;    // start 事件时包含 shell 类型
    exitCode?: number;
    killed?: boolean;
    duration?: number;
}

/**
 * 订阅终端输出
 * @param listener 监听器函数
 * @returns 取消订阅函数
 */
export function onTerminalOutput(listener: (event: TerminalOutputEvent) => void): () => void {
    terminalEmitter.on('output', listener);
    return () => terminalEmitter.off('output', listener);
}

/**
 * 订阅终端任务事件（使用 TaskManager）
 * 这是统一事件系统的入口，可用于未来替换 terminalEmitter
 * @param listener 监听器函数
 * @returns 取消订阅函数
 */
export function onTerminalTaskEvent(listener: (event: TaskEvent) => void): () => void {
    return TaskManager.onTaskEventByType(TASK_TYPE_TERMINAL, listener);
}

/**
 * 发送终端输出事件
 */
function emitTerminalOutput(event: TerminalOutputEvent): void {
    terminalEmitter.emit('output', event);
}

/**
 * 获取最大输出行数配置
 * 从设置中读取，默认 50 行
 * -1 表示无限制
 */
function getMaxOutputLines(): number {
    const settingsManager = getGlobalSettingsManager();
    const config = settingsManager?.getExecuteCommandConfig() || getDefaultExecuteCommandConfig();
    return config.maxOutputLines ?? 50;
}

/**
 * 生成唯一终端 ID（使用 TaskManager）
 */
function generateTerminalId(): string {
    return TaskManager.generateTaskId('terminal');
}

/**
 * 截取最后 N 行
 */
function getLastLines(lines: string[], n: number): string[] {
    if (lines.length <= n) {
        return lines;
    }
    return lines.slice(-n);
}

/**
 * 获取操作系统名称
 */
function getOSName(): string {
    const platform = os.platform();
    switch (platform) {
        case 'win32':
            return 'Windows';
        case 'darwin':
            return 'macOS';
        case 'linux':
            return 'Linux';
        case 'freebsd':
            return 'FreeBSD';
        default:
            return platform;
    }
}

/**
 * 创建执行命令工具
 */
export function createExecuteCommandTool(): Tool {
    const osName = getOSName();
    const osArch = os.arch();
    const osRelease = os.release();
    
    // 获取工作区信息
    const workspaceRoots = getAllWorkspaceRoots();
    const isMultiRoot = workspaceRoots.length > 1;
    
    // 生成工作区说明
    let workspaceDescription = '';
    if (isMultiRoot) {
        workspaceDescription = '\n\n**Multi-root Workspace Mode:**\n' +
            workspaceRoots.map(ws => `- ${ws.name}: ${ws.path}`).join('\n') +
            '\n\nUse "workspace_name/path" format to specify the working directory';
    }
    
    // cwd 参数描述
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
            
            // 使用 context 中的 toolId 或生成新的
            const terminalId = context?.toolId as string || generateTerminalId();
            
            // 获取外部的 abortSignal（用于用户取消对话时终止终端）
            const externalAbortSignal = context?.abortSignal as AbortSignal | undefined;

            if (!command) {
                return { success: false, error: 'command is required' };
            }

            const workspaces = getAllWorkspaces();
            if (workspaces.length === 0) {
                return { success: false, error: 'No workspace folder open' };
            }

            // 获取设置管理器和配置
            const settingsManager = getGlobalSettingsManager();
            const config = settingsManager?.getExecuteCommandConfig() || getDefaultExecuteCommandConfig();
            
            // 确定实际使用的 shell 类型
            let actualShellType = shell;
            if (shell === 'default') {
                actualShellType = config.defaultShell as ShellType;
            }
            
            // 检查 shell 是否启用
            const shellInfo = config.shells.find(s => s.type === actualShellType);
            if (shellInfo && !shellInfo.enabled) {
                return {
                    success: false,
                    error: `Shell "${actualShellType}" is not enabled, please enable it in settings and try again`
                };
            }
            
            // 检查 shell 可用性
            const availability = await checkShellAvailability(actualShellType, shellInfo?.path);
            if (!availability.available) {
                return {
                    success: false,
                    error: `Shell "${actualShellType}" is not available: ${availability.reason || 'unknown reason'}. Please configure the correct path in settings.`
                };
            }

            // Compute and validate working directory: disallow leaving the currently-open workspace(s).
            const resolvedWorkingDir = await resolveExecuteCommandWorkingDir(
                workspaces.map(w => ({ name: w.name, fsPath: w.fsPath })),
                cwd
            );
            if (resolvedWorkingDir.ok === false) {
                return { success: false, error: resolvedWorkingDir.error };
            }

            const workingDir = resolvedWorkingDir.workingDir;

            // 获取 shell 配置
            const shellConfig = getShellConfig(shell);

            // 记录执行前的 git 变更指纹：只有当工作区变更发生变化时才返回 file changes，避免每个只读命令都重复展示同一批变更
            const baselineGitChangesFingerprint = await getGitChangesFingerprint(workingDir);

            return new Promise((resolve) => {
                // 检查是否已经取消
                if (externalAbortSignal?.aborted) {
                    resolve({
                        success: false,
                        error: '⚠️ User cancelled the command execution. Please wait for user\'s next instruction.',
                        cancelled: true
                    });
                    return;
                }
                
                try {
                    // 构建最终命令（可能需要添加前置命令）
                    let finalCommand = shellConfig.prependCommand
                        ? `${shellConfig.prependCommand} ${command}`
                        : command;

                    // CMD /s /c 特殊处理：需要将整个命令用双引号包裹
                    // /s 参数会去除最外层引号，同时保留命令中的内层引号
                    // 这解决了 FINDSTR 等命令中多个搜索词被错误解析的问题
                    const isCmdWithS = shellConfig.shell.toLowerCase().includes('cmd') &&
                        shellConfig.shellArgs?.includes('/s');
                    const isWindows = os.platform() === 'win32';
                    if (isCmdWithS) {
                        finalCommand = `"${finalCommand}"`;
                    }

                    // 构建命令参数
                    const spawnArgs = shellConfig.shellArgs
                        ? [...shellConfig.shellArgs, finalCommand]
                        : [finalCommand];

                    // 注入环境变量以便更好地支持 UTF-8（主要针对 Windows 上的 Unix 工具）
                    // 🛡️ Security: Filter sensitive environment variables to prevent leakage
                    const env = { ...filterSensitiveEnv(process.env) };
                    if (isWindows) {
                        // 很多工具（如 git, node, python）在 Windows 上通过这些变量识别编码
                        if (!env.LANG) env.LANG = 'en_US.UTF-8';
                        if (!env.PYTHONIOENCODING) env.PYTHONIOENCODING = 'utf-8';
                    }

                    // 启动进程
                    const proc = cp.spawn(shellConfig.shell, spawnArgs, {
                        cwd: workingDir,
                        shell: false,
                        env,
                        windowsHide: true,
                        // 在 Windows 上，如果是 cmd.exe 且使用了 /s 参数，
                        // 我们需要使用 windowsVerbatimArguments 来防止 Node.js 转义引号。
                        // 因为我们已经手动在 finalCommand 两边加上了引号。
                        // @ts-ignore - windowsVerbatimArguments is a valid option on Windows
                        windowsVerbatimArguments: isWindows && isCmdWithS
                    });

                    // 创建终端进程信息
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
                    
                    // 使用 TaskManager 注册任务
                    // 创建一个 AbortController 用于统一取消
                    const taskAbortController = new AbortController();
                    TaskManager.registerTask(terminalId, TASK_TYPE_TERMINAL, taskAbortController, {
                        command,
                        cwd: workingDir,
                        shell
                    });
                    
                    // 监听外部的 abortSignal（用户取消对话时触发）
                    if (externalAbortSignal) {
                        const abortHandler = () => {
                            // 调用 killTerminalProcess 终止进程
                            killTerminalProcess(terminalId);
                        };
                        
                        externalAbortSignal.addEventListener('abort', abortHandler, { once: true });
                        
                        // 进程结束时移除监听器
                        proc.on('close', () => {
                            externalAbortSignal.removeEventListener('abort', abortHandler);
                        });
                    }
                    
                    // 发送 start 事件，通知前端进程已启动
                    emitTerminalOutput({
                        terminalId,
                        type: 'start',
                        command,
                        cwd: workingDir,
                        shell
                    });

                    // 使用 StringDecoder 处理 UTF-8 编码，防止多字节字符截断
                    const stdoutDecoder = new StringDecoder('utf8');
                    const stderrDecoder = new StringDecoder('utf8');

                    let stdoutRemaining = '';
                    let stderrRemaining = '';

                    // 收集输出并实时推送
                    proc.stdout?.on('data', (data: Buffer) => {
                        const text = stdoutDecoder.write(data);
                        const content = stdoutRemaining + text;
                        const lines = content.split(/\r?\n/);
                        stdoutRemaining = lines.pop() || '';
                        
                        if (lines.length > 0) {
                            terminalProcess.output.push(...lines);
                        }
                        
                        // 实时推送输出到前端
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
                        
                        // 实时推送错误输出到前端
                        emitTerminalOutput({
                            terminalId,
                            type: 'error',
                            data: text
                        });
                    });

                    // 进程结束时处理剩余的输出
                    proc.on('close', () => {
                        if (stdoutRemaining) {
                            terminalProcess.output.push(stdoutRemaining);
                        }
                        if (stderrRemaining) {
                            terminalProcess.output.push(stderrRemaining);
                        }
                    });

                    // 设置超时
                    let timeoutHandle: NodeJS.Timeout | undefined;
                    if (timeout > 0) {
                        timeoutHandle = setTimeout(() => {
                            proc.kill('SIGTERM');
                            terminalProcess.killed = true;
                            terminalProcess.error = `Command timed out after ${timeout}ms`;
                        }, timeout);
                    }

                    // 进程结束
                    proc.on('close', async (code) => {
                        if (timeoutHandle) {
                            clearTimeout(timeoutHandle);
                        }

                        terminalProcess.endTime = Date.now();
                        terminalProcess.exitCode = code ?? undefined;

                        // 从配置获取最大输出行数
                        const maxLines = getMaxOutputLines();
                        const lastOutput = maxLines === -1
                            ? terminalProcess.output
                            : getLastLines(terminalProcess.output, maxLines);
                        const duration = terminalProcess.endTime - terminalProcess.startTime;

                        // 从活动进程中移除
                        activeProcesses.delete(terminalId);
                        
                        // 使用 TaskManager 注销任务
                        const status = terminalProcess.killed ? 'cancelled' : (code === 0 ? 'completed' : 'error');
                        TaskManager.unregisterTask(terminalId, status, {
                            exitCode: code,
                            duration,
                            killed: terminalProcess.killed
                        });

                        // 检查是否是外部 abortSignal 触发的终止
                        const isExternalAbort = externalAbortSignal?.aborted && terminalProcess.killed;
                        
                        // 被用户杀死的进程也算成功（不显示错误）
                        const success = code === 0 || terminalProcess.killed === true;
                        
                        // 确定错误信息
                        let error: string | undefined;
                        if (isExternalAbort) {
                            // 外部取消（用户点击中断按钮）
                            error = 'User cancelled the command execution. Please wait for user\'s next instruction.';
                        } else if (terminalProcess.error) {
                            // 超时等系统错误
                            error = terminalProcess.error;
                        } else if (terminalProcess.killed) {
                            // 用户通过终端 UI 手动终止，不设置 error（成功状态）
                            error = undefined;
                        } else if (code !== 0 && code !== null) {
                            // 非零退出码
                            error = `Command exited with code ${code}`;
                        }

                        // 推送退出事件到前端
                        emitTerminalOutput({
                            terminalId,
                            type: 'exit',
                            exitCode: code ?? undefined,
                            killed: terminalProcess.killed,
                            duration
                        });

                        // 简化返回结构：AI 已知 command/cwd/shell，只需返回结果
                        // 如果输出被截断，返回截断元数据（便于 UI 提示）
                        const totalLines = terminalProcess.output.length;
                        const outputLines = lastOutput.length;
                        const wasTruncated = maxLines !== -1 && totalLines > outputLines;
                        const truncatedNote = wasTruncated
                            ? `(Output truncated: showing last ${outputLines} of ${totalLines} lines)`
                            : undefined;

                        // 尝试生成文件变更摘要（git 工作区），仅供 UI 展示（不会发送给模型）
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
                        } catch (e) {
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
                                // 前端需要这些用于 UI 显示，但 AI 不需要（会在 ConversationManager 中过滤）
                                terminalId,
                                command,
                                cwd: workingDir,
                                shell,
                                exitCode: code,
                                killed: terminalProcess.killed || false,
                                duration,
                                // AI 只需要 output 和 exitCode
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

                        // 从活动进程中移除
                        activeProcesses.delete(terminalId);
                        
                        // 使用 TaskManager 注销任务
                        TaskManager.unregisterTask(terminalId, 'error', {
                            error: err.message,
                            duration
                        });

                        // 推送错误退出事件
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
                                // 前端需要这些用于 UI 显示
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

/**
 * 杀掉终端进程
 * 同时支持直接调用和通过 TaskManager 取消
 *
 * 使用 tree-kill 库来跨平台终止进程树（包括所有子进程）
 * tree-kill 在 Windows 上使用 taskkill /T，在 Unix 上使用 SIGTERM/SIGKILL
 */
export function killTerminalProcess(terminalId: string): {
    success: boolean;
    output?: string;
    error?: string;
} {
    const terminalProcess = activeProcesses.get(terminalId);
    
    if (!terminalProcess) {
        // 尝试通过 TaskManager 取消（可能任务存在但进程已结束）
        const taskResult = TaskManager.cancelTask(terminalId);
        if (taskResult.success) {
            return { success: true };
        }
        return {
            success: false,
            error: `Terminal ${terminalId} not found or already exited`
        };
    }

    try {
        const pid = terminalProcess.process.pid;
        
        if (pid) {
            // 使用 tree-kill 终止进程树
            // tree-kill 会自动处理不同平台的差异：
            // - Windows: 使用 taskkill /F /T /PID
            // - Unix: 使用 ps 查找子进程并发送信号
            treeKill(pid, 'SIGTERM', (err) => {
                if (err) {
                    // 如果 tree-kill 失败，回退到直接终止进程
                    try {
                        terminalProcess.process.kill('SIGKILL');
                    } catch {
                        // 忽略错误，进程可能已经退出
                    }
                }
            });
        } else {
            // 没有 PID，使用默认方式
            terminalProcess.process.kill('SIGTERM');
        }
        
        terminalProcess.killed = true;
        terminalProcess.endTime = Date.now();

        const killMaxLines = getMaxOutputLines();
        const lastOutput = killMaxLines === -1
            ? terminalProcess.output
            : getLastLines(terminalProcess.output, killMaxLines);
        
        // TaskManager 会在 proc.on('close') 事件中自动注销
        
        return {
            success: true,
            output: lastOutput.join('\n')
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to kill terminal: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}

/**
 * 通过 TaskManager 取消终端任务
 * 这是统一的取消接口
 */
export function cancelTerminalTask(terminalId: string): {
    success: boolean;
    error?: string;
} {
    // 先尝试杀掉进程
    const killResult = killTerminalProcess(terminalId);
    if (killResult.success) {
        return { success: true };
    }
    
    // 如果进程不存在，尝试通过 TaskManager 取消
    return TaskManager.cancelTask(terminalId);
}

/**
 * 获取终端进程输出
 */
export function getTerminalOutput(terminalId: string): {
    success: boolean;
    output?: string;
    running?: boolean;
    error?: string;
} {
    const terminalProcess = activeProcesses.get(terminalId);
    
    if (!terminalProcess) {
        return {
            success: false,
            error: `Terminal ${terminalId} not found`
        };
    }

    const outputMaxLines = getMaxOutputLines();
    const lastOutput = outputMaxLines === -1
        ? terminalProcess.output
        : getLastLines(terminalProcess.output, outputMaxLines);
    
    return {
        success: true,
        output: lastOutput.join('\n'),
        running: terminalProcess.endTime === undefined
    };
}

/**
 * 获取所有活动终端
 */
export function getActiveTerminalProcesses(): Array<{
    id: string;
    command: string;
    cwd: string;
    shell: ShellType;
    running: boolean;
    startTime: number;
}> {
    const result = [];
    for (const [id, proc] of activeProcesses) {
        result.push({
            id,
            command: proc.command,
            cwd: proc.cwd,
            shell: proc.shell,
            running: proc.endTime === undefined,
            startTime: proc.startTime
        });
    }
    return result;
}

/**
 * 清理已完成的终端进程
 */
export function cleanupTerminals(): void {
    for (const [id, proc] of activeProcesses) {
        if (proc.endTime !== undefined) {
            activeProcesses.delete(id);
        }
    }
}

/**
 * 注册执行命令工具
 */
export function registerExecuteCommand(): Tool {
    return createExecuteCommandTool();
}

/**
 * 导出活动终端 Map（用于其他模块）
 */
export function getActiveTerminals(): Map<string, TerminalProcess> {
    return activeProcesses;
}
