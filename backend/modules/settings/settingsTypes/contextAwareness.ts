import type { DiagnosticsConfig } from './diagnostics';
import { DEFAULT_DIAGNOSTICS_CONFIG } from './diagnostics';
import { COMMON_IGNORE_PATTERNS } from './toolConfigs';

export interface ContextAwarenessConfig {
    includeWorkspaceFiles: boolean;
    maxFileDepth: number;
    includeOpenTabs: boolean;
    maxOpenTabs: number;
    includeActiveEditor: boolean;
    diagnostics?: DiagnosticsConfig;
    ignorePatterns: string[];
    [key: string]: unknown;
}

export const DEFAULT_CONTEXT_AWARENESS_CONFIG: ContextAwarenessConfig = {
    includeWorkspaceFiles: true,
    maxFileDepth: 2,
    includeOpenTabs: false,
    maxOpenTabs: 20,
    includeActiveEditor: true,
    diagnostics: DEFAULT_DIAGNOSTICS_CONFIG,
    ignorePatterns: [...COMMON_IGNORE_PATTERNS]
};

