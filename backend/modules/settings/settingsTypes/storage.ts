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
<<<<<<< HEAD
=======
        mcp: { size: number; count: number };
>>>>>>> f327a97 (merge: dev into main for v1.2.0)
        dependencies: { size: number; count: number };
        diffs: { size: number; count: number };
    };
}
<<<<<<< HEAD
=======

>>>>>>> f327a97 (merge: dev into main for v1.2.0)
