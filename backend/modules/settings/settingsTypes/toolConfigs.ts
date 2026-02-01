import { DEFAULT_EXECUTE_COMMAND_RISK_POLICY, type ExecuteCommandRiskPolicy } from '../../../core/commandRisk';

export interface ListFilesToolConfig {
    ignorePatterns: string[];
    [key: string]: unknown;
}

export interface FindFilesToolConfig {
    excludePatterns: string[];
    [key: string]: unknown;
}

export interface SearchInFilesToolConfig {
    excludePatterns: string[];
    [key: string]: unknown;
}

export interface ApplyDiffToolConfig {
    autoSave: boolean;
    autoSaveDelay: number;
    [key: string]: unknown;
}

export interface DeleteFileToolConfig {
    autoExecute: boolean;
    [key: string]: unknown;
}

export interface LocateToolConfig {
    model?: string;
    autoTriggerEnabled?: boolean;
    triggerKeywords?: string[];
    [key: string]: unknown;
}

export interface ShellConfig {
    type: 'powershell' | 'cmd' | 'bash' | 'zsh' | 'sh' | 'gitbash' | 'wsl';
    enabled: boolean;
    path?: string;
    displayName: string;
    available?: boolean;
    unavailableReason?: string;
}

export interface PostEditValidationPreset {
    id: string;
    label: string;
    command: string;
    cwd?: string;
    shell?: string;
    timeout?: number;
    kind?: 'build' | 'test' | 'lint' | 'custom';
    enabled?: boolean;
}

export interface PostEditValidationConfig {
    enabled: boolean;
    presets: PostEditValidationPreset[];
}

export interface ExecuteCommandToolConfig {
    defaultShell: string;
    shells: ShellConfig[];
    defaultTimeout: number;
    autoExecute?: boolean;
    maxOutputLines: number;
    riskPolicy?: ExecuteCommandRiskPolicy;
    postEditValidation?: PostEditValidationConfig;
    [key: string]: unknown;
}

export const COMMON_IGNORE_PATTERNS = [
    '.git',
    '.svn',
    '.hg',
    'node_modules',
    '__pycache__',
    '.venv',
    'venv',
    'vendor',
    '.idea',
    '.DS_Store',
    'Thumbs.db',
    'dist',
    'build',
    'out',
    '.next',
    '.nuxt',
    '.cache',
    '.turbo',
    '.parcel-cache',
    'coverage',
    '.nyc_output',
    'package-lock.json',
    'pnpm-lock.yaml',
    'yarn.lock',
    '*.pyc',
    '*.pyo',
    '*.class',
    '*.o',
    '*.obj',
    '*.log',
    '*.tmp',
    '*.temp',
    '*.swp',
    '*.swo'
];

export const DEFAULT_LIST_FILES_CONFIG: ListFilesToolConfig = {
    ignorePatterns: [...COMMON_IGNORE_PATTERNS]
};

export const DEFAULT_FIND_FILES_CONFIG: FindFilesToolConfig = {
    excludePatterns: [
        '**/node_modules/**',
        '**/.git/**',
        '**/.svn/**',
        '**/.hg/**',
        '**/__pycache__/**',
        '**/.venv/**',
        '**/venv/**',
        '**/vendor/**',
        '**/.idea/**',
        '**/dist/**',
        '**/build/**',
        '**/out/**',
        '**/.next/**',
        '**/.nuxt/**',
        '**/.cache/**',
        '**/.turbo/**',
        '**/coverage/**',
        '**/.nyc_output/**'
    ]
};

export const DEFAULT_SEARCH_IN_FILES_CONFIG: SearchInFilesToolConfig = {
    excludePatterns: [
        '**/node_modules/**',
        '**/.git/**',
        '**/.svn/**',
        '**/.hg/**',
        '**/__pycache__/**',
        '**/.venv/**',
        '**/venv/**',
        '**/vendor/**',
        '**/.idea/**',
        '**/dist/**',
        '**/build/**',
        '**/out/**',
        '**/.next/**',
        '**/.nuxt/**',
        '**/.cache/**',
        '**/.turbo/**',
        '**/coverage/**',
        '**/.nyc_output/**'
    ]
};

export const DEFAULT_APPLY_DIFF_CONFIG: ApplyDiffToolConfig = {
    autoSave: false,
    autoSaveDelay: 3000
};

export const DEFAULT_DELETE_FILE_CONFIG: DeleteFileToolConfig = {
    autoExecute: false
};

export const DEFAULT_LOCATE_TRIGGER_KEYWORDS = [
    'where is',
    "where's",
    'definition',
    'go to definition',
    'usages',
    'references',
    'open file',
    'open the file',
    'which file',
    'what file',
    '\u627e',
    '\u5b9a\u4f4d',
    '\u6253\u5f00',
    '\u5728\u54ea'
] as const;

export const DEFAULT_LOCATE_CONFIG: LocateToolConfig = {
    model: '',
    autoTriggerEnabled: true,
    triggerKeywords: [...DEFAULT_LOCATE_TRIGGER_KEYWORDS]
};

export function getDefaultExecuteCommandConfig(): ExecuteCommandToolConfig {
    const isWindows = process.platform === 'win32';
    const isMac = process.platform === 'darwin';

    const shells: ShellConfig[] = isWindows ? [
        { type: 'powershell', enabled: true, displayName: 'PowerShell' },
        { type: 'cmd', enabled: true, displayName: 'CMD' },
        { type: 'bash', enabled: true, displayName: 'Bash (Git)' },
        { type: 'sh', enabled: true, displayName: 'sh (Git)' },
        { type: 'gitbash', enabled: true, displayName: 'Git Bash' },
        { type: 'wsl', enabled: true, displayName: 'WSL' }
    ] : isMac ? [
        { type: 'zsh', enabled: true, displayName: 'Zsh' },
        { type: 'bash', enabled: true, displayName: 'Bash' },
        { type: 'sh', enabled: true, displayName: 'sh' }
    ] : [
        { type: 'bash', enabled: true, displayName: 'Bash' },
        { type: 'zsh', enabled: true, displayName: 'Zsh' },
        { type: 'sh', enabled: true, displayName: 'sh' }
    ];

    return {
        defaultShell: isWindows ? 'powershell' : (isMac ? 'zsh' : 'bash'),
        shells,
        defaultTimeout: 60000,
        autoExecute: false,
        maxOutputLines: 50,
        riskPolicy: DEFAULT_EXECUTE_COMMAND_RISK_POLICY,
        postEditValidation: {
            enabled: true,
            presets: []
        }
    };
}

export const DEFAULT_EXECUTE_COMMAND_CONFIG: ExecuteCommandToolConfig = getDefaultExecuteCommandConfig();
