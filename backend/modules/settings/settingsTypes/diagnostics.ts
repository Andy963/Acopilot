export type DiagnosticSeverity = 'error' | 'warning' | 'information' | 'hint';

export interface DiagnosticsConfig {
    enabled: boolean;
    includeSeverities: DiagnosticSeverity[];
    workspaceOnly: boolean;
    openFilesOnly: boolean;
    maxDiagnosticsPerFile: number;
    maxFiles: number;
    [key: string]: unknown;
}

export const DEFAULT_DIAGNOSTICS_CONFIG: DiagnosticsConfig = {
    enabled: true,
    includeSeverities: ['error', 'warning'],
    workspaceOnly: true,
    openFilesOnly: false,
    maxDiagnosticsPerFile: 10,
    maxFiles: 20
};

