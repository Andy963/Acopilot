import { t } from '../../i18n';

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

import type { CheckpointRecord } from './checkpointTypes';
import { cleanupEmptyDirsRecursive, collectFilesAndDirsWithPatterns, loadAllGitignorePatterns } from './checkpointFs';

export async function restoreCheckpointLegacy(params: {
    checkpointsDir: string;
    workspaceRootFsPath: string;
    checkpoint: CheckpointRecord;
    customIgnorePatterns?: string[];
    getFileHash: (filePath: string) => Promise<string | null>;
    refreshAffectedDocuments: (modifiedFiles: string[], deletedFiles: string[]) => Promise<void>;
}): Promise<{ success: boolean; restored: number; deleted: number; skipped: number; error?: string }> {
    const { checkpointsDir, workspaceRootFsPath, checkpoint, customIgnorePatterns, getFileHash, refreshAffectedDocuments } = params;

    const backupPath = path.join(checkpointsDir, checkpoint.backupDir);

    try {
        await fs.access(backupPath);
    } catch {
        return { success: false, restored: 0, deleted: 0, skipped: 0, error: 'Backup directory not found' };
    }

    const ignorePatterns = await loadAllGitignorePatterns(backupPath, customIgnorePatterns);

    const { files: backupFiles, dirs: backupDirs } = await collectFilesAndDirsWithPatterns(backupPath, ignorePatterns);
    const backupRelativePaths = new Set(backupFiles.map(f => path.relative(backupPath, f)));

    const { files: workspaceFiles } = await collectFilesAndDirsWithPatterns(workspaceRootFsPath, ignorePatterns);
    const workspaceRelativePaths = new Set(workspaceFiles.map(f => path.relative(workspaceRootFsPath, f)));

    let deleted = 0;
    let restored = 0;
    let skipped = 0;
    const modifiedFiles: string[] = [];
    const deletedFiles: string[] = [];

    for (const file of workspaceFiles) {
        const relativePath = path.relative(workspaceRootFsPath, file);
        if (!backupRelativePaths.has(relativePath)) {
            try {
                await fs.unlink(file);
                deleted++;
                deletedFiles.push(file);
            } catch (err) {
                console.warn(`[CheckpointManager] Failed to delete ${relativePath}:`, err);
            }
        }
    }

    await cleanupEmptyDirsRecursive(workspaceRootFsPath, ignorePatterns);

    for (const backupFile of backupFiles) {
        const relativePath = path.relative(backupPath, backupFile);
        const destPath = path.join(workspaceRootFsPath, relativePath);

        try {
            if (workspaceRelativePaths.has(relativePath)) {
                const backupHash = await getFileHash(backupFile);
                const workspaceHash = await getFileHash(destPath);

                if (backupHash && workspaceHash && backupHash === workspaceHash) {
                    skipped++;
                    continue;
                }
            }

            await fs.mkdir(path.dirname(destPath), { recursive: true });
            await fs.copyFile(backupFile, destPath);
            restored++;
            modifiedFiles.push(destPath);
        } catch (err) {
            console.warn(`[CheckpointManager] Failed to restore ${backupFile}:`, err);
        }
    }

    for (const dir of backupDirs) {
        try {
            const relativePath = path.relative(backupPath, dir);
            const destPath = path.join(workspaceRootFsPath, relativePath);
            await fs.mkdir(destPath, { recursive: true });
        } catch (err) {
            console.warn(`[CheckpointManager] Failed to restore empty dir ${dir}:`, err);
        }
    }

    await refreshAffectedDocuments(modifiedFiles, deletedFiles);

    const phaseText = checkpoint.phase === 'before'
        ? t('modules.checkpoint.description.before')
        : t('modules.checkpoint.description.after');
    let message = `$(check) ${t('modules.checkpoint.restore.success', { toolName: checkpoint.toolName, phase: phaseText })}`;
    const details: string[] = [];
    if (restored > 0) details.push(t('modules.checkpoint.restore.filesUpdated', { count: restored }));
    if (deleted > 0) details.push(t('modules.checkpoint.restore.filesDeleted', { count: deleted }));
    if (skipped > 0) details.push(t('modules.checkpoint.restore.filesUnchanged', { count: skipped }));
    if (details.length > 0) {
        message += ` (${details.join(', ')})`;
    }
    vscode.window.setStatusBarMessage(message, 5000);

    return { success: true, restored, deleted, skipped };
}
