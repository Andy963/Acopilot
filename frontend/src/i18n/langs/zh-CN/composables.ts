export const zhCNComposables = {
    useChat: {
        errors: {
            sendFailed: '发送消息失败',
            retryFailed: '重试失败',
            editRetryFailed: '编辑重试失败',
            deleteFailed: '删除失败',
            streamError: '流式响应错误',
            loadHistoryFailed: '加载历史记录失败'
        }
    },
    useConversations: {
        defaultTitle: '无标题',
        newChatTitle: '新对话',
        errors: {
            loadFailed: '加载对话列表失败',
            createFailed: '创建对话失败',
            deleteFailed: '删除对话失败',
            updateTitleFailed: '更新标题失败'
        },
        relativeTime: {
            justNow: '刚刚',
            minutesAgo: '{minutes}分钟前',
            hoursAgo: '{hours}小时前',
            daysAgo: '{days}天前'
        }
    },
    useAttachments: {
        errors: {
            validationFailed: '附件验证失败',
            createThumbnailFailed: '创建缩略图失败',
            createVideoThumbnailFailed: '创建视频缩略图失败',
            readFileFailed: '读取文件失败',
            loadVideoFailed: '加载视频失败',
            readResultNotString: '读取结果不是字符串'
        }
    }
};
