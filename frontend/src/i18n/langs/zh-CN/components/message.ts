export const zhCNComponentsMessage = {
    roles: {
        user: '用户',
        tool: '工具',
        assistant: '助手'
    },
    stats: {
        responseDuration: '响应时间',
        tokenRate: 'Token 速率',
        finishReason: '结束原因',
        contextUsed: '使用的上下文',
        cacheHit: '缓存命中：{tokens}（{percent}%）'
    },
    thought: {
        thinking: '正在思考...',
        thoughtProcess: '思考过程'
    },
    summary: {
        title: '上下文总结',
        compressed: '已压缩 {count} 条消息',
        deleteTitle: '删除总结'
    },
    checkpoint: {
        userMessageBefore: '用户消息前存档',
        userMessageAfter: '用户消息后存档',
        assistantMessageBefore: '助手消息前存档',
        assistantMessageAfter: '助手消息后存档',
        toolBatchBefore: '批量工具执行前存档',
        toolBatchAfter: '批量工具执行后存档',
        userMessageUnchanged: '用户消息存档 · 内容未变化',
        assistantMessageUnchanged: '助手消息存档 · 内容未变化',
        toolBatchUnchanged: '批量工具执行完成 · 内容未变化',
        toolExecutionUnchanged: '工具执行完成 · 内容未变化',
        restoreTooltip: '恢复工作区到此存档点',
        fileCount: '{count} 个文件',
        yesterday: '昨天',
        daysAgo: '{days}天前',
        restoreConfirmTitle: '恢复存档',
        restoreConfirmMessage: '确定要将工作区恢复到此存档点吗？这将覆盖当前工作区中的相应文件，此操作不可恢复。',
        restoreConfirmBtn: '恢复'
    },
    continue: {
        title: '对话等待中',
        description: '工具执行完成。您可以发送新消息，或点击"继续"让 AI 继续响应',
        button: '继续'
    },
    error: {
        title: '请求失败',
        retry: '重试',
        copy: '复制错误信息',
        dismiss: '关闭'
    },
    tool: {
        parameters: '参数',
        result: '结果',
        error: '错误',
        paramCount: '{count} 个参数',
        confirmExecution: '点击确认执行',
        confirm: '确认执行',
        reject: '拒绝',
        confirmed: '已确认',
        rejected: '已拒绝',
        viewDiff: '查看差异',
        viewDiffInVSCode: '在 VSCode 中查看差异',
        saveAndContinue: '保存并继续',
        acceptDiffFailed: '保存差异失败',
        openDiffFailed: '打开 diff 预览失败'
    },
    attachment: {
        clickToPreview: '点击预览',
        removeAttachment: '移除附件'
    }
};
