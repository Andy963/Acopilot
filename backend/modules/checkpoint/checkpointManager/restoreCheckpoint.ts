import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

import { t } from '../../../i18n';
import { debugLog } from '../../../core/logger';

import { getDiffManager } from '../../../tools/file/diffManager';

import { cleanupEmptyDirsRecursive, collectFilesAndDirsWithPatterns, loadAllGitignorePatterns } from '../checkpointFs';
import type { CheckpointRecord } from '../checkpointTypes';
import { restoreCheckpointLegacy } from '../checkpointLegacyRestore';

import type { SettingsManager } from '../../settings/SettingsManager';

export async function restoreCheckpoint(params: {
    conversationId: string;
    checkpointId: string;
    checkpointsDir: string;
    settingsManager: SettingsManager;
    getWorkspaceRoot: () => vscode.Uri | undefined;
    getCheckpoints: (conversationId: string) => Promise<CheckpointRecord[]>;
    getFileHash: (filePath: string) => Promise<string | null>;
    refreshAffectedDocuments: (modifiedFiles: string[], deletedFiles: string[]) => Promise<void>;
    getIncrementalChain: (checkpoints: CheckpointRecord[], targetCheckpoint: CheckpointRecord) => CheckpointRecord[];
    computeChanges: (
        oldHashes: Record<string, string>,
        newHashes: Record<string, string>
    ) => { added: string[]; modified: string[]; deleted: string[] };
    findFileInChain: (chain: CheckpointRecord[], relativePath: string) => Promise<string | null>;
}): Promise<{ success: boolean; restored: number; deleted: number; skipped: number; error?: string }> {
    const {
        conversationId,
        checkpointId,
        checkpointsDir,
        settingsManager,
        getWorkspaceRoot,
        getCheckpoints,
        getFileHash,
        refreshAffectedDocuments,
        getIncrementalChain,
        computeChanges,
        findFileInChain
    } = params;

    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        return { success: false, restored: 0, deleted: 0, skipped: 0, error: 'No workspace root' };
    }

    try {
        const checkpoints = await getCheckpoints(conversationId);
        const checkpoint = checkpoints.find(cp => cp.id === checkpointId);

        if (!checkpoint) {
            return { success: false, restored: 0, deleted: 0, skipped: 0, error: 'Checkpoint not found' };
        }

        const config = settingsManager.getCheckpointConfig();

        try {
            const diffManager = getDiffManager();
            await diffManager.cancelAllPending();
        } catch (err) {
            console.warn('[CheckpointManager] Failed to cancel pending diffs:', err);
        }

        const targetHashes = checkpoint.fileHashes;

        if (!targetHashes) {
            return restoreCheckpointLegacy({
                checkpointsDir,
                workspaceRootFsPath: workspaceRoot.fsPath,
                checkpoint,
                customIgnorePatterns: config.customIgnorePatterns,
                getFileHash: (filePath) => getFileHash(filePath),
                refreshAffectedDocuments: (modifiedFiles, deletedFiles) => refreshAffectedDocuments(modifiedFiles, deletedFiles)
            });
        }

        const chain = getIncrementalChain(checkpoints, checkpoint);
        if (chain.length === 0) {
            return { success: false, restored: 0, deleted: 0, skipped: 0, error: 'Cannot build checkpoint chain' };
        }

        for (const cp of chain) {
            const backupPath = path.join(checkpointsDir, cp.backupDir);
            try {
                await fs.access(backupPath);
            } catch {
                return { success: false, restored: 0, deleted: 0, skipped: 0, error: `Backup directory not found: ${cp.backupDir}` };
            }
        }

        const ignorePatterns = await loadAllGitignorePatterns(workspaceRoot.fsPath, config.customIgnorePatterns);

        const { files: workspaceFiles } = await collectFilesAndDirsWithPatterns(workspaceRoot.fsPath, ignorePatterns);
        const currentHashes: Record<string, string> = {};
        for (const file of workspaceFiles) {
            const relativePath = path.relative(workspaceRoot.fsPath, file);
            const hash = await getFileHash(file);
            if (hash) {
                currentHashes[relativePath] = hash;
            }
        }

        let deleted = 0;
        let restored = 0;
        let skipped = 0;
        const modifiedFiles: string[] = [];
        const deletedFiles: string[] = [];

        const { added, modified, deleted: toDelete } = computeChanges(currentHashes, targetHashes);

        for (const relativePath of toDelete) {
            const fullPath = path.join(workspaceRoot.fsPath, relativePath);
            try {
                await fs.unlink(fullPath);
                deleted++;
                deletedFiles.push(fullPath);
            } catch (err) {
                console.warn(`[CheckpointManager] Failed to delete ${relativePath}:`, err);
            }
        }

        await cleanupEmptyDirsRecursive(workspaceRoot.fsPath, ignorePatterns);

        const filesToRestore = [...added, ...modified];
        for (const relativePath of filesToRestore) {
            const srcPath = await findFileInChain(chain, relativePath);

            if (!srcPath) {
                console.warn(`[CheckpointManager] Cannot find ${relativePath} in backup chain`);
                continue;
            }

            const destPath = path.join(workspaceRoot.fsPath, relativePath);

            try {
                const srcHash = await getFileHash(srcPath);
                if (srcHash !== targetHashes[relativePath]) {
                    console.warn(`[CheckpointManager] Hash mismatch for ${relativePath}`);
                    continue;
                }

                await fs.mkdir(path.dirname(destPath), { recursive: true });
                await fs.copyFile(srcPath, destPath);
                restored++;
                modifiedFiles.push(destPath);
            } catch (err) {
                console.warn(`[CheckpointManager] Failed to restore ${relativePath}:`, err);
            }
        }

        skipped = Object.keys(targetHashes).length - added.length - modified.length;

        const targetEmptyDirs = checkpoint.emptyDirs || [];
        for (const relativePath of targetEmptyDirs) {
            try {
                const destPath = path.join(workspaceRoot.fsPath, relativePath);
                await fs.mkdir(destPath, { recursive: true });
            } catch (err) {
                console.warn(`[CheckpointManager] Failed to restore empty dir ${relativePath}:`, err);
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

        debugLog(`[CheckpointManager] Restore from chain: ${chain.length} checkpoints, restored=${restored}, deleted=${deleted}, skipped=${skipped}`);

        return { success: true, restored, deleted, skipped };
    } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error';
        console.error('[CheckpointManager] Failed to restore checkpoint:', err);
        return { success: false, restored: 0, deleted: 0, skipped: 0, error };
    }
}
