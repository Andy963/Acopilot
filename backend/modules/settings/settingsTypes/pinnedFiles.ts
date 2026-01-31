export interface PinnedFileItem {
    id: string;
    path: string;
    workspaceUri: string;
    enabled: boolean;
    addedAt: number;
}

export interface PinnedFilesConfig {
    files: PinnedFileItem[];
    sectionTitle: string;
    [key: string]: unknown;
}

export const DEFAULT_PINNED_FILES_CONFIG: PinnedFilesConfig = {
    files: [],
    sectionTitle: 'PINNED FILES CONTENT'
};

