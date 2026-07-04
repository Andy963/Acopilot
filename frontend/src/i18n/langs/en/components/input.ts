export const enComponentsInput = {
    placeholder: 'Type a message...',
    placeholderHint: 'Type a message... (Enter to send, paste attachments, Shift+drag or @ to add paths)',
    send: 'Send message',
    stopGenerating: 'Stop generating',
    attachFile: 'Attach file',
    pinnedFiles: 'Pinned',
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
        title: 'Pinned',
        description: 'Pinned files are sent in every chat; Skill/custom prompt only applies to the current conversation',
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
            label: 'Custom Prompt',
            placeholder: 'Enter a prompt that only applies to the current conversation...',
            save: 'Save',
            clear: 'Clear',
            hint: 'After saving, it will be injected into the system prompt for this conversation',
            saveAsSkillLabel: 'Save as a reusable skill',
            saveAsSkillNamePlaceholder: 'Skill name',
            saveAsSkillButton: 'Save as skill',
            saveAsSkillHint: 'Saved skills persist across conversations and projects, and can be re-selected instead of retyped'
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
        cannotGetFilePath: 'Cannot get file path, please drag from VSCode Explorer or tab',
        fileNotMatchOrNotInWorkspace: 'File is not in workspace or filename does not match',
        removeFailed: 'Remove failed: {error}'
    }
};
