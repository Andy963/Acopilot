export const jaComposables = {
    useChat: {
        errors: {
            sendFailed: 'メッセージの送信に失敗しました',
            retryFailed: '再試行に失敗しました',
            editRetryFailed: '編集再試行に失敗しました',
            deleteFailed: '削除に失敗しました',
            streamError: 'ストリームレスポンスエラー',
            loadHistoryFailed: '履歴の読み込みに失敗しました'
        }
    },
    useConversations: {
        defaultTitle: 'タイトルなし',
        newChatTitle: '新しい会話',
        errors: {
            loadFailed: '会話の読み込みに失敗しました',
            createFailed: '会話の作成に失敗しました',
            deleteFailed: '会話の削除に失敗しました',
            updateTitleFailed: 'タイトルの更新に失敗しました'
        },
        relativeTime: {
            justNow: 'たった今',
            minutesAgo: '{minutes} 分前',
            hoursAgo: '{hours} 時間前',
            daysAgo: '{days} 日前'
        }
    },
    useAttachments: {
        errors: {
            validationFailed: '添付ファイルの検証に失敗しました',
            createThumbnailFailed: 'サムネイルの作成に失敗しました',
            createVideoThumbnailFailed: '動画サムネイルの作成に失敗しました',
            readFileFailed: 'ファイルの読み取りに失敗しました',
            loadVideoFailed: '動画の読み込みに失敗しました',
            readResultNotString: '読み取り結果が文字列ではありません'
        }
    }
};
