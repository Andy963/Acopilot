export const enComponentsInput = {
    placeholder: 'Type a message...',
    placeholderHint: 'Type a message... (Enter to send, paste attachments, Shift+drag or @ to add paths)',
    send: 'Send message',
    stopGenerating: 'Stop generating',
    attachFile: 'Attach file',
    pinnedFiles: 'Pinned Context',
    createPlan: 'Plan & Run',
    summarizeContext: 'Summarize context',
    selectChannel: 'Select channel',
    selectModel: 'Select model',
    clickToPreview: 'Click to preview',
    remove: 'Remove',
    tokenUsage: 'Usage',
    context: 'Context',
    fileNotExists: 'File does not exist',
    channelSelector: {
        placeholder: 'Select config',
        searchPlaceholder: 'Search channels...',
        noMatch: 'No matching channels'
    },
    modelSelector: {
        placeholder: 'Select model',
        searchPlaceholder: 'Search models...',
        noMatch: 'No matching models',
        addInSettings: 'Please add models in settings'
    },
    pinnedFilesPanel: {
        title: 'Pinned Context',
        description: 'Pinned files are sent in every chat; Skill/custom prompt can be selected here',
        loading: 'Loading...',
        empty: 'No pinned files',
        notExists: 'Does not exist',
        dragHint: 'Hold Shift and drag text files from workspace here to add',
        dropHint: 'Release to add file',
        tabs: {
            files: 'Files',
            refs: 'References',
            skill: 'Skill',
            custom: 'Custom'
        },
        refs: {
            empty: 'No references',
            open: 'Open',
            clear: 'Clear references',
            truncated: 'Truncated'
        },
        skill: {
            selectLabel: 'Select Skill',
            loading: 'Loading...',
            empty: 'No skills',
            pickOne: 'Pick a skill',
            manageHint: 'Manage skills in Settings > System Prompt'
        },
        custom: {
            presetsLabel: 'Saved prompts',
            presetsEmptyOption: 'Choose a saved prompt',
            presetsEmpty: 'No saved prompts yet. Save one below to reuse it across projects.',
            selectedPresetHint: 'Selected saved prompt: {name}',
            label: 'Custom Prompt',
            placeholder: 'Enter a prompt that only applies to the current conversation...',
            save: 'Use for this conversation',
            clear: 'Clear',
            hint: 'This only applies to the current conversation. Save as a reusable prompt below to reuse it across projects.',
            saveAsPresetLabel: 'Save as reusable prompt',
            saveAsPresetNamePlaceholder: 'Prompt name',
            saveAsPresetButton: 'Save prompt',
            saveAsPresetHint: 'Saved prompts persist globally and can be selected again in other projects'
        },
        workspaceDefaultApplied: 'Applied the pinned prompt remembered for this project'
    },
    messageContextOverrides: {
        title: 'This message',
        description: 'Applies to the next message only (auto-reset after send)',
        reset: 'Reset',
        inherit: 'Default',
        on: 'On',
        off: 'Off',
        items: {
            pinnedPrompt: 'Pinned Prompt',
            pinnedFiles: 'Pinned Files',
            workspaceFiles: 'Workspace Files',
            openTabs: 'Open Tabs',
            activeEditor: 'Active Editor',
            diagnostics: 'Diagnostics',
            tools: 'Tools'
        }
    },
    filePicker: {
        title: 'Select File',
        subtitle: 'Type after @ to filter paths',
        loading: 'Searching...',
        empty: 'No matching files found',
        navigate: 'navigate',
        select: 'select',
        close: 'close'
    },
    notifications: {
        summarizeFailed: 'Summarize failed: {error}',
        summarizeSuccess: 'Successfully summarized {count} messages',
        summarizeError: 'Summarize failed: {error}',
        holdShiftToDrag: 'Please hold Shift key to drag files',
        fileNotInWorkspace: 'File is not in workspace',
        fileNotInAnyWorkspace: 'File is not in any open workspace',
        fileInOtherWorkspace: 'File belongs to another workspace: {workspaceName}',
        fileAdded: 'Added pinned file: {path}',
        addFailed: 'Add failed: {error}',
        loadPinnedPromptPresetsFailed: 'Load saved prompts failed: {error}',
        cannotGetFilePath: 'Cannot get file path, please drag from VSCode Explorer or tab',
        fileNotMatchOrNotInWorkspace: 'File is not in workspace or filename does not match',
        removeFailed: 'Remove failed: {error}'
    }
};
