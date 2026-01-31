export const jaStores = {
    terminalStore: {
        errors: {
            killTerminalFailed: 'ターミナルの終了に失敗しました',
            refreshOutputFailed: 'ターミナル出力の更新に失敗しました'
        }
    },
    chatStore: {
        defaultTitle: 'タイトルなし',
        errors: {
            loadConversationsFailed: '会話の読み込みに失敗しました',
            createConversationFailed: '会話の作成に失敗しました',
            deleteConversationFailed: '会話の削除に失敗しました',
            sendMessageFailed: 'メッセージの送信に失敗しました',
            streamError: 'ストリームレスポンスエラー',
            loadHistoryFailed: '履歴の読み込みに失敗しました',
            retryFailed: '再試行に失敗しました',
            editRetryFailed: '編集再試行に失敗しました',
            deleteFailed: '削除に失敗しました',
            noConversationSelected: '会話が選択されていません',
            unknownError: '不明なエラー',
            restoreFailed: '復元に失敗しました',
            restoreCheckpointFailed: 'チェックポイントの復元に失敗しました',
            restoreRetryFailed: '復元して再試行に失敗しました',
            restoreDeleteFailed: '復元して削除に失敗しました',
            noConfigSelected: '設定が選択されていません',
            summarizeFailed: '要約に失敗しました',
            restoreEditFailed: '復元して編集に失敗しました'
        },
        relativeTime: {
            justNow: 'たった今',
            minutesAgo: '{minutes}分前',
            hoursAgo: '{hours}時間前',
            daysAgo: '{days}日前'
        }
    }
};
