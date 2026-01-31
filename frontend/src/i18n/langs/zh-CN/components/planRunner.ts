export const zhCNComponentsPlanRunner = {
    status: {
        idle: '未开始',
        running: '运行中',
        paused: '已暂停',
        completed: '已完成',
        cancelled: '已取消'
    },
    actions: {
        start: '开始',
        resume: '继续',
        pause: '暂停',
        cancel: '取消',
        clear: '清空',
        runStep: '执行该步',
        rerunStep: '重执行该步'
    },
    current: '当前',
    goalLabel: '目标',
    acceptanceCriteriaLabel: '验收',
    attachmentsLabel: '附件',
    modal: {
        title: 'Plan & Run',
        planTitle: '计划标题',
        planTitlePlaceholder: '例如：修复 xxx 并补充测试',
        goal: '目标/背景（可选）',
        goalPlaceholder: '可选：补充上下文、约束…',
        acceptanceCriteria: '验收标准（可选）',
        acceptanceCriteriaPlaceholder: '可选：如何判断完成/通过…',
        steps: '步骤',
        addStep: '添加步骤',
        stepTitle: '步骤标题',
        stepInstruction: '该步骤要发送给模型的指令/提示词…',
        attachImage: '添加图片',
        removeStep: '删除步骤',
        removeAttachment: '移除附件',
        stash: '暂存',
        stashed: '已暂存',
        draftLoaded: '已加载暂存草稿（下次打开可继续编辑）',
        hint: '至少需要：计划标题 + 1 个完整步骤（标题+指令）。',
        save: '保存计划',
        saveAndStart: '保存并开始'
    }
};
