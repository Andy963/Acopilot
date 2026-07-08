export const jaComponentsSettingsPart2b = {
    summarizeSettings: {
        description: 'コンテキスト要約機能は会話履歴を圧縮してトークン使用量を削減できます。会話が長くなりすぎた場合、手動または自動で要約をトリガーして、古い会話内容を要約に圧縮できます。',
        manualSection: {
            title: '手動要約',
            description: '入力ボックスの右側にある圧縮ボタンをクリックすると、手動でコンテキスト要約をトリガーできます。要約された内容は元の会話履歴を置き換えます。'
        },
        autoSection: {
            title: '自動要約',
            comingSoon: '近日公開',
            enable: '自動要約を有効化',
            enableHint: 'トークン使用量がしきい値を超えたときに自動的に要約をトリガー',
            threshold: 'トリガーしきい値',
            thresholdUnit: '%',
            thresholdHint: 'トークン使用量がこのパーセンテージに達したときに自動要約をトリガー'
        },
        optionsSection: {
            title: '要約オプション',
            keepRounds: '最近のラウンドを保持',
            keepRoundsUnit: 'ラウンド',
            keepRoundsHint: '最近の N ラウンドの会話を要約から除外し、コンテキストの連続性を確保',
            prompt: '要約プロンプト',
            promptPlaceholder: '要約時に使用するプロンプトを入力...',
            promptHint: 'AI が要約を実行する際に使用する指示'
        },
        modelSection: {
            title: '専用要約モデル',
            useSeparate: '専用要約モデルを使用',
            useSeparateHint: '有効にすると、要約は会話で使用するモデルではなく、以下で指定したモデルを使用します。\nコストを節約するために、より安価なモデルを選択できます。',
            currentModelHint: '現在、会話モデルを要約に使用しています',
            selectChannel: 'チャンネルを選択',
            selectChannelPlaceholder: '要約用のチャンネルを選択',
            selectChannelHint: '有効なチャンネルのみ表示されます',
            selectModel: 'モデルを選択',
            selectModelPlaceholder: '要約用のモデルを選択',
            selectModelHint: 'このチャンネルの設定に追加されたモデルのみ表示されます。\nモデルを追加するには、チャンネル設定に移動して設定してください。',
            warningHint: 'チャンネルとモデルを選択してください。そうしないと、会話モデルが要約に使用されます',
            invalidSelectionHint: '選択した要約チャンネルまたはモデルが存在しません。チャンネル設定で更新してください。',
            openChannelSettings: 'チャンネル設定を開く'
        }
    },
    settingsPanel: {
        title: '設定',
        backToChat: '会話に戻る',
        sections: {
            channel: {
                title: 'チャンネル設定',
                description: 'API チャンネルとモデルを設定'
            },
            tools: {
                title: 'ツール設定',
                description: '利用可能なツールを管理および設定'
            },
            autoExec: {
                title: '自動実行',
                description: 'ツール実行時の確認動作を設定'
            },
            mcp: {
                title: 'MCP 設定',
                description: 'Model Context Protocol サーバーを設定'
            },
            checkpoint: {
                title: 'チェックポイント設定',
                description: 'コードベースのスナップショットバックアップとロールバックを設定'
            },
            summarize: {
                title: 'コンテキスト要約',
                description: '会話履歴を圧縮してトークン使用量を削減'
            },
            imageGen: {
                title: '画像生成',
                description: 'AI 画像生成ツールを設定'
            },
            context: {
                title: 'コンテキスト認識',
                description: 'AI に送信されるワークスペースコンテキスト情報を設定'
            },
            prompt: {
                title: 'システムプロンプト',
                description: 'システムプロンプトの構造と内容をカスタマイズ'
            },
            tokenCount: {
                title: 'トークンカウント',
                description: 'トークン数を計算するための API を設定'
            },
            general: {
                title: '一般設定',
                description: '基本的な設定オプション'
            }
        },
        proxy: {
            title: 'ネットワークプロキシ',
            description: 'API リクエスト用の HTTP プロキシを設定',
            enable: 'プロキシを有効化',
            url: 'プロキシアドレス',
            urlPlaceholder: 'http://127.0.0.1:7890',
            urlError: '有効なプロキシアドレス（http:// または https://）を入力してください',
            save: '保存',
            saveSuccess: '保存しました',
            saveFailed: '保存に失敗しました'
        },
        language: {
            title: 'インターフェース言語',
            description: '表示言語を選択',
            placeholder: '言語を選択',
            autoDescription: 'VS Code の言語設定に自動的に従う'
        },
        appInfo: {
            title: 'アプリケーション情報',
            name: 'acopilot',
            version: 'バージョン：{version}',
            repository: 'リポジトリ',
            developer: '開発者'
        }
    },
    toolSettings: {
        files: {
            applyDiff: {
                autoApply: '変更を自動適用',
                enableAutoApply: '自動適用を有効化',
                enableAutoApplyDesc: '有効にすると、AI の変更は指定された遅延後に自動的に保存され、手動確認は不要です',
                autoSaveDelay: '自動保存遅延',
                delayTime: '遅延時間',
                delayTimeDesc: '変更が表示されてから自動保存するまでの待機時間',
                delay1s: '1 秒',
                delay2s: '2 秒',
                delay3s: '3 秒',
                delay5s: '5 秒',
                delay10s: '10 秒',
                infoEnabled: '現在の設定：AI がファイルを変更すると、{delay} 後に自動的に保存され、実行が続行されます。',
                infoDisabled: '現在の設定：AI がファイルを変更した後、エディターで Ctrl+S を手動で押して変更を確認して保存する必要があります。'
            },
            listFiles: {
                ignoreList: '無視リスト',
                ignoreListHint: '（ワイルドカードをサポート、例: *.log, temp*）',
                inputPlaceholder: '無視するファイルまたはディレクトリパターンを入力...',
                deleteTooltip: '削除',
                addButton: '追加'
            }
        },
        search: {
            findFiles: {
                excludeList: '除外パターン',
                excludeListHint: '（glob 形式、例: **/node_modules/**）',
                inputPlaceholder: '除外するファイルまたはディレクトリパターンを入力...',
                deleteTooltip: '削除',
                addButton: '追加'
            },
            searchInFiles: {
                excludeList: '除外パターン',
                excludeListHint: '（glob 形式、例: **/node_modules/**）',
                inputPlaceholder: '除外するファイルまたはディレクトリパターンを入力...',
                deleteTooltip: '削除',
                addButton: '追加'
            },
            replaceInFiles: {
                excludeList: '置換除外パターン',
                excludeListHint: '（glob 形式、例: **/node_modules/**）',
                inputPlaceholder: '置換から除外するファイルまたはディレクトリパターンを入力...',
                deleteTooltip: '削除',
                addButton: '追加'
            }
        },
        lsp: {
            locate: {
                title: 'Locate',
                hint: '（任意）Locate クエリを自動判定して起動します',
                useChatModelOption: '現在の会話モデルに従う（上書きしない）',
                modelLabel: 'Locate モデル',
                modelPlaceholder: '空欄の場合は現在の会話モデル（例：gemini-2.5-flash）',
                autoTriggerLabel: '自動トリガー',
                autoTriggerHint: '有効にすると、メッセージがキーワードに一致したとき Locate モードを自動で起動します',
                triggerKeywordsLabel: 'トリガーキーワード',
                triggerKeywordsHint: '1 行に 1 つ。大文字/小文字を区別しない部分一致',
                triggerKeywordsPlaceholder: '例:\\nwhere is\\nopen file\\ndefinition\\nusages'
            }
        },
        terminal: {
            executeCommand: {
                shellEnv: 'シェル環境',
                defaultBadge: 'デフォルト',
                available: '利用可能',
                unavailable: '利用不可',
                setDefaultTooltip: 'デフォルトに設定',
                executablePath: '実行ファイルパス（オプション）：',
                executablePathPlaceholder: '空白の場合、システム PATH のパスを使用',
                execTimeout: '実行タイムアウト',
                timeoutHint: 'この時間を超えるコマンドは自動的に終了されます',
                timeout30s: '30 秒',
                timeout1m: '1 分',
                timeout2m: '2 分',
                timeout5m: '5 分',
                timeout10m: '10 分',
                timeoutUnlimited: '無制限',
                maxOutputLines: '最大出力行数',
                maxOutputLinesHint: 'AI に送信されるターミナル出力の最後の N 行、出力過多を避けるため',
                unlimitedLines: '無制限',
                risk: {
                    title: 'コマンド安全ポリシー',
                    enabled: 'コマンドリスクポリシーを有効化',
                    autoExecuteUpTo: {
                        label: '自動実行の上限',
                        hint: 'このリスクレベルを超えるコマンドは、execute_command が自動実行でも確認が必要です',
                        low: '低リスクのみ',
                        medium: '中リスクまで'
                    },
                    confirmOn: '以下は常に確認を要求',
                    categories: {
                        destructive: '破壊的操作（rm/del/リダイレクト）',
                        gitHistory: 'Git の破壊的操作（reset/clean/push --force）',
                        privilege: '権限昇格（sudo）',
                        network: 'ネットワークダウンロード/インストール'
                    },
                    allowPatterns: '許可リスト（正規表現、1 行 1 件）',
                    allowPatternsHint: '許可リストに一致するコマンドは確認をスキップ（大文字小文字を区別しない正規表現）',
                    denyPatterns: '拒否リスト（正規表現、1 行 1 件）',
                    denyPatternsHint: '拒否リストに一致するコマンドはブロック（大文字小文字を区別しない正規表現）'
                },
                tips: {
                    onlyEnabledUsed: '• 有効で利用可能なシェルのみが AI で使用されます',
                    statusMeaning: '• ✓ は利用可能、✗ は利用不可を意味します',
                    windowsRecommend: '• Windows では PowerShell の使用をお勧めします（UTF-8 をサポート）',
                    gitBashRequire: '• Git Bash には Git for Windows のインストールが必要です',
                    wslRequire: '• WSL には Windows Subsystem for Linux の有効化が必要です',
                    confirmSettings: '• 実行確認の設定については、「自動実行」設定タブに移動してください'
                }
            }
        },
        media: {
            common: {
                returnImageToAI: '画像を直接 AI に返す',
                returnImageDesc: '有効にすると、処理結果の画像 base64 がツールレスポンスとして直接 AI に返され、AI は画像コンテンツを直接表示・分析できます。',
                returnImageDescDetail: '無効にすると、テキスト説明（ファイルパスなど）のみが返され、AI が画像を表示するには read_file ツールを呼び出す必要があります。'
            },
            cropImage: {
                title: '画像のトリミング',
                description: '有効にすると、AI はトリミング効果を直接確認し、領域が正しいかどうかを判断できます。無効にするとトークン消費を節約できます。'
            },
            generateImage: {
                title: '画像生成',
                description: '有効にすると、AI は生成された画像効果を直接確認し、再生成や調整が必要かどうかを判断できます。無効にするとトークン消費を節約できます。'
            },
            removeBackground: {
                title: '背景除去',
                description: '有効にすると、AI は背景除去効果を直接確認し、主題の説明の調整や再処理が必要かどうかを判断できます。無効にするとトークン消費を節約できます。'
            },
            resizeImage: {
                title: '画像のリサイズ',
                description: '有効にすると、AI はリサイズ効果を直接確認し、サイズが適切かどうかを判断できます。無効にするとトークン消費を節約できます。'
            },
            rotateImage: {
                title: '画像の回転',
                description: '有効にすると、AI は回転効果を直接確認し、角度が正しいかどうかを判断できます。無効にするとトークン消費を節約できます。'
            }
        },
        common: {
            loading: '読み込み中...',
            loadingConfig: '設定を読み込み中...',
            saving: '保存中...',
            error: 'エラー',
            retry: '再試行'
        }
    },
    toolsSettings: {
        mcpNote: 'MCP ツールは MCP サーバーから提供され、この画面では無効化できません',
        mcpDisableTooltip: 'MCP サーバー提供のため無効化できません',
        maxIterations: {
            label: 'ターンあたりの最大ツール呼び出し回数',
            hint: 'AI の無限ツール呼び出しループを防止、-1 で無制限',
            unit: '回'
        },
        actions: {
            refresh: '更新',
            enableAll: 'すべて有効化',
            disableAll: 'すべて無効化'
        },
        badges: {
            enabled: '有効',
            autoExec: '自動'
        },
        columns: {
            enabled: '有効',
            auto: '自動',
            config: '設定'
        },
        exec: {
            autoEnabled: '有効'
        },
        dangerConfirm: {
            title: '自動実行を有効にしますか？',
            message: '危険なツール {tool} に対して自動実行を有効にしようとしています。取り消せない変更が発生する可能性があります。続行しますか？',
            confirm: '有効にする',
            cancel: 'キャンセル'
        },
        enableAllDangerous: {
            title: '自動実行を有効化',
            message: '危険なツール（delete_file / execute_command / replace_in_files）が検出されました。これらも自動実行にしますか？',
            confirm: '危険なツールも含める',
            cancel: '危険なツールを除外'
        },
        loading: 'ツールリストを読み込み中...',
        empty: '利用可能なツールがありません',
        categories: {
            file: 'ファイル操作',
            search: '検索',
            terminal: 'ターミナル',
            lsp: 'コードインテリジェンス',
            media: 'メディア処理',
            mcp: 'MCP',
            other: 'その他'
        },
        descriptions: {
            list_files: 'ワークスペース内のファイルとサブディレクトリを一覧表示します。必要に応じて再帰的に展開できます。',
            read_file: '1 つ以上のファイルを読み取ります。開始行と終了行も指定できます。',
            write_file: '1 つ以上のファイルを書き込みます。ファイル作成や内容の置き換えに使います。',
            apply_diff: 'ファイルに精密な検索置換パッチを適用します。',
            delete_file: '指定した 1 つ以上のファイルを削除します。',
            create_directory: '1 つ以上のディレクトリを作成します。存在しない親ディレクトリも作成します。',
            find_files: 'glob パターンでファイルパスを検索します。',
            search_in_files: 'キーワードまたは正規表現でファイル内容を検索します。',
            replace_in_files: '複数ファイルでテキストを検索・置換します。プレビューにも対応します。',
            execute_command: 'Shell コマンドを実行し、その出力を返します。',
            locate: '指定したファイル位置を開く、または表示します。',
            open_file: 'エディタでファイルを開き、必要に応じて範囲を表示します。',
            goto_definition: 'シンボルの定義位置へ移動します。',
            find_references: '指定したシンボルの参照位置を検索します。',
            get_usages: 'シンボルの使用箇所を検索し、必要に応じて前後の文脈行も返します。',
            get_symbols: 'ファイルまたはディレクトリ内のコードシンボルを一覧表示します。',
            get_errors: 'エラーや警告など、ワークスペースの診断情報を取得します。',
            generate_image: 'プロンプトと任意の参照画像から画像を生成します。',
            remove_background: '画像の背景を削除し、透明画像やマスクを保存できます。',
            crop_image: '画像を指定範囲にトリミングします。',
            resize_image: '画像を指定した幅と高さにリサイズします。',
            rotate_image: '画像を指定角度で回転します。'
        },
        dependency: {
            required: '依存関係が必要',
            requiredTooltip: 'このツールを使用するには依存関係のインストールが必要です',
            disabledTooltip: 'ツールが無効か、依存関係が不足しています',
            installSuccess: '依存関係をインストールしました: {dependencies}',
            copyLogSuccess: '依存関係の失敗ログをコピーしました',
            copyLogFailed: '依存関係の失敗ログのコピーに失敗しました'
        },
        config: {
            tooltip: 'ツールを設定'
        }
    },
    tokenCountSettings: {
        description: '正確なトークン数を計算するための API を設定します（設定/デバッグでのトークン統計用）。追加の遅延やレート制限の影響を避けるため、チャット送信とコンテキスト裁剪はデフォルトでローカル推定を使用します。',
        hint: '未設定または API 呼び出し失敗時は、自動的にローカル推定にフォールバックします。',
        enableChannel: 'このチャンネルのトークンカウントを有効化',
        baseUrl: 'API URL',
        apiKey: 'API Key',
        apiKeyPlaceholder: 'API Key を入力',
        model: 'モデル名',
        geminiUrlPlaceholder: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:countTokens?key={key}',
        geminiUrlHint: '{model} と {key} をプレースホルダーとして使用',
        geminiModelPlaceholder: 'gemini-2.5-pro',
        anthropicUrlPlaceholder: 'https://api.anthropic.com/v1/messages/count_tokens',
        anthropicModelPlaceholder: 'claude-sonnet-4-5',
        comingSoon: '近日公開',
        customApi: 'カスタム API',
        openaiDocTitle: 'OpenAI 互換 API インターフェース',
        openaiDocDesc: 'OpenAI はスタンドアロンのトークンカウント API を提供していません。自己ホスティングまたはサードパーティの互換トークンカウントサービスがある場合は、ここで設定できます。',
        openaiUrlPlaceholder: 'https://your-api.example.com/count-tokens',
        openaiUrlHint: 'カスタムトークンカウント API エンドポイント',
        openaiModelPlaceholder: 'gpt-4o',
        apiDocumentation: 'API 仕様',
        requestExample: 'リクエスト例',
        requestBody: '// リクエストボディ',
        responseFormat: '// レスポンス形式',
        openaiDocNote: 'API は total_tokens フィールドを含む JSON レスポンスを返す必要があります。リクエストボディは OpenAI Messages 形式を使用します。',
        saveSuccess: '設定を保存しました',
        saveFailed: '保存に失敗しました'
    },
    storageSettings: {
        title: 'ストレージパス',
        description: '会話履歴、チェックポイントなどのデータの保存場所を設定',
        currentPath: '現在のストレージパス',
        customPath: 'カスタムパス',
        customPathPlaceholder: 'カスタムストレージパスを入力...',
        customPathHint: '空白の場合はデフォルトパス（拡張機能ストレージディレクトリ）を使用',
        browse: '参照',
        apply: '適用',
        reset: 'デフォルトにリセット',
        migrate: 'データを移行',
        migrateHint: '既存のデータを新しいパスに移行',
        migrating: '移行中...',
        validating: '検証中...',
        validation: {
            valid: 'パスは有効です',
            invalid: 'パスは無効です',
            checking: '確認中...'
        },
        dialog: {
            migrateTitle: 'データ移行の確認',
            migrateMessage: '既存のデータを新しいパスに移行しますか？すべての会話履歴とチェックポイントがコピーされます。',
            migrateWarning: '移行中はウィンドウを閉じないでください',
            confirm: '移行を確認',
            cancel: 'キャンセル'
        },
        notifications: {
            pathUpdated: 'ストレージパスが更新されました',
            pathReset: 'ストレージパスがデフォルトにリセットされました',
            migrationSuccess: 'データ移行が完了しました。変更を有効にするにはウィンドウを再読み込みしてください',
            migrationFailed: 'データ移行に失敗しました: {error}',
            validationFailed: 'パスの検証に失敗しました: {error}'
        },
        reloadWindow: 'ウィンドウを再読み込み'
    }
};
