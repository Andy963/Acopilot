export const enComponentsMessage = {
    roles: {
        user: 'User',
        tool: 'Tool',
        assistant: 'Assistant'
    },
    stats: {
        responseDuration: 'Response Duration',
        tokenRate: 'Token Rate',
        finishReason: 'Finish Reason',
        contextUsed: 'Context Used',
        cacheHit: 'Cached input tokens: {tokens} ({percent}%)'
    },
    thought: {
        thinking: 'Thinking...',
        thoughtProcess: 'Thought Process'
    },
    summary: {
        title: 'Context Summary',
        compressed: 'Compressed {count} messages',
        deleteTitle: 'Delete Summary'
    },
    checkpoint: {
        userMessageBefore: 'Before User Message',
        userMessageAfter: 'After User Message',
        assistantMessageBefore: 'Before Assistant Message',
        assistantMessageAfter: 'After Assistant Message',
        toolBatchBefore: 'Before Tool Batch',
        toolBatchAfter: 'After Tool Batch',
        userMessageUnchanged: 'User Message · Unchanged',
        assistantMessageUnchanged: 'Assistant Message · Unchanged',
        toolBatchUnchanged: 'Tool Batch Completed · Unchanged',
        toolExecutionUnchanged: 'Tool Execution Completed · Unchanged',
        restoreTooltip: 'Restore workspace to this checkpoint',
        fileCount: '{count} files',
        yesterday: 'Yesterday',
        daysAgo: '{days} days ago',
        restoreConfirmTitle: 'Restore Checkpoint',
        restoreConfirmMessage: 'Are you sure you want to restore the workspace to this checkpoint? This will overwrite the corresponding files in your current workspace, and this action cannot be undone.',
        restoreConfirmBtn: 'Restore'
    },
    continue: {
        title: 'Conversation Paused',
        description: 'Tool execution completed. You can send a new message or click "Continue" to let AI continue responding',
        button: 'Continue'
    },
    jumpToLatest: 'Jump to latest',
    error: {
        title: 'Request Failed',
        retry: 'Retry',
        copy: 'Copy error details',
        dismiss: 'Dismiss'
    },
    tool: {
        parameters: 'Parameters',
        result: 'Result',
        error: 'Error',
        paramCount: '{count} parameters',
        confirmExecution: 'Click to confirm execution',
        confirm: 'Confirm Execution',
        reject: 'Reject',
        confirmed: 'Confirmed',
        rejected: 'Rejected',
        viewDiff: 'View Diff',
        viewDiffInVSCode: 'View diff in VSCode',
        saveAndContinue: 'Save & continue',
        acceptDiffFailed: 'Failed to save diff',
        openDiffFailed: 'Failed to open diff preview'
    },
    attachment: {
        clickToPreview: 'Click to preview',
        removeAttachment: 'Remove attachment'
    }
};
