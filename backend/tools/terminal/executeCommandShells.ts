import * as cp from 'child_process';
import * as os from 'os';

import { t } from '../../i18n';
import { getGlobalSettingsManager } from '../../core/settingsContext';
import { getDefaultExecuteCommandConfig } from '../../modules/settings';

export type ShellType = 'default' | 'powershell' | 'cmd' | 'bash' | 'zsh' | 'sh' | 'gitbash' | 'wsl';

export function getShellConfig(shellType: ShellType): {
    shell: string;
    shellArgs?: string[];
    prependCommand?: string;
} {
    const platform = os.platform();
    const settingsManager = getGlobalSettingsManager();
    const config = settingsManager?.getExecuteCommandConfig() || getDefaultExecuteCommandConfig();

    let actualShellType = shellType;
    if (shellType === 'default') {
        actualShellType = config.defaultShell as ShellType;
    }

    const shellConfig = config.shells.find(s => s.type === actualShellType);
    const customPath = shellConfig?.path;

    switch (actualShellType) {
        case 'powershell':
            if (platform === 'win32') {
                return {
                    shell: customPath || 'powershell.exe',
                    shellArgs: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command'],
                    prependCommand: '$OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::InputEncoding = [System.Text.Encoding]::UTF8;'
                };
            }
            return { shell: customPath || 'pwsh', shellArgs: ['-NoProfile', '-Command'] };

        case 'cmd':
            if (platform === 'win32') {
                return {
                    shell: customPath || 'cmd.exe',
                    shellArgs: ['/s', '/c'],
                    prependCommand: 'chcp 65001 >nul &&'
                };
            }
            return {
                shell: customPath || 'cmd.exe',
                shellArgs: ['/s', '/c'],
                prependCommand: 'chcp 65001 >nul &&'
            };

        case 'bash':
            if (platform === 'win32') {
                return { shell: customPath || 'bash.exe', shellArgs: ['-c'] };
            }
            return { shell: customPath || '/bin/bash', shellArgs: ['-c'] };

        case 'zsh':
            if (platform === 'win32') {
                return {
                    shell: 'powershell.exe',
                    shellArgs: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command'],
                    prependCommand: '$OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::InputEncoding = [System.Text.Encoding]::UTF8;'
                };
            }
            return { shell: customPath || '/bin/zsh', shellArgs: ['-c'] };

        case 'sh':
            if (platform === 'win32') {
                return { shell: customPath || 'sh.exe', shellArgs: ['-c'] };
            }
            return { shell: customPath || '/bin/sh', shellArgs: ['-c'] };

        case 'gitbash':
            return { shell: customPath || 'bash.exe', shellArgs: ['-c'] };

        case 'wsl':
            return { shell: 'wsl.exe', shellArgs: ['--', 'bash', '-c'] };

        default:
            if (platform === 'win32') {
                return {
                    shell: 'powershell.exe',
                    shellArgs: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command'],
                    prependCommand: '$OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::InputEncoding = [System.Text.Encoding]::UTF8;'
                };
            }
            return { shell: '/bin/sh', shellArgs: ['-c'] };
    }
}

export function getEnabledShellTypes(): string[] {
    const settingsManager = getGlobalSettingsManager();
    const config = settingsManager?.getExecuteCommandConfig() || getDefaultExecuteCommandConfig();
    return config.shells.filter(s => s.enabled).map(s => s.type);
}

function getDefaultShellPath(shellType: string): string {
    const platform = os.platform();
    switch (shellType) {
        case 'powershell':
            return platform === 'win32' ? 'powershell.exe' : 'pwsh';
        case 'cmd':
            return 'cmd.exe';
        case 'bash':
            return platform === 'win32' ? 'bash.exe' : '/bin/bash';
        case 'zsh':
            return platform === 'win32' ? 'zsh.exe' : '/bin/zsh';
        case 'sh':
            return platform === 'win32' ? 'sh.exe' : '/bin/sh';
        case 'gitbash':
            return 'bash.exe';
        case 'wsl':
            return 'wsl.exe';
        default:
            return shellType;
    }
}

export async function checkShellAvailability(shellType: string, customPath?: string): Promise<{
    available: boolean;
    reason?: string;
}> {
    const platform = os.platform();
    const shellPath = customPath || getDefaultShellPath(shellType);

    if (platform === 'win32') {
        if (shellType === 'wsl') {
            return new Promise((resolve) => {
                cp.execFile('wsl.exe', ['--status'], { timeout: 5000 }, (error) => {
                    if (error) {
                        resolve({ available: false, reason: t('tools.terminal.shellCheck.wslNotInstalled') });
                    } else {
                        resolve({ available: true });
                    }
                });
            });
        }

        if (shellPath.includes('\\') || shellPath.includes('/')) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const fs = require('fs');
            try {
                fs.accessSync(shellPath, fs.constants.X_OK);
                return { available: true };
            } catch {
                return { available: false, reason: t('tools.terminal.shellCheck.shellNotFound', { shellPath }) };
            }
        }

        return new Promise((resolve) => {
            cp.execFile('where.exe', [shellPath], { timeout: 5000 }, (error) => {
                if (error) {
                    resolve({ available: false, reason: t('tools.terminal.shellCheck.shellNotInPath', { shellPath }) });
                } else {
                    resolve({ available: true });
                }
            });
        });
    }

    if (shellPath.startsWith('/')) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const fs = require('fs');
        try {
            fs.accessSync(shellPath, fs.constants.X_OK);
            return { available: true };
        } catch {
            return { available: false, reason: t('tools.terminal.shellCheck.shellNotFound', { shellPath }) };
        }
    }

    return new Promise((resolve) => {
        cp.execFile('which', [shellPath], { timeout: 5000 }, (error) => {
            if (error) {
                resolve({ available: false, reason: t('tools.terminal.shellCheck.shellNotInPath', { shellPath }) });
            } else {
                resolve({ available: true });
            }
        });
    });
}

export async function checkAllShellsAvailability(shells: Array<{ type: string; path?: string }>): Promise<Map<string, { available: boolean; reason?: string }>> {
    const results = new Map<string, { available: boolean; reason?: string }>();

    await Promise.all(
        shells.map(async (shell) => {
            const result = await checkShellAvailability(shell.type, shell.path);
            results.set(shell.type, result);
        })
    );

    return results;
}

function checkShellAvailabilitySync(shellType: string, customPath?: string): boolean {
    const platform = os.platform();
    const shellPath = customPath || getDefaultShellPath(shellType);

    try {
        if (platform === 'win32') {
            if (shellType === 'wsl') {
                cp.execFileSync('wsl.exe', ['--status'], { timeout: 3000, stdio: 'ignore' });
                return true;
            }

            if (shellPath.includes('\\') || shellPath.includes('/')) {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const fs = require('fs');
                fs.accessSync(shellPath, fs.constants.X_OK);
                return true;
            }

            cp.execFileSync('where.exe', [shellPath], { timeout: 3000, stdio: 'ignore' });
            return true;
        }

        if (shellPath.startsWith('/')) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const fs = require('fs');
            fs.accessSync(shellPath, fs.constants.X_OK);
            return true;
        }

        cp.execFileSync('which', [shellPath], { timeout: 3000, stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

function getAvailableShells(): Array<{ type: string; displayName: string; isDefault: boolean }> {
    const settingsManager = getGlobalSettingsManager();
    const config = settingsManager?.getExecuteCommandConfig() || getDefaultExecuteCommandConfig();

    return config.shells
        .filter(s => s.enabled && checkShellAvailabilitySync(s.type, s.path))
        .map(s => ({
            type: s.type,
            displayName: s.displayName,
            isDefault: s.type === config.defaultShell
        }));
}

export function getAvailableShellsDescription(): string {
    const availableShells = getAvailableShells();

    if (availableShells.length === 0) {
        return '- No available Shell';
    }

    return availableShells
        .map(s => `- ${s.type}: ${s.displayName}${s.isDefault ? ' (default)' : ''}`)
        .join('\n');
}

export function getDefaultShellName(): string {
    const settingsManager = getGlobalSettingsManager();
    const config = settingsManager?.getExecuteCommandConfig() || getDefaultExecuteCommandConfig();
    const defaultShell = config.shells.find(s => s.type === config.defaultShell);
    return defaultShell?.displayName || config.defaultShell;
}

export function getEnabledShellTypesForEnum(): string[] {
    const availableShells = getAvailableShells();
    const types = availableShells.map(s => s.type);
    return ['default', ...types];
}

