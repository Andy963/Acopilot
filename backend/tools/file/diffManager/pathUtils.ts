import * as fs from 'fs';
import * as path from 'path';

export function normalizeFsPath(fsPath: string): string {
    try {
        // `realpath` is more stable when symlinks / multiple representations exist.
        return fs.realpathSync.native(fsPath);
    } catch {
        return path.resolve(fsPath);
    }
}

export function isSameFsPath(a: string, b: string): boolean {
    const na = normalizeFsPath(a);
    const nb = normalizeFsPath(b);

    if (process.platform === 'win32') {
        return na.toLowerCase() === nb.toLowerCase();
    }

    return na === nb;
}

