export const zhCNComponentsInput = {
    placeholder: '输入消息...',
    placeholderHint: '输入消息... (Enter 发送，可粘贴附件，Shift+拖拽或@添加路径)',
    send: '发送消息',
    stopGenerating: '停止生成',
    attachFile: '添加附件',
    pinnedFiles: '固定内容',
    createPlan: 'Plan & Run',
    summarizeContext: '总结上下文',
    selectChannel: '选择渠道',
    selectModel: '选择模型',
    clickToPreview: '点击预览',
    remove: '移除',
    tokenUsage: '使用量',
    context: '上下文',
    fileNotExists: '文件不存在',
    channelSelector: {
        placeholder: '选择配置',
        searchPlaceholder: '搜索渠道...',
        noMatch: '没有匹配的渠道'
    },
    modelSelector: {
        placeholder: '选择模型',
        searchPlaceholder: '搜索模型...',
        noMatch: '没有匹配的模型',
        addInSettings: '请在设置中添加模型'
    },
    pinnedFilesPanel: {
        title: '固定内容',
        description: '固定文件会在每次对话发送；Skill/自定义提示词仅对当前对话生效',
        loading: '加载中...',
        empty: '暂无固定文件',
        notExists: '不存在',
        dragHint: '按住 Shift 拖拽工作区内的文本文件到此处添加',
        dropHint: '释放鼠标添加文件',
        tabs: {
            files: '文件',
            refs: '引用',
            skill: 'Skill',
            custom: '自定义'
        },
        refs: {
            empty: '暂无引用',
            open: '打开',
            clear: '清空引用',
            truncated: '已截断'
        },
        skill: {
            selectLabel: '选择 Skill',
            loading: '加载中...',
            empty: '暂无 Skill',
            pickOne: '请选择一个 Skill',
            manageHint: '在 设置 > 系统提示词 中管理 Skills'
        },
        custom: {
            label: '自定义提示词',
            placeholder: '输入仅对当前对话生效的提示词...',
            save: '保存',
            clear: '清空',
            hint: '保存后会作为系统提示词额外注入当前对话',
            saveAsSkillLabel: '保存为可复用条目',
            saveAsSkillNamePlaceholder: 'Skill 名称',
            saveAsSkillButton: '保存为 Skill',
            saveAsSkillHint: '保存后的 Skill 会跨对话、跨项目持久保留，之后只需选择，不用重新输入'
        },
        workspaceDefaultApplied: '已应用当前项目记住的固定提示词'
    },
    messageContextOverrides: {
        title: '本条上下文',
        description: '仅对下一条消息生效（发送后自动恢复默认）',
        reset: '重置',
        inherit: '默认',
        on: '开',
        off: '关',
        items: {
            pinnedPrompt: '固定提示词/Skill',
            pinnedFiles: '固定文件',
            workspaceFiles: '工作区文件树',
            openTabs: '打开的标签页',
            activeEditor: '当前编辑器',
            diagnostics: '诊断信息',
            tools: '工具'
        }
    },
    filePicker: {
        title: '选择文件',
        subtitle: '在 @ 后输入文字筛选路径',
        loading: '搜索中...',
        empty: '未找到匹配的文件',
        navigate: '导航',
        select: '选择',
        close: '关闭'
    },
    notifications: {
        summarizeFailed: '总结失败: {error}',
        summarizeSuccess: '已成功总结 {count} 条消息',
        summarizeError: '总结失败: {error}',
        holdShiftToDrag: '请按住 Shift 键拖拽文件',
        fileNotInWorkspace: '文件不在工作区内',
        fileNotInAnyWorkspace: '文件不在任何打开的工作区内',
        fileInOtherWorkspace: '文件属于其他工作区: {workspaceName}',
        fileAdded: '已添加固定文件: {path}',
        addFailed: '添加失败: {error}',
        cannotGetFilePath: '无法获取文件路径，请从 VSCode 资源管理器或标签页拖拽',
        fileNotMatchOrNotInWorkspace: '文件不在工作区内或文件名不匹配',
        removeFailed: '移除失败: {error}'
    }
};
