import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';

import { t } from '../../../i18n';
import { debugLog } from '../../../core/logger';

import { collectFilesAndDirsWithPatterns, loadAllGitignorePatterns } from '../checkpointFs';
import type { CheckpointRecord, FileChange } from '../checkpointTypes';

import type { ConversationManager } from '../../conversation/ConversationManager';
import type { SettingsManager } from '../../settings/SettingsManager';

export async function createCheckpoint(params: {
    settingsManager: SettingsManager;
    conversationManager: ConversationManager;
    checkpointsDir: string;
    conversationId: string;
    messageIndex: number;
    toolName: string;
    phase: 'before' | 'after';
    generateCheckpointId: () => string;
    getWorkspaceRoot: () => vscode.Uri | undefined;
    getCheckpoints: (conversationId: string) => Promise<CheckpointRecord[]>;
    computeChanges: (
        oldHashes: Record<string, string>,
        newHashes: Record<string, string>
    ) => { added: string[]; modified: string[]; deleted: string[] };
    saveCheckpointToConversation: (conversationId: string, checkpoint: CheckpointRecord) => Promise<void>;
    cleanupOldCheckpoints: (conversationId: string) => Promise<void>;
}): Promise<CheckpointRecord | null> {
    const {
        settingsManager,
        checkpointsDir,
        conversationId,
        messageIndex,
        toolName,
        phase,
        generateCheckpointId,
        getWorkspaceRoot,
        getCheckpoints,
        computeChanges,
        saveCheckpointToConversation,
        cleanupOldCheckpoints
    } = params;

    const config = settingsManager.getCheckpointConfig();
    if (!config.enabled) {
        return null;
    }

    let shouldCreate = false;

    if (toolName === 'user_message' || toolName === 'model_message') {
        const messageType = toolName === 'user_message' ? 'user' : 'model';
        if (phase === 'before') {
            shouldCreate = config.messageCheckpoint?.beforeMessages?.includes(messageType) ?? false;
        } else {
            shouldCreate = config.messageCheckpoint?.afterMessages?.includes(messageType) ?? false;
        }
    } else if (toolName === 'tool_batch') {
        if (phase === 'before') {
            shouldCreate = config.beforeTools.length > 0;
        } else {
            shouldCreate = config.afterTools.length > 0;
        }
    } else {
        shouldCreate = phase === 'before'
            ? config.beforeTools.includes(toolName)
            : config.afterTools.includes(toolName);
    }

    if (!shouldCreate) {
        return null;
    }

    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        console.warn('[CheckpointManager] No workspace root');
        return null;
    }

    try {
        const checkpointId = generateCheckpointId();
        const backupDir = path.join(checkpointsDir, checkpointId);

        await fs.mkdir(backupDir, { recursive: true });

        const ignorePatterns = await loadAllGitignorePatterns(workspaceRoot.fsPath, config.customIgnorePatterns);
        const { files, dirs } = await collectFilesAndDirsWithPatterns(workspaceRoot.fsPath, ignorePatterns);

        const currentHashes: Record<string, string> = {};
        const hashParts: string[] = [];
        const sortedFiles = [...files].sort();

        for (const file of sortedFiles) {
            try {
                const relativePath = path.relative(workspaceRoot.fsPath, file);
                const content = await fs.readFile(file);
                const fileHash = crypto.createHash('md5').update(content).digest('hex');
                currentHashes[relativePath] = fileHash;
                hashParts.push(`${relativePath}:${fileHash}`);
            } catch (err) {
                console.warn(`[CheckpointManager] Failed to hash ${file}:`, err);
            }
        }

        const currentEmptyDirs: string[] = [];
        for (const dir of dirs) {
            const relativePath = path.relative(workspaceRoot.fsPath, dir);
            currentEmptyDirs.push(relativePath);
            hashParts.push(`${relativePath}:empty-dir`);
        }
        currentEmptyDirs.sort();

        const contentHash = crypto.createHash('sha256')
            .update(hashParts.join('\n'))
            .digest('hex')
            .substring(0, 16);

        const existingCheckpoints = await getCheckpoints(conversationId);
        const lastCheckpoint = existingCheckpoints.length > 0
            ? existingCheckpoints[existingCheckpoints.length - 1]
            : null;

        let isIncremental = false;
        let baseCheckpointId: string | undefined;
        let changes: FileChange[] = [];
        let fileCount = 0;

        if (lastCheckpoint && lastCheckpoint.fileHashes) {
            const { added, modified, deleted } = computeChanges(
                lastCheckpoint.fileHashes,
                currentHashes
            );

            isIncremental = true;
            baseCheckpointId = lastCheckpoint.id;

            changes = [
                ...added.map(p => ({ path: p, type: 'added' as const, hash: currentHashes[p] })),
                ...modified.map(p => ({ path: p, type: 'modified' as const, hash: currentHashes[p] })),
                ...deleted.map(p => ({ path: p, type: 'deleted' as const }))
            ];

            for (const change of changes) {
                if (change.type === 'deleted') continue;

                const srcPath = path.join(workspaceRoot.fsPath, change.path);
                const destPath = path.join(backupDir, change.path);

                try {
                    await fs.mkdir(path.dirname(destPath), { recursive: true });
                    await fs.copyFile(srcPath, destPath);
                    fileCount++;
                } catch (err) {
                    console.warn(`[CheckpointManager] Failed to copy ${change.path}:`, err);
                }
            }

            debugLog(`[CheckpointManager] Incremental backup: ${added.length} added, ${modified.length} modified, ${deleted.length} deleted`);
        }

        if (!isIncremental) {
            for (const file of sortedFiles) {
                try {
                    const relativePath = path.relative(workspaceRoot.fsPath, file);
                    const destPath = path.join(backupDir, relativePath);

                    await fs.mkdir(path.dirname(destPath), { recursive: true });
                    await fs.copyFile(file, destPath);
                    fileCount++;
                } catch (err) {
                    console.warn(`[CheckpointManager] Failed to copy ${file}:`, err);
                }
            }

            for (const dir of dirs) {
                try {
                    const relativePath = path.relative(workspaceRoot.fsPath, dir);
                    const destPath = path.join(backupDir, relativePath);
                    await fs.mkdir(destPath, { recursive: true });
                } catch (err) {
                    console.warn(`[CheckpointManager] Failed to create empty dir ${dir}:`, err);
                }
            }

            debugLog(`[CheckpointManager] Full backup: ${fileCount} files`);
        }

        const phaseText = phase === 'before'
            ? t('modules.checkpoint.description.before')
            : t('modules.checkpoint.description.after');
        const checkpoint: CheckpointRecord = {
            id: checkpointId,
            conversationId,
            messageIndex,
            toolName,
            phase,
            timestamp: Date.now(),
            backupDir: checkpointId,
            fileCount,
            contentHash,
            description: `${phaseText}: ${toolName}`,
            type: isIncremental ? 'incremental' : 'full',
            baseCheckpointId: isIncremental ? baseCheckpointId : undefined,
            changes: isIncremental ? changes : undefined,
            fileHashes: currentHashes,
            emptyDirs: currentEmptyDirs
        };

        await saveCheckpointToConversation(conversationId, checkpoint);
        await cleanupOldCheckpoints(conversationId);

        return checkpoint;
    } catch (err) {
        console.error('[CheckpointManager] Failed to create checkpoint:', err);
        return null;
    }
}
