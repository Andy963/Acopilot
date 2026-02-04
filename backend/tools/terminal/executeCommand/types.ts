import type * as cp from 'child_process';

import type { ShellType } from '../executeCommandShells';

export interface TerminalProcess {
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

export interface TerminalOutputEvent {
    terminalId: string;
    type: 'start' | 'output' | 'error' | 'exit';
    data?: string;
    command?: string;
    cwd?: string;
    shell?: string;
    exitCode?: number;
    killed?: boolean;
    duration?: number;
}

