export const zhCNStores = {
    terminalStore: {
        errors: {
            killTerminalFailed: '杀死终端失败',
            refreshOutputFailed: '刷新终端输出失败'
        }
    },
    chatStore: {
        defaultTitle: '无标题',
        errors: {
            loadConversationsFailed: '加载对话列表失败',
            createConversationFailed: '创建对话失败',
            deleteConversationFailed: '删除对话失败',
            sendMessageFailed: '发送消息失败',
            streamError: '流式响应错误',
            loadHistoryFailed: '加载历史记录失败',
            retryFailed: '重试失败',
            editRetryFailed: '编辑重试失败',
            deleteFailed: '删除失败',
            noConversationSelected: '未选择对话',
            unknownError: '未知错误',
            restoreFailed: '恢复失败',
            restoreCheckpointFailed: '恢复检查点失败',
            restoreRetryFailed: '回档并重试失败',
            restoreDeleteFailed: '回档并删除失败',
            noConfigSelected: '未选择配置',
            summarizeFailed: '总结失败',
            restoreEditFailed: '回档并编辑失败'
        },
        relativeTime: {
            justNow: '刚刚',
            minutesAgo: '{minutes}分钟前',
            hoursAgo: '{hours}小时前',
            daysAgo: '{days}天前'
        }
    }
};
