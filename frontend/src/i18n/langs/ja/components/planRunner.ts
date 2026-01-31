export const jaComponentsPlanRunner = {
    status: {
        idle: '未開始',
        running: '実行中',
        paused: '一時停止',
        completed: '完了',
        cancelled: 'キャンセル'
    },
    actions: {
        start: '開始',
        resume: '再開',
        pause: '一時停止',
        cancel: 'キャンセル',
        clear: 'クリア',
        runStep: 'このステップを実行',
        rerunStep: 'このステップを再実行'
    },
    current: '現在',
    goalLabel: '目標',
    acceptanceCriteriaLabel: '受け入れ基準',
    attachmentsLabel: '添付',
    modal: {
        title: 'Plan & Run',
        planTitle: 'プランタイトル',
        planTitlePlaceholder: '例：xxx を修正してテストを追加',
        goal: '目標/背景（任意）',
        goalPlaceholder: '任意：制約、コンテキスト…',
        acceptanceCriteria: '受け入れ基準（任意）',
        acceptanceCriteriaPlaceholder: '任意：完了/合格の判定基準…',
        steps: 'ステップ',
        addStep: 'ステップを追加',
        stepTitle: 'ステップタイトル',
        stepInstruction: 'このステップで送信する指示/プロンプト…',
        attachImage: '画像を添付',
        removeStep: 'ステップを削除',
        removeAttachment: '添付を削除',
        stash: '下書きを保存',
        stashed: '保存しました',
        draftLoaded: '保存した下書きを読み込みました（次回も編集を続けられます）',
        hint: '必要：プランタイトル + 少なくとも 1 つの完全なステップ（タイトル + 指示）。',
        save: '保存',
        saveAndStart: '保存して開始'
    }
};
