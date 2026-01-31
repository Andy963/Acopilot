export interface StoragePathConfig {
    customDataPath?: string;
    lastMigrationAt?: number;
    migrationStatus?: 'none' | 'pending' | 'in_progress' | 'completed' | 'failed';
    migrationError?: string;
}

export interface StorageStats {
    path: string;
    totalSize: number;
    fileCount: number;
    subDirs: {
        conversations: { size: number; count: number };
        checkpoints: { size: number; count: number };
        mcp: { size: number; count: number };
        dependencies: { size: number; count: number };
        diffs: { size: number; count: number };
    };
}

