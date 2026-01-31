export interface FileChange {
    path: string;
    type: 'added' | 'modified' | 'deleted';
    hash?: string;
}

export interface CheckpointRecord {
    id: string;
    conversationId: string;
    messageIndex: number;
    toolName: string;
    phase: 'before' | 'after';
    timestamp: number;
    backupDir: string;
    fileCount: number;
    contentHash: string;
    description?: string;
    type?: 'full' | 'incremental';
    baseCheckpointId?: string;
    changes?: FileChange[];
    fileHashes?: Record<string, string>;
    emptyDirs?: string[];
}

