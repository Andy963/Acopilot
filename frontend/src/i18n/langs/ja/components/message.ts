export const jaComponentsMessage = {
    roles: {
        user: 'ユーザー',
        tool: 'ツール',
        assistant: 'アシスタント'
    },
    stats: {
        responseDuration: '応答時間',
        tokenRate: 'トークン速度',
        finishReason: '終了理由',
        contextUsed: '使用したコンテキスト',
        cacheHit: 'キャッシュ命中：{tokens}（{percent}%）'
    },
    thought: {
        thinking: '考え中...',
        thoughtProcess: '思考プロセス'
    },
    summary: {
        title: 'コンテキスト要約',
        compressed: '{count} 件のメッセージを圧縮しました',
        keptRounds: '直近 {count} ラウンドを保持',
        generatedAt: '{time} に生成',
        deleteTitle: '要約を元に戻す',
        resummarizeTitle: '要約を再生成'
    },
    checkpoint: {
        userMessageBefore: 'ユーザーメッセージ前のチェックポイント',
        userMessageAfter: 'ユーザーメッセージ後のチェックポイント',
        assistantMessageBefore: 'アシスタントメッセージ前のチェックポイント',
        assistantMessageAfter: 'アシスタントメッセージ後のチェックポイント',
        toolBatchBefore: 'バッチツール実行前のチェックポイント',
        toolBatchAfter: 'バッチツール実行後のチェックポイント',
        userMessageUnchanged: 'ユーザーメッセージ · 変更なし',
        assistantMessageUnchanged: 'アシスタントメッセージ · 変更なし',
        toolBatchUnchanged: 'バッチツール実行完了 · 変更なし',
        toolExecutionUnchanged: 'ツール実行完了 · 変更なし',
        restoreTooltip: 'ワークスペースをこのチェックポイントに復元',
        recentTitle: '最近のチェックポイントを復元できます',
        recentRestore: '復元',
        fileCount: '{count} 個のファイル',
        yesterday: '昨日',
        daysAgo: '{days} 日前',
        restoreConfirmTitle: 'チェックポイントを復元',
        restoreConfirmMessage: 'ワークスペースをこのチェックポイントに復元してもよろしいですか？これにより、現在のワークスペース内の対応するファイルが上書きされ、この操作は元に戻せません。',
        restoreConfirmBtn: '復元'
    },
    continue: {
        title: '会話が一時停止中',
        description: 'ツールの実行が完了しました。新しいメッセージを送信するか、「続行」をクリックして AI の応答を続けることができます',
        button: '続行'
    },
    jumpToLatest: '最新へ移動',
    error: {
        title: 'リクエストに失敗しました',
        retry: '再試行',
        copy: 'エラー詳細をコピー',
        dismiss: '閉じる'
    },
    tool: {
        parameters: 'パラメータ',
        result: '結果',
        error: 'エラー',
        paramCount: '{count} 個のパラメータ',
        confirmExecution: 'クリックして実行を確認',
        confirm: '実行を確認',
        reject: '拒否',
        confirmed: '確認済み',
        rejected: '拒否済み',
        viewDiff: '差分を表示',
        viewDiffInVSCode: 'VSCode で差分を表示',
        saveAndContinue: '保存して続行',
        acceptDiffFailed: '差分の保存に失敗しました',
        openDiffFailed: 'diff プレビューを開くのに失敗しました'
    },
    attachment: {
        clickToPreview: 'クリックしてプレビュー',
        removeAttachment: '添付ファイルを削除'
    }
};
