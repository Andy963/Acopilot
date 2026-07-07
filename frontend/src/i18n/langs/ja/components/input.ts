export const jaComponentsInput = {
    placeholder: 'メッセージを入力...',
    placeholderHint: 'メッセージを入力...（Enter で送信、添付ファイルを貼り付け、Shift+ドラッグまたは@でパスを追加）',
    send: 'メッセージを送信',
    stopGenerating: '生成を停止',
    attachFile: 'ファイルを添付',
    pinnedFiles: 'ピン留めコンテキスト',
    createPlan: 'Plan & Run',
    summarizeContext: 'コンテキストを要約',
    summarizeKeepRoundsHint: '直近 {count} ラウンドを保持',
    selectChannel: 'チャンネルを選択',
    selectModel: 'モデルを選択',
    configureModelLink: 'モデルを設定',
    configureModelHint: 'モデルが設定されていません。クリックしてチャンネル設定を開く',
    clickToPreview: 'クリックしてプレビュー',
    remove: '削除',
    tokenUsage: '使用量',
    context: 'コンテキスト',
    autoSummarizeThreshold: '自動要約しきい値',
    openContextInspectorHint: 'クリックして詳細な内訳を表示',
    fileNotExists: 'ファイルが存在しません',
    contextLifecycle: {
        label: 'コンテキスト案内',
        atFile: '@file は今回のリクエストにパスを挿入し、モデルはツールで読み取れます。',
        attachment: '添付ファイルは現在のメッセージにのみ送信されます。',
        pinned: 'ピン留めコンテキストは削除するまで会話ターンをまたいで注入されます。'
    },
    attachmentSupport: {
        supported: '対応',
        converted: 'テキスト',
        unsupported: '非対応',
        unknown: '不明',
        tokenEstimate: '約 {tokens} tokens',
        truncated: '送信前に切り詰められる可能性があります',
        truncatedShort: '切り詰め'
    },
    channelSelector: {
        placeholder: '設定を選択',
        searchPlaceholder: 'チャンネルを検索...',
        noMatch: '一致するチャンネルがありません'
    },
    modelSelector: {
        placeholder: 'モデルを選択',
        searchPlaceholder: 'モデルを検索...',
        noMatch: '一致するモデルがありません',
        addInSettings: '設定でモデルを追加してください'
    },
    pinnedFilesPanel: {
        title: 'ピン留めコンテキスト',
        description: 'ピン留めファイルは毎回の会話で送信；Skill/カスタムプロンプトはここで選択できます',
        loading: '読み込み中...',
        empty: 'ピン留めファイルがありません',
        notExists: '存在しません',
        dragHint: 'Shift を押しながらワークスペース内のテキストファイルをここにドラッグして追加',
        dropHint: 'ファイルを追加するにはマウスを離してください',
        tabs: {
            files: 'ファイル',
            refs: '参照',
            skill: 'Skill',
            custom: 'カスタム'
        },
        refs: {
            empty: '参照がありません',
            open: '開く',
            clear: '参照をクリア',
            truncated: '切り詰め'
        },
        skill: {
            selectLabel: 'Skill を選択',
            loading: '読み込み中...',
            empty: 'Skill がありません',
            pickOne: 'Skill を選択してください',
            manageHint: '設定 > システムプロンプト で Skills を管理'
        },
        custom: {
            presetsLabel: '保存済みプロンプト',
            presetsEmptyOption: '保存済みプロンプトを選択',
            presetsEmpty: '保存済みプロンプトはまだありません。下で保存するとプロジェクトを超えて再利用できます。',
            selectedPresetHint: '選択中のプロンプト: {name}',
            label: 'カスタムプロンプト',
            placeholder: '現在の会話にのみ適用されるプロンプトを入力...',
            save: 'この会話で使用',
            clear: 'クリア',
            hint: 'これは現在の会話にのみ適用されます。プロジェクトを超えて再利用するには下で保存してください。',
            saveAsPresetLabel: '再利用可能なプロンプトとして保存',
            saveAsPresetNamePlaceholder: 'プロンプト名',
            saveAsPresetButton: 'プロンプトを保存',
            saveAsPresetHint: '保存したプロンプトはグローバルに保持され、別プロジェクトでも選択できます'
        },
        workspaceDefaultApplied: 'このプロジェクトで記憶されたピン留めプロンプトを適用しました'
    },
    messageContextOverrides: {
        title: '今回のコンテキスト',
        description: '次のメッセージにのみ適用（送信後に自動でデフォルトに戻ります）',
        reset: 'リセット',
        inherit: 'デフォルト',
        on: 'ON',
        off: 'OFF',
        items: {
            pinnedPrompt: 'ピン留めプロンプト',
            pinnedFiles: 'ピン留めファイル',
            workspaceFiles: 'ワークスペースファイル',
            openTabs: '開いているタブ',
            activeEditor: 'アクティブエディタ',
            diagnostics: '診断',
            tools: 'ツール'
        }
    },
    filePicker: {
        title: 'ファイルを選択',
        subtitle: '@ の後に入力してパスをフィルタリング',
        loading: '検索中...',
        empty: '一致するファイルが見つかりません',
        navigate: 'ナビゲート',
        select: '選択',
        close: '閉じる'
    },
    notifications: {
        summarizeFailed: '要約に失敗しました: {error}',
        summarizeSuccess: '{count} 件のメッセージを正常に要約しました',
        summarizeError: '要約に失敗しました: {error}',
        holdShiftToDrag: 'Shift キーを押しながらファイルをドラッグしてください',
        fileNotInWorkspace: 'ファイルがワークスペース内にありません',
        fileNotInAnyWorkspace: 'ファイルが開いているワークスペースにありません',
        fileInOtherWorkspace: 'ファイルは別のワークスペースに属しています: {workspaceName}',
        fileAdded: 'ピン留めファイルを追加しました: {path}',
        addFailed: '追加に失敗しました: {error}',
        loadPinnedPromptPresetsFailed: '保存済みプロンプトの読み込みに失敗しました: {error}',
        cannotGetFilePath: 'ファイルパスを取得できません。VSCode エクスプローラーまたはタブからドラッグしてください',
        fileNotMatchOrNotInWorkspace: 'ファイルがワークスペース内にないか、ファイル名が一致しません',
        removeFailed: '削除に失敗しました: {error}'
    }
};
