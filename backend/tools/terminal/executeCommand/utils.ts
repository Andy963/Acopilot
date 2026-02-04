import * as os from 'os';

import { getGlobalSettingsManager } from '../../../core/settingsContext';
import { getDefaultExecuteCommandConfig } from '../../../modules/settings';
import { TaskManager } from '../../taskManager';

export function getMaxOutputLines(): number {
    const settingsManager = getGlobalSettingsManager();
    const config = settingsManager?.getExecuteCommandConfig() || getDefaultExecuteCommandConfig();
    return config.maxOutputLines ?? 50;
}

export function generateTerminalId(): string {
    return TaskManager.generateTaskId('terminal');
}

export function getLastLines(lines: string[], n: number): string[] {
    if (lines.length <= n) {
        return lines;
    }
    return lines.slice(-n);
}

export function getOSName(): string {
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

