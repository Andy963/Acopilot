export const enComponentsCommon = {
    confirmDialog: {
        title: 'Confirm',
        message: 'Are you sure you want to proceed?',
        confirm: 'Confirm',
        cancel: 'Cancel'
    },
    deleteDialog: {
        title: 'Delete Message',
        message: 'Are you sure you want to delete this message?',
        messageWithCount: 'Are you sure you want to delete this message? This will also delete the following {count} messages, {total} messages will be deleted in total.',
        checkpointHint: 'A backup was detected before this message. You can choose to restore to that backup point before deleting to recover file changes.',
        cancel: 'Cancel',
        delete: 'Delete',
        directDelete: 'Delete directly',
        restoreAndDelete: 'Restore and delete',
        restoreToUserMessage: 'Restore to before user message',
        restoreToAssistantMessage: 'Restore to before assistant message',
        restoreToToolBatch: 'Restore to before batch tool execution',
        restoreToTool: 'Restore to before {toolName} execution'
    },
    editDialog: {
        title: 'Edit Message',
        placeholder: 'Enter new message content... (paste attachments, Shift+drag to add paths)',
        addAttachment: 'Add Attachment',
        checkpointHint: 'A tool execution backup was detected before this message. You can choose to restore to before tool execution and then edit to recover file changes.',
        cancel: 'Cancel',
        save: 'Save',
        restoreToUserMessage: 'Restore to before user message',
        restoreToAssistantMessage: 'Restore to before assistant message',
        restoreToToolBatch: 'Restore to before batch tool execution',
        restoreToTool: 'Restore to before {toolName} execution'
    },
    retryDialog: {
        title: 'Retry Message',
        message: 'Are you sure you want to retry this message? This will delete this message and subsequent messages, then request a new AI response.',
        checkpointHint: 'A tool execution backup was detected before this message. You can choose to restore to before tool execution and then retry.',
        cancel: 'Cancel',
        retry: 'Retry',
        directRetry: 'Retry directly',
        restoreAndRetry: 'Restore and retry',
        restoreToUserMessage: 'Restore to before user message',
        restoreToAssistantMessage: 'Restore to before assistant message',
        restoreToToolBatch: 'Restore to before batch tool execution',
        restoreToTool: 'Restore to before {toolName} execution'
    },
    dependencyWarning: {
        title: 'Dependencies Required',
        defaultMessage: 'This feature requires the following dependencies:',
        hint: 'Please go to',
        linkText: 'Tools Settings',
        installMissing: 'Install missing',
        installing: 'Installing...',
        copyFailureLog: 'Copy failure log'
    },
    emptyState: {
        noData: 'No data',
        noResults: 'No results found'
    },
    tooltip: {
        copied: 'Copied',
        copyFailed: 'Copy failed'
    },
    modal: {
        close: 'Close'
    },
    markdown: {
        copyCode: 'Copy code',
        copied: 'Copied',
        imageLoadFailed: 'Failed to load image'
    },
    contextInspectorModal: {
        title: 'Context Inspector',
        titleUsed: 'Context Used',
        noData: 'No context data',
        copyDebug: 'Copy debug info',
        openContextSettings: 'Context settings',
        summary: {
            config: 'Config',
            toolMode: 'Tool mode',
            tools: 'Tools',
            mcp: 'MCP',
            systemInstruction: 'System instruction',
            generatedAt: 'Generated at'
        },
        injected: {
            title: 'Injected Context',
            pinnedFiles: 'Pinned Files',
            pinnedPrompt: 'Pinned Prompt',
            pinnedSelections: 'References',
            attachments: 'Attachments',
            missing: 'missing',
            pinnedPromptCustom: 'Custom ({count} chars)'
        },
        trim: {
            title: 'Context Trim',
            fullHistory: 'History messages',
            trimmedHistory: 'Sent messages',
            trimStartIndex: 'Trim start index',
            lastSummaryIndex: 'Last summary index',
            summaryPreview: 'Context Summary',
            summarizedMessages: 'Summarized messages',
            keptRounds: 'Kept rounds'
        },
        tools: {
            title: 'Tool Definitions'
        },
        modules: {
            title: 'System Prompt Sections',
            labels: {
                text: 'Text',
                environment: 'Environment',
                workspaceFiles: 'Workspace files',
                pinnedFiles: 'Pinned files',
                tools: 'Tools',
                mcpTools: 'MCP tools',
                guidelines: 'Guidelines',
                openTabs: 'Open tabs',
                activeEditor: 'Active editor',
                diagnostics: 'Diagnostics',
                selectionReferences: 'Selection references'
            }
        },
        raw: {
            title: 'System Instruction (Raw)'
        }
    }
};
