import type { ToolsConfig } from './toolsConfig';
import {
    DEFAULT_APPLY_DIFF_CONFIG,
    DEFAULT_DELETE_FILE_CONFIG,
    DEFAULT_FIND_FILES_CONFIG,
    DEFAULT_LIST_FILES_CONFIG,
    DEFAULT_LOCATE_CONFIG,
    DEFAULT_SEARCH_IN_FILES_CONFIG,
    getDefaultExecuteCommandConfig
} from './toolConfigs';
import { DEFAULT_CHECKPOINT_CONFIG } from './checkpoints';
import { DEFAULT_CONTEXT_AWARENESS_CONFIG } from './contextAwareness';
import {
    DEFAULT_CROP_IMAGE_CONFIG,
    DEFAULT_GENERATE_IMAGE_CONFIG,
    DEFAULT_REMOVE_BACKGROUND_CONFIG,
    DEFAULT_RESIZE_IMAGE_CONFIG,
    DEFAULT_ROTATE_IMAGE_CONFIG
} from './mediaTools';
import { DEFAULT_PINNED_FILES_CONFIG } from './pinnedFiles';
import { DEFAULT_SYSTEM_PROMPT_CONFIG } from './prompting';
import { DEFAULT_SUMMARIZE_CONFIG } from './summarize';
import { DEFAULT_TOKEN_COUNT_CONFIG } from './tokenCount';
import type { StoragePathConfig } from './storage';

export interface ToolsEnabledState {
    [toolName: string]: boolean;
}

export interface ToolAutoExecConfig {
    [toolName: string]: boolean;
}

export interface ProxySettings {
    enabled: boolean;
    url?: string;
}

export interface GlobalSettings {
    storagePath?: StoragePathConfig;
    activeChannelId?: string;
    maxToolIterations?: number;
    toolsEnabled: ToolsEnabledState;
    toolAutoExec?: ToolAutoExecConfig;
    toolsConfig?: ToolsConfig;
    defaultToolMode?: 'function_call' | 'xml';
    proxy?: ProxySettings;
    ui?: {
        theme?: 'light' | 'dark' | 'auto';
        language?: string;
    };
    lastUpdated: number;
}

export interface SettingsChangeEvent {
    type: 'channel' | 'tools' | 'toolMode' | 'proxy' | 'ui' | 'full';
    path?: string;
    oldValue?: any;
    newValue?: any;
    settings: GlobalSettings;
}

export type SettingsChangeListener = (event: SettingsChangeEvent) => void | Promise<void>;

export const DEFAULT_TOOL_AUTO_EXEC_CONFIG: ToolAutoExecConfig = {
    delete_file: false,
    execute_command: false
};

export const DEFAULT_MAX_TOOL_ITERATIONS = 50;

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
    maxToolIterations: DEFAULT_MAX_TOOL_ITERATIONS,
    toolsEnabled: {},
    toolAutoExec: DEFAULT_TOOL_AUTO_EXEC_CONFIG,
    toolsConfig: {
        list_files: DEFAULT_LIST_FILES_CONFIG,
        find_files: DEFAULT_FIND_FILES_CONFIG,
        search_in_files: DEFAULT_SEARCH_IN_FILES_CONFIG,
        locate: DEFAULT_LOCATE_CONFIG,
        apply_diff: DEFAULT_APPLY_DIFF_CONFIG,
        delete_file: DEFAULT_DELETE_FILE_CONFIG,
        execute_command: getDefaultExecuteCommandConfig(),
        checkpoint: DEFAULT_CHECKPOINT_CONFIG,
        summarize: DEFAULT_SUMMARIZE_CONFIG,
        generate_image: DEFAULT_GENERATE_IMAGE_CONFIG,
        remove_background: DEFAULT_REMOVE_BACKGROUND_CONFIG,
        crop_image: DEFAULT_CROP_IMAGE_CONFIG,
        resize_image: DEFAULT_RESIZE_IMAGE_CONFIG,
        rotate_image: DEFAULT_ROTATE_IMAGE_CONFIG,
        context_awareness: DEFAULT_CONTEXT_AWARENESS_CONFIG,
        pinned_files: DEFAULT_PINNED_FILES_CONFIG,
        system_prompt: DEFAULT_SYSTEM_PROMPT_CONFIG,
        token_count: DEFAULT_TOKEN_COUNT_CONFIG
    },
    defaultToolMode: 'function_call',
    proxy: {
        enabled: false,
        url: undefined
    },
    ui: {
        theme: 'auto',
        language: 'zh-CN'
    },
    lastUpdated: Date.now()
};
