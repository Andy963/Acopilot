export const enComposables = {
    useChat: {
        errors: {
            sendFailed: 'Failed to send message',
            retryFailed: 'Retry failed',
            editRetryFailed: 'Edit retry failed',
            deleteFailed: 'Delete failed',
            streamError: 'Stream response error',
            loadHistoryFailed: 'Failed to load history'
        }
    },
    useConversations: {
        defaultTitle: 'Untitled',
        newChatTitle: 'New Chat',
        errors: {
            loadFailed: 'Failed to load conversations',
            createFailed: 'Failed to create conversation',
            deleteFailed: 'Failed to delete conversation',
            updateTitleFailed: 'Failed to update title'
        },
        relativeTime: {
            justNow: 'Just now',
            minutesAgo: '{minutes} minutes ago',
            hoursAgo: '{hours} hours ago',
            daysAgo: '{days} days ago'
        }
    },
    useAttachments: {
        errors: {
            validationFailed: 'Attachment validation failed',
            createThumbnailFailed: 'Failed to create thumbnail',
            createVideoThumbnailFailed: 'Failed to create video thumbnail',
            readFileFailed: 'Failed to read file',
            loadVideoFailed: 'Failed to load video',
            readResultNotString: 'Read result is not a string'
        }
    }
};
