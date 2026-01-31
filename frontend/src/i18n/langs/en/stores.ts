export const enStores = {
    terminalStore: {
        errors: {
            killTerminalFailed: 'Failed to kill terminal',
            refreshOutputFailed: 'Failed to refresh terminal output'
        }
    },
    chatStore: {
        defaultTitle: 'Untitled',
        errors: {
            loadConversationsFailed: 'Failed to load conversations',
            createConversationFailed: 'Failed to create conversation',
            deleteConversationFailed: 'Failed to delete conversation',
            sendMessageFailed: 'Failed to send message',
            streamError: 'Stream response error',
            loadHistoryFailed: 'Failed to load history',
            retryFailed: 'Retry failed',
            editRetryFailed: 'Edit retry failed',
            deleteFailed: 'Delete failed',
            noConversationSelected: 'No conversation selected',
            unknownError: 'Unknown error',
            restoreFailed: 'Restore failed',
            restoreCheckpointFailed: 'Failed to restore checkpoint',
            restoreRetryFailed: 'Restore and retry failed',
            restoreDeleteFailed: 'Restore and delete failed',
            noConfigSelected: 'No config selected',
            summarizeFailed: 'Summarize failed',
            restoreEditFailed: 'Restore and edit failed'
        },
        relativeTime: {
            justNow: 'Just now',
            minutesAgo: '{minutes}m ago',
            hoursAgo: '{hours}h ago',
            daysAgo: '{days}d ago'
        }
    }
};
