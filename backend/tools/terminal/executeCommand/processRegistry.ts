import type { TerminalProcess } from './types';

import { TaskManager } from '../../taskManager';

import { getLastLines, getMaxOutputLines } from './utils';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const treeKill = require('tree-kill') as (pid: number, signal?: string, callback?: (error?: Error) => void) => void;

export const activeProcesses: Map<string, TerminalProcess> = new Map();

export function killTerminalProcess(terminalId: string): {
    success: boolean;
    output?: string;
    error?: string;
} {
    const terminalProcess = activeProcesses.get(terminalId);

    if (!terminalProcess) {
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
            treeKill(pid, 'SIGTERM', (err) => {
                if (err) {
                    try {
                        terminalProcess.process.kill('SIGKILL');
                    } catch {
                        // ignore
                    }
                }
            });
        } else {
            terminalProcess.process.kill('SIGTERM');
        }

        terminalProcess.killed = true;
        terminalProcess.endTime = Date.now();

        const killMaxLines = getMaxOutputLines();
        const lastOutput = killMaxLines === -1
            ? terminalProcess.output
            : getLastLines(terminalProcess.output, killMaxLines);

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

export function cancelTerminalTask(terminalId: string): {
    success: boolean;
    error?: string;
} {
    const killResult = killTerminalProcess(terminalId);
    if (killResult.success) {
        return { success: true };
    }

    return TaskManager.cancelTask(terminalId);
}

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

export function getActiveTerminalProcesses(): Array<{
    id: string;
    command: string;
    cwd: string;
    shell: TerminalProcess['shell'];
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

export function cleanupTerminals(): void {
    for (const [id, proc] of activeProcesses) {
        if (proc.endTime !== undefined) {
            activeProcesses.delete(id);
        }
    }
}

export function getActiveTerminals(): Map<string, TerminalProcess> {
    return activeProcesses;
}

