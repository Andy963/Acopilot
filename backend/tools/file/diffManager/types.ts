export interface PendingDiff {
    id: string;
    toolId?: string;
    filePath: string;
    absolutePath: string;
    originalContent: string;
    newContent: string;
    timestamp: number;
    status: 'pending' | 'accepted' | 'rejected';
}

export interface DiffSettings {
    autoSave: boolean;
    autoSaveDelay: number;
}

export type StatusChangeListener = (pending: PendingDiff[], allProcessed: boolean) => void;

export type DiffSaveListener = (diff: PendingDiff) => void;

