export interface MessageCheckpointConfig {
    beforeMessages: string[];
    afterMessages: string[];
    modelOuterLayerOnly?: boolean;
    mergeUnchangedCheckpoints?: boolean;
}

export interface CheckpointConfig {
    enabled: boolean;
    beforeTools: string[];
    afterTools: string[];
    messageCheckpoint?: MessageCheckpointConfig;
    maxCheckpoints: number;
    customIgnorePatterns?: string[];
    [key: string]: unknown;
}

export const DEFAULT_MESSAGE_CHECKPOINT_CONFIG: MessageCheckpointConfig = {
    beforeMessages: ['user'],
    afterMessages: [],
    modelOuterLayerOnly: true,
    mergeUnchangedCheckpoints: true
};

export const DEFAULT_CHECKPOINT_CONFIG: CheckpointConfig = {
    enabled: true,
    beforeTools: [
        'apply_diff',
        'write_file',
        'delete_file',
        'create_directory',
        'execute_command',
        'generate_image'
    ],
    afterTools: [
        'apply_diff',
        'write_file',
        'delete_file',
        'create_directory',
        'execute_command',
        'generate_image'
    ],
    messageCheckpoint: DEFAULT_MESSAGE_CHECKPOINT_CONFIG,
    maxCheckpoints: -1,
    customIgnorePatterns: []
};

