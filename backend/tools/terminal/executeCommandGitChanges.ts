import * as cp from 'child_process';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { getDiffStorageManager } from '../../modules/conversation/DiffStorageManager';
import { isBinaryFile, toRelativePath } from '../utils';

const MAX_CHANGED_FILES = 20;
const MAX_FILE_BYTES = 200 * 1024;
const EXCLUDED_PREFIXES = [
    '.git/',
    'node_modules/',
    'dist/',
    'build/',
    'out/',
    '.next/',
    '.turbo/',
    '.pnpm-store/'
];

type ExecuteCommandFileAction = 'created' | 'modified' | 'deleted' | 'renamed';

export interface ExecuteCommandChangedFile {
    path: string;
    action: ExecuteCommandFileAction;
    fromPath?: string;
    diffContentId?: string | null;
    skippedReason?: string | null;
}

export interface ExecuteCommandChangesSummary {
    totalFiles: number;
    diffAvailableFiles: number;
    skippedFiles: number;
    truncatedFiles?: number;
    unsupportedReason?: string;
}

type ParsedGitStatusEntry = {
    status: string;
    repoPath: string;
    fromRepoPath?: string;
};

function normalizeRepoPath(p: string): string {
    return String(p || '').replace(/\\/g, '/').replace(/^\.\/+/, '');
}

function isExcludedRepoPath(repoPath: string): boolean {
    const normalized = normalizeRepoPath(repoPath);
    return EXCLUDED_PREFIXES.some(prefix => normalized === prefix.slice(0, -1) || normalized.startsWith(prefix));
}

function mapGitStatusToAction(status: string): ExecuteCommandFileAction {
    const x = status[0] || ' ';
    const y = status[1] || ' ';

    if (x === 'R' || y === 'R') return 'renamed';
    if (x === 'C' || y === 'C') return 'created';
    if (x === 'D' || y === 'D') return 'deleted';
    if (x === 'A' || y === 'A' || x === '?' || y === '?') return 'created';

    return 'modified';
}

async function execFileBuffer(file: string, args: string[], options: cp.ExecFileOptions): Promise<Buffer> {
    return await new Promise((resolve, reject) => {
        cp.execFile(file, args, { ...options, encoding: 'buffer' }, (err, stdout) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(stdout as unknown as Buffer);
        });
    });
}

async function execFileText(file: string, args: string[], options: cp.ExecFileOptions): Promise<string> {
    return await new Promise((resolve, reject) => {
        cp.execFile(file, args, { ...options, encoding: 'utf8' }, (err, stdout) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(String(stdout || ''));
        });
    });
}

async function getGitRepoRoot(cwd: string): Promise<string | null> {
    try {
        const out = await execFileText('git', ['rev-parse', '--show-toplevel'], { cwd });
        const cleaned = out.replace(/\r?\n/g, '').trim();
        return cleaned || null;
    } catch {
        return null;
    }
}

function parseGitStatusPorcelainZ(buf: Buffer): ParsedGitStatusEntry[] {
    const text = buf.toString('utf8');
    if (!text) return [];

    const parts = text.split('\0').filter(Boolean);
    const out: ParsedGitStatusEntry[] = [];

    for (let i = 0; i < parts.length; i++) {
        const entry = parts[i];
        if (entry.length < 4) continue;

        const status = entry.slice(0, 2);
        const repoPath = entry.slice(3);

        const x = status[0] || ' ';
        const y = status[1] || ' ';
        if (x === 'R' || y === 'R' || x === 'C' || y === 'C') {
            const toPath = parts[i + 1];
            if (toPath) {
                out.push({ status, repoPath: toPath, fromRepoPath: repoPath });
                i += 1;
                continue;
            }
        }

        out.push({ status, repoPath });
    }

    return out;
}

async function getGitHeadBlobSize(repoRoot: string, repoPath: string): Promise<number | null> {
    const normalized = normalizeRepoPath(repoPath);
    if (!normalized) return null;

    try {
        const out = await execFileText('git', ['cat-file', '-s', `HEAD:${normalized}`], { cwd: repoRoot });
        const size = Number(String(out || '').trim());
        return Number.isFinite(size) && size >= 0 ? size : null;
    } catch {
        return null;
    }
}

async function readGitHeadFile(repoRoot: string, repoPath: string): Promise<string | null> {
    const normalized = normalizeRepoPath(repoPath);
    if (!normalized) return null;

    try {
        const out = await execFileText('git', ['show', `HEAD:${normalized}`], { cwd: repoRoot });
        return out ?? '';
    } catch {
        return null;
    }
}

async function readWorkspaceFileText(absolutePath: string): Promise<string | null> {
    try {
        return await fs.promises.readFile(absolutePath, 'utf8');
    } catch {
        return null;
    }
}

export async function collectExecuteCommandChangedFiles(
    workingDir: string
): Promise<{ changedFiles: ExecuteCommandChangedFile[]; summary: ExecuteCommandChangesSummary }> {
    const repoRoot = await getGitRepoRoot(workingDir);
    if (!repoRoot) {
        return {
            changedFiles: [],
            summary: {
                totalFiles: 0,
                diffAvailableFiles: 0,
                skippedFiles: 0,
                unsupportedReason: 'not a git repository'
            }
        };
    }

    let statusBuf: Buffer;
    try {
        statusBuf = await execFileBuffer('git', ['status', '--porcelain=v1', '-z'], { cwd: repoRoot });
    } catch {
        return {
            changedFiles: [],
            summary: {
                totalFiles: 0,
                diffAvailableFiles: 0,
                skippedFiles: 0,
                unsupportedReason: 'failed to read git status'
            }
        };
    }

    const entries = parseGitStatusPorcelainZ(statusBuf)
        .map(e => ({
            ...e,
            repoPath: normalizeRepoPath(e.repoPath),
            fromRepoPath: e.fromRepoPath ? normalizeRepoPath(e.fromRepoPath) : undefined
        }))
        .filter(e => e.repoPath && !isExcludedRepoPath(e.repoPath));

    entries.sort((a, b) => {
        if (a.repoPath !== b.repoPath) return a.repoPath < b.repoPath ? -1 : 1;
        return a.status.localeCompare(b.status);
    });

    const totalFiles = entries.length;
    const truncatedFiles = totalFiles > MAX_CHANGED_FILES ? totalFiles - MAX_CHANGED_FILES : 0;
    const listed = entries.slice(0, MAX_CHANGED_FILES);

    const diffStorageManager = getDiffStorageManager();

    const changedFiles: ExecuteCommandChangedFile[] = [];
    let diffAvailableFiles = 0;
    let skippedFiles = 0;

    for (const entry of listed) {
        const repoPath = entry.repoPath;
        const fromRepoPath = entry.fromRepoPath;
        const action = mapGitStatusToAction(entry.status);

        const absPath = path.join(repoRoot, repoPath);
        const relativePathForUi = toRelativePath(absPath, true);
        const fromPathForUi = fromRepoPath ? toRelativePath(path.join(repoRoot, fromRepoPath), true) : undefined;

        const file: ExecuteCommandChangedFile = {
            path: relativePathForUi,
            action,
            fromPath: fromPathForUi || undefined,
            diffContentId: null,
            skippedReason: null
        };

        if (!diffStorageManager) {
            file.skippedReason = 'diff storage not available';
            skippedFiles += 1;
            changedFiles.push(file);
            continue;
        }

        if (isBinaryFile(repoPath)) {
            file.skippedReason = 'binary file';
            skippedFiles += 1;
            changedFiles.push(file);
            continue;
        }

        const afterStat = await fs.promises.stat(absPath).catch(() => null);
        const afterSize = afterStat?.isFile() ? afterStat.size : null;

        const headRepoPath = action === 'renamed' && fromRepoPath ? fromRepoPath : repoPath;
        const headSize = await getGitHeadBlobSize(repoRoot, headRepoPath);

        if ((afterSize !== null && afterSize > MAX_FILE_BYTES) || (headSize !== null && headSize > MAX_FILE_BYTES)) {
            file.skippedReason = 'file too large';
            skippedFiles += 1;
            changedFiles.push(file);
            continue;
        }

        const originalContent = action === 'created' ? '' : (await readGitHeadFile(repoRoot, headRepoPath)) ?? '';
        const newContent = action === 'deleted' ? '' : (await readWorkspaceFileText(absPath)) ?? '';

        if (!originalContent && !newContent) {
            file.skippedReason = 'cannot read file content';
            skippedFiles += 1;
            changedFiles.push(file);
            continue;
        }

        try {
            const diffRef = await diffStorageManager.saveGlobalDiff({
                originalContent,
                newContent,
                filePath: relativePathForUi
            });
            file.diffContentId = diffRef.diffId;
            diffAvailableFiles += 1;
        } catch {
            file.skippedReason = 'failed to save diff';
            skippedFiles += 1;
        }

        changedFiles.push(file);
    }

    const summary: ExecuteCommandChangesSummary = {
        totalFiles,
        diffAvailableFiles,
        skippedFiles
    };
    if (truncatedFiles > 0) {
        summary.truncatedFiles = truncatedFiles;
    }

    return { changedFiles, summary };
}

export async function getGitChangesFingerprint(workingDir: string): Promise<string | null> {
    const repoRoot = await getGitRepoRoot(workingDir);
    if (!repoRoot) return null;

    try {
        const statusBuf = await execFileBuffer('git', ['status', '--porcelain=v1', '-z'], { cwd: repoRoot });
        const diffNumstatBuf = await execFileBuffer('git', ['diff', '--numstat'], { cwd: repoRoot });
        const diffCachedNumstatBuf = await execFileBuffer('git', ['diff', '--cached', '--numstat'], { cwd: repoRoot });

        const hash = createHash('sha1');
        hash.update(statusBuf);
        hash.update(diffNumstatBuf);
        hash.update(diffCachedNumstatBuf);
        return hash.digest('hex');
    } catch {
        return null;
    }
}

