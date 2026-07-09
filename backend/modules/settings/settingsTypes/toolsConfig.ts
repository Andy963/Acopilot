import type { ApplyDiffToolConfig, DeleteFileToolConfig, ExecuteCommandToolConfig, FindFilesToolConfig, ListFilesToolConfig, LocateToolConfig, ReplaceInFilesToolConfig, SearchInFilesToolConfig } from './toolConfigs';
import type { CheckpointConfig } from './checkpoints';
import type { ContextAwarenessConfig } from './contextAwareness';
import type { CropImageToolConfig, GenerateImageToolConfig, RemoveBackgroundToolConfig, ResizeImageToolConfig, RotateImageToolConfig } from './mediaTools';
import type { PinnedFilesConfig } from './pinnedFiles';
import type { SystemPromptConfig } from './prompting';
import type { SummarizeConfig } from './summarize';
import type { TokenCountConfig } from './tokenCount';

export interface ToolsConfig {
    list_files?: ListFilesToolConfig;
    find_files?: FindFilesToolConfig;
    search_in_files?: SearchInFilesToolConfig;
    replace_in_files?: ReplaceInFilesToolConfig;
    locate?: LocateToolConfig;
    apply_diff?: ApplyDiffToolConfig;
    delete_file?: DeleteFileToolConfig;
    execute_command?: ExecuteCommandToolConfig;
    checkpoint?: CheckpointConfig;
    summarize?: SummarizeConfig;
    generate_image?: GenerateImageToolConfig;
    remove_background?: RemoveBackgroundToolConfig;
    crop_image?: CropImageToolConfig;
    resize_image?: ResizeImageToolConfig;
    rotate_image?: RotateImageToolConfig;
    context_awareness?: ContextAwarenessConfig;
    pinned_files?: PinnedFilesConfig;
    system_prompt?: SystemPromptConfig;
    token_count?: TokenCountConfig;
    [toolName: string]: Record<string, unknown> | undefined;
}
