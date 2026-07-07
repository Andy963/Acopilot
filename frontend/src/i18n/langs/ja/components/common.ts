export const jaComponentsCommon = {
    confirmDialog: {
        title: '確認',
        message: 'この操作を実行してもよろしいですか？',
        confirm: '確認',
        cancel: 'キャンセル'
    },
    deleteDialog: {
        title: 'メッセージを削除',
        message: 'このメッセージを削除してもよろしいですか？',
        messageWithCount: 'このメッセージを削除してもよろしいですか？これにより後続の {count} 件のメッセージも削除され、合計 {total} 件のメッセージが削除されます。',
        checkpointHint: 'このメッセージの前にバックアップが検出されました。削除前にそのバックアップポイントに復元して、ファイルの変更を回復することができます。',
        cancel: 'キャンセル',
        delete: '削除',
        directDelete: '直接削除',
        restoreAndDelete: '復元して削除',
        restoreToUserMessage: 'ユーザーメッセージ前に復元',
        restoreToAssistantMessage: 'アシスタントメッセージ前に復元',
        restoreToToolBatch: 'バッチツール実行前に復元',
        restoreToTool: '{toolName} 実行前に復元'
    },
    editDialog: {
        title: 'メッセージを編集',
        placeholder: '新しいメッセージ内容を入力...（添付ファイルを貼り付け、Shift+ドラッグでパスを追加）',
        addAttachment: '添付ファイルを追加',
        checkpointHint: 'このメッセージの前にツール実行のバックアップが検出されました。ツール実行前に復元してから編集することで、ファイルの変更を回復できます。',
        cancel: 'キャンセル',
        save: '保存',
        restoreToUserMessage: 'ユーザーメッセージ前に復元',
        restoreToAssistantMessage: 'アシスタントメッセージ前に復元',
        restoreToToolBatch: 'バッチツール実行前に復元',
        restoreToTool: '{toolName} 実行前に復元'
    },
    retryDialog: {
        title: 'メッセージを再試行',
        message: 'このメッセージを再試行してもよろしいですか？これによりこのメッセージと後続のメッセージが削除され、新しい AI レスポンスをリクエストします。',
        checkpointHint: 'このメッセージの前にツール実行のバックアップが検出されました。ツール実行前に復元してから再試行できます。',
        cancel: 'キャンセル',
        retry: '再試行',
        directRetry: '直接再試行',
        restoreAndRetry: '復元して再試行',
        restoreToUserMessage: 'ユーザーメッセージ前に復元',
        restoreToAssistantMessage: 'アシスタントメッセージ前に復元',
        restoreToToolBatch: 'バッチツール実行前に復元',
        restoreToTool: '{toolName} 実行前に復元'
    },
    dependencyWarning: {
        title: '依存関係が必要です',
        defaultMessage: 'この機能には以下の依存関係が必要です：',
        hint: '移動先：',
        linkText: 'ツール設定',
        installMissing: '不足分をインストール',
        installing: 'インストール中...',
        copyFailureLog: '失敗ログをコピー'
    },
    emptyState: {
        noData: 'データがありません',
        noResults: '検索結果がありません'
    },
    tooltip: {
        copied: 'コピーしました',
        copyFailed: 'コピーに失敗しました'
    },
    modal: {
        close: '閉じる'
    },
    markdown: {
        copyCode: 'コードをコピー',
        copied: 'コピーしました',
        imageLoadFailed: '画像の読み込みに失敗しました'
    },
    contextInspectorModal: {
        title: 'コンテキストインスペクター',
        titleUsed: '使用されたコンテキスト',
        noData: 'コンテキストデータがありません',
        copyDebug: 'デバッグ情報をコピー',
        summary: {
            config: '設定',
            toolMode: 'ツールモード',
            tools: 'ツール',
            mcp: 'MCP',
            systemInstruction: 'システム指示',
            generatedAt: '生成日時'
        },
        injected: {
            title: '注入詳細',
            pinnedFiles: 'ピン留めファイル',
            pinnedPrompt: 'ピン留めプロンプト',
            pinnedSelections: '参照',
            attachments: '添付ファイル',
            missing: '見つかりません',
            pinnedPromptCustom: 'カスタム（{count} 文字）'
        },
        trim: {
            title: 'コンテキストのトリム',
            fullHistory: '履歴メッセージ数',
            trimmedHistory: '送信メッセージ数',
            trimStartIndex: 'トリム開始インデックス',
            lastSummaryIndex: '最後の要約インデックス',
            summaryPreview: 'コンテキスト要約',
            summarizedMessages: '要約済みメッセージ数',
            keptRounds: '保持ラウンド数'
        },
        tools: {
            title: 'ツール定義'
        },
        modules: {
            title: 'システムプロンプトのセクション',
            labels: {
                text: 'テキスト',
                environment: '環境',
                workspaceFiles: 'ワークスペースファイル',
                pinnedFiles: 'ピン留めファイル',
                tools: 'ツール',
                mcpTools: 'MCP ツール',
                guidelines: 'ガイドライン',
                openTabs: '開いているタブ',
                activeEditor: 'アクティブエディタ',
                diagnostics: '診断',
                selectionReferences: '選択範囲の参照'
            }
        },
        raw: {
            title: 'システム指示 (Raw)'
        }
    }
};
