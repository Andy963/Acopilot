import * as fs from 'fs/promises';
import * as path from 'path';

import { t } from '../../../i18n';

import type { ConversationManager } from '../../conversation/ConversationManager';
import type { CheckpointRecord } from '../checkpointTypes';

export interface ConversationCheckpointStats {
    conversationId: string;
    title: string;
    checkpointCount: number;
    totalSize: number;
    createdAt?: number;
    updatedAt?: number;
}

async function getDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;

    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);

            if (entry.isFile()) {
                const stats = await fs.stat(fullPath);
                totalSize += stats.size;
            } else if (entry.isDirectory()) {
                totalSize += await getDirectorySize(fullPath);
            }
        }
    } catch {
        // ignore unreadable directories
    }

    return totalSize;
}

export async function getAllConversationsWithCheckpoints(params: {
    conversationManager: ConversationManager;
    checkpointsDir: string;
}): Promise<ConversationCheckpointStats[]> {
    const { conversationManager, checkpointsDir } = params;

    const results: ConversationCheckpointStats[] = [];

    try {
        const conversationIds = await conversationManager.listConversations();

        for (const conversationId of conversationIds) {
            try {
                const metadata = await conversationManager.getMetadata(conversationId);
                const checkpoints = (metadata?.custom?.checkpoints as CheckpointRecord[]) || [];

                if (checkpoints.length > 0) {
                    let totalSize = 0;
                    for (const cp of checkpoints) {
                        const backupPath = path.join(checkpointsDir, cp.backupDir);
                        totalSize += await getDirectorySize(backupPath);
                    }

                    results.push({
                        conversationId,
                        title: metadata?.title || t('modules.checkpoint.defaultConversationTitle', { conversationId: conversationId.slice(0, 8) }),
                        checkpointCount: checkpoints.length,
                        totalSize,
                        createdAt: metadata?.createdAt,
                        updatedAt: metadata?.updatedAt
                    });
                }
            } catch {
                // ignore a single conversation's error
            }
        }

        results.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } catch (err) {
        console.error('[CheckpointManager] Failed to get all conversations with checkpoints:', err);
    }

    return results;
}

