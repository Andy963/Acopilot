export const zhCNComponentsCommon = {
    confirmDialog: {
        title: '确认',
        message: '确定要执行此操作吗？',
        confirm: '确定',
        cancel: '取消'
    },
    deleteDialog: {
        title: '删除消息',
        message: '确定要删除这条消息吗？',
        messageWithCount: '确定要删除这条消息吗？这将同时删除后续 {count} 条消息，共 {total} 条消息将被删除。',
        checkpointHint: '检测到此消息前有备份，您可以选择回档到该备份点后再删除，以恢复文件变更。',
        cancel: '取消',
        delete: '删除',
        directDelete: '直接删除',
        restoreAndDelete: '回档并删除',
        restoreToUserMessage: '回档到用户消息前',
        restoreToAssistantMessage: '回档到助手消息前',
        restoreToToolBatch: '回档到批量工具执行前',
        restoreToTool: '回档到 {toolName} 执行前'
    },
    editDialog: {
        title: '编辑消息',
        placeholder: '输入新的消息内容...（可粘贴附件，Shift+拖拽添加路径）',
        addAttachment: '添加附件',
        checkpointHint: '检测到此消息前有工具执行的备份，您可以选择回档到工具执行前再编辑，以恢复文件变更。',
        cancel: '取消',
        save: '保存',
        restoreToUserMessage: '回档到用户消息前',
        restoreToAssistantMessage: '回档到助手消息前',
        restoreToToolBatch: '回档到批量工具执行前',
        restoreToTool: '回档到 {toolName} 执行前'
    },
    retryDialog: {
        title: '重试消息',
        message: '确定要重试此消息吗？这将删除此消息及后续消息，然后重新请求 AI 响应。',
        checkpointHint: '检测到此消息前有工具执行的备份，您可以选择回档到工具执行前再重试。',
        cancel: '取消',
        retry: '重试',
        directRetry: '直接重试',
        restoreAndRetry: '回档并重试',
        restoreToUserMessage: '回档到用户消息前',
        restoreToAssistantMessage: '回档到助手消息前',
        restoreToToolBatch: '回档到批量工具执行前',
        restoreToTool: '回档到 {toolName} 执行前'
    },
    dependencyWarning: {
        title: '需要安装依赖',
        defaultMessage: '此功能需要安装以下依赖：',
        hint: '请前往',
        linkText: '工具设置',
        installMissing: '安装缺失依赖',
        installing: '安装中...',
        copyFailureLog: '复制失败日志'
    },
    emptyState: {
        noData: '暂无数据',
        noResults: '无搜索结果'
    },
    tooltip: {
        copied: '已复制',
        copyFailed: '复制失败'
    },
    modal: {
        close: '关闭'
    },
    markdown: {
        copyCode: '复制代码',
        copied: '已复制',
        imageLoadFailed: '图片加载失败'
    },
    contextInspectorModal: {
        title: '上下文检查器',
        titleUsed: '本条回复使用的上下文',
        noData: '暂无上下文数据',
        copyDebug: '复制调试信息',
        openContextSettings: '上下文设置',
        summary: {
            config: '配置',
            toolMode: '工具模式',
            tools: '工具',
            mcp: 'MCP',
            systemInstruction: '系统指令',
            generatedAt: '生成时间'
        },
        injected: {
            title: '注入明细',
            pinnedFiles: '固定文件',
            pinnedPrompt: '固定提示词',
            pinnedSelections: '引用',
            attachments: '附件',
            missing: '缺失',
            pinnedPromptCustom: '自定义（{count} 字符）'
        },
        trim: {
            title: '上下文裁剪',
            fullHistory: '历史消息数',
            trimmedHistory: '发送消息数',
            trimStartIndex: '裁剪起点索引',
            lastSummaryIndex: '最后总结索引',
            summaryPreview: '上下文总结',
            summarizedMessages: '已总结消息数',
            keptRounds: '保留轮数'
        },
        tools: {
            title: '工具定义预览'
        },
        modules: {
            title: '系统提示词分段',
            labels: {
                text: '文本',
                environment: '环境',
                workspaceFiles: '工作区文件',
                pinnedFiles: '固定文件',
                tools: '工具',
                mcpTools: 'MCP 工具',
                guidelines: '规范',
                openTabs: '打开的标签页',
                activeEditor: '当前编辑器',
                diagnostics: '诊断信息',
                selectionReferences: '选区引用'
            }
        },
        raw: {
            title: '系统指令（Raw）'
        }
    }
};
