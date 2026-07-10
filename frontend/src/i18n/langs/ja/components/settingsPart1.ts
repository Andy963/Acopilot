export const jaComponentsSettingsPart1 = {
    title: '設定',
    tabs: {
        channel: 'チャンネル',
        tools: 'ツール',
        autoExec: '自動実行',
        checkpoint: 'チェックポイント',
        imageGen: '画像生成',
        dependencies: '拡張機能の依存関係',
        context: 'コンテキスト',
        prompt: 'プロンプト',
        tokenCount: 'トークンカウント',
        general: '一般'
    },
    channelSettings: {
        selector: {
            label: '現在の設定',
            placeholder: '設定を選択',
            rename: '名前を変更',
            add: '新規設定',
            delete: '設定を削除',
            inputPlaceholder: '設定名を入力',
            confirm: '確認',
            cancel: 'キャンセル'
        },
        dialog: {
            new: {
                title: '新規設定',
                nameLabel: '設定名',
                namePlaceholder: '例：マイ Gemini',
                typeLabel: 'API タイプ',
                typePlaceholder: 'API タイプを選択',
                cancel: 'キャンセル',
                create: '作成'
            },
            delete: {
                title: '設定を削除',
                message: '設定 "{name}" を削除してもよろしいですか？この操作は元に戻せません。',
                atLeastOne: '少なくとも 1 つの設定を保持する必要があります',
                cancel: 'キャンセル',
                confirm: '確認'
            }
        },
        form: {
            apiUrl: {
                label: 'API URL',
                placeholder: 'API URL を入力',
                placeholderResponses: 'API ベースアドレスを入力してください（例：https://api.openai.com/v1）'
            },
            apiKey: {
                label: 'API Key',
                placeholder: 'API Key を入力',
                show: '表示',
                hide: '非表示',
                useAuthorization: 'Authorization形式で送信',
                useAuthorizationHintGemini: 'x-goog-api-keyをAuthorization: Bearer形式に変換して送信',
                useAuthorizationHintAnthropic: 'x-api-keyをAuthorization: Bearer形式に変換して送信'
            },
            connectionTest: {
                button: '接続をテスト',
                testing: 'テスト中...',
                hint: '最小リクエストで API Key、URL、選択中のモデルを確認します'
            },
            stream: {
                label: 'ストリーム出力'
            },
            channelType: {
                label: 'チャンネルタイプ',
                gemini: 'Gemini API',
                openai: 'OpenAI API',
                'openai-responses': 'OpenAI Responses API',
                anthropic: 'Anthropic API'
            },
            toolMode: {
                label: 'ツール呼び出し形式',
                placeholder: 'ツール呼び出し形式を選択',
                functionCall: {
                    label: 'Function Calling',
                    description: 'ネイティブ関数呼び出しを使用'
                },
                xml: {
                    label: 'XML プロンプト',
                    description: 'XML 形式のプロンプトを使用'
                },
                json: {
                    label: 'JSON 境界マーカー',
                    description: 'JSON 形式 + 境界マーカーを使用（推奨）'
                },
                boundaryHint: 'ここではこのチャンネルのリクエストプロトコル能力を制御します。ツールの有効化と自動実行は Tools 設定で管理してください。',
                openToolsSettings: 'Tools 設定を開く',
                hint: {
                    functionCall: 'Function Calling: API ネイティブの関数呼び出し機能を使用',
                    xml: 'XML プロンプト: ツールを XML 形式に変換してシステムプロンプトに挿入',
                    json: 'JSON 境界マーカー: JSON 形式 + <<<TOOL_CALL>>> 境界マーカーを使用（推奨）'
                },
                openaiWarning: 'OpenAI Function Call モードはマルチモーダルツール（read_file で画像を読み取り、generate_image、remove_background、crop_image、resize_image、rotate_image など）をサポートしていません。マルチモーダル機能を使用するには、XML または JSON モードに切り替えてください。'
            },
            multimodal: {
                label: 'マルチモーダルツールを有効化',
                supportedTypes: 'サポートされるファイル形式：',
                image: '画像',
                imageFormats: 'PNG、JPEG、WebP',
                document: 'ドキュメント',
                documentFormats: 'PDF',
                capabilities: 'マルチモーダルツールの機能：',
                table: {
                    channel: 'チャンネル / モード',
                    readImage: '画像を読み取り',
                    readDocument: 'ドキュメントを読み取り',
                    generateImage: '画像を生成',
                    historyMultimodal: '履歴マルチモーダル'
                },
                channels: {
                    geminiAll: 'Gemini（すべて）',
                    anthropicAll: 'Anthropic（すべて）',
                    openaiXmlJson: 'OpenAI（XML/JSON）',
                    openaiResponses: 'OpenAI（Responses）',
                    openaiFunction: 'OpenAI（Function Call）'
                },
                legend: {
                    supported: 'サポート',
                    notSupported: '非サポート'
                },
                notes: {
                    requireEnable: 'このオプションを有効にすると、read_file で画像/ドキュメントを読み取り、generate_image、remove_background、crop_image、resize_image、rotate_image などのマルチモーダルツールを使用できます',
                    userAttachment: 'ユーザーが送信した添付ファイルはこの設定の影響を受けず、常にチャンネルのネイティブ機能に従って処理されます',
                    geminiAnthropic: 'Gemini / Anthropic: ツールは画像とドキュメントを直接返すことができ、画像生成機能をサポートします',
                    openaiResponses: 'OpenAI Responses：画像、PDF の読み取りをネイティブにサポートし、推論プロセスのリアルタイム表示をサポートします',
                    openaiXmlJson: 'OpenAI XML/JSON: 画像の読み取りと生成をサポートしますが、ドキュメントはサポートしていません'
                }
            },
            timeout: {
                label: 'タイムアウト (ms)',
                placeholder: '30000'
            },
            maxContextTokens: {
                label: '最大コンテキストトークン',
                placeholder: '128000',
                hint: 'コンテキスト使用量の表示上限値'
            },
            contextManagement: {
                title: 'コンテキスト管理',
                enableTitle: 'コンテキストしきい値検出を有効化',
                threshold: {
                    label: 'コンテキストしきい値',
                    placeholder: '80% または 100000',
                    hint: '合計トークン数がこのしきい値を超えると、古い会話ラウンドを自動的に破棄します。パーセンテージ（例：80%）または絶対値（例：100000）の 2 つの形式をサポートしています'
                },
                extraCut: {
                    label: '追加カット量',
                    placeholder: '0 または 10%',
                    hint: 'トリミング時に追加でカットするトークン数。実際の保持 = しきい値 - 追加カット量。パーセンテージまたは絶対値をサポート、デフォルトは 0'
                },
                autoSummarize: {
                    label: '自動要約（近日公開）',
                    enableTitle: '自動要約を有効化',
                    hint: '有効にすると、古いラウンドを破棄する前に要約します（機能開発中）'
                }
            },
            toolOptions: {
                title: 'ツール設定'
            },
            advancedOptions: {
                title: '詳細オプション'
            },
            customBody: {
                title: 'カスタム Body',
                enableTitle: 'カスタム Body を有効化'
            },
            customHeaders: {
                title: 'カスタムヘッダー',
                enableTitle: 'カスタムヘッダーを有効化'
            },
            autoRetry: {
                title: '自動リトライ',
                enableTitle: '自動リトライを有効化',
                retryCount: {
                    label: 'リトライ回数',
                    hint: 'API がエラーを返した場合の最大リトライ回数（1-10）'
                },
                retryInterval: {
                    label: '基本間隔 (ms)',
                    hint: 'リトライの基本待機時間、失敗ごとに倍増（指数バックオフ）'
                }
            },
            enabled: {
                label: 'この設定を有効化'
            },
            sections: {
                identityCredentials: '認証情報',
                capabilities: '機能',
                advancedConfig: '詳細設定'
            },
            status: {
                defaultConfig: 'デフォルト設定',
                toolsConfigured: '{count} ツール読み込み済み',
                localEstimate: 'ローカル推定',
                fieldsConfigured: '{count} フィールド定義済み',
                headersConfigured: '{count} Header',
                maxRetries: '最大 {count} 回',
                thresholdValue: '閾値'
            },
            capabilitySummary: {
                title: 'モデル機能サマリー',
                model: 'モデル',
                contextWindow: 'コンテキスト',
                maxOutput: '出力',
                toolProtocol: 'ツール',
                multimodal: 'マルチモーダル',
                reasoning: '推論',
                promptCache: 'Prompt Cache',
                stream: 'ストリーム',
                notSelected: '未選択',
                unknown: '不明',
                providerDefault: 'Provider デフォルト'
            },
            multimodalSummary: '画像 (PNG/JPG)、PDF。',
            viewCompatibility: '互換性マトリクスを見る'
        }
    },
    tools: {
        title: 'ツール設定',
        description: '利用可能なツールを管理および設定',
        enableAll: 'すべて有効化',
        disableAll: 'すべて無効化',
        toolName: 'ツール名',
        toolDescription: 'ツールの説明',
        toolEnabled: '有効ステータス'
    },
    autoExec: {
        title: '自動実行',
        intro: {
            title: 'ツール実行の確認',
            description: 'AI がツールを呼び出す際にユーザーの確認が必要かどうかを設定します。チェックすると自動実行（確認不要）、チェックを外すと実行前に確認が必要です。'
        },
        actions: {
            refresh: '更新',
            enableAll: 'すべて自動実行',
            disableAll: 'すべて確認必要'
        },
        status: {
            loading: 'ツールリストを読み込み中...',
            empty: '利用可能なツールがありません',
            autoExecute: '自動実行',
            needConfirm: '確認必要'
        },
        categories: {
            file: 'ファイル操作',
            search: '検索',
            terminal: 'ターミナル',
            lsp: 'コードインテリジェンス',
            media: 'メディア処理',
            other: 'その他'
        },
        badges: {
            dangerous: '危険'
        },
        tips: {
            dangerousDefault: '• 「危険」とマークされたツールは、デフォルトでユーザーの確認が必要です',
            deleteFileWarning: '• delete_file: ファイル削除は元に戻せないため、確認を有効にすることをお勧めします',
            executeCommandWarning: '• execute_command: ターミナルコマンドの実行はシステムに影響を与える可能性があります',
            useWithCheckpoint: '• 誤操作時に復元できるよう、チェックポイント機能と併用することをお勧めします'
        }
    },
    checkpoint: {
        title: 'チェックポイント設定',
        loading: '設定を読み込み中...',
        sections: {
            enable: {
                label: 'チェックポイント機能を有効化',
                description: 'ツール実行前後にコードベースのスナップショットを自動作成し、ワンクリックでロールバックをサポート'
            },
            presets: {
                title: 'シナリオプリセット',
                description: 'before/after の詳細スイッチを手動調整せずに保護戦略を適用',
                items: {
                    safe: {
                        title: '安全モード',
                        description: '変更系ツールの実行前後を保護し、ユーザーメッセージ前のチェックポイントも有効にします。'
                    },
                    light: {
                        title: '軽量モード',
                        description: '変更系ツールの実行前バックアップを維持し、実行後スナップショットを減らします。'
                    },
                    dangerous: {
                        title: '危険ツール保護モード',
                        description: 'apply_diff、delete_file、execute_command、replace_in_files の実行前後を保護します。'
                    },
                    off: {
                        title: 'オフモード',
                        description: '現在の詳細設定を保持したまま、チェックポイント作成を無効化します。'
                    }
                }
            },
            messages: {
                title: 'メッセージタイプのチェックポイント',
                description: 'ユーザーメッセージとモデルメッセージのチェックポイントを作成するかどうかを選択（ツール呼び出しとは独立）',
                beforeLabel: 'メッセージ前',
                afterLabel: 'メッセージ後',
                types: {
                    user: {
                        name: 'ユーザーメッセージ',
                        description: 'ユーザーが送信したメッセージ'
                    },
                    model: {
                        name: 'モデルメッセージ',
                        description: 'モデルからの応答メッセージ（ツール呼び出しを除く）'
                    }
                },
                options: {
                    modelOuterLayerOnly: {
                        label: 'ツールが連続して呼び出される場合、最外層にのみモデルメッセージのチェックポイントを作成',
                        hint: '有効にすると、モデルメッセージの「メッセージ前」チェックポイントは最初のイテレーションでのみ作成され、「メッセージ後」チェックポイントは最後のイテレーション（ツール呼び出しなし）でのみ作成されます。無効にすると、各イテレーションでチェックポイントが作成されます。'
                    },
                    mergeUnchanged: {
                        label: 'メッセージ前後で内容が変更されていない場合、チェックポイントをマージして表示',
                        hint: '有効にすると、メッセージ前後のチェックポイント内容が同じ場合、単一の「変更なし」チェックポイントとしてマージ表示されます。無効にすると、前後のチェックポイントは常に別々に表示されます。'
                    }
                }
            },
            tools: {
                title: 'ツールバックアップ設定',
                description: '実行前後にバックアップが必要なツールを選択',
                beforeLabel: '実行前',
                afterLabel: '実行後',
                empty: '利用可能なツールがありません'
            },
            other: {
                title: 'その他の設定',
                maxCheckpoints: {
                    label: '最大チェックポイント数',
                    placeholder: '-1',
                    hint: 'この数を超えると古いチェックポイントを自動的にクリーンアップします。-1 は無制限を意味します'
                },
                autoCleanup: {
                    label: '起動時に期限切れの会話を自動クリーンアップ',
                    hint: '有効にすると、30日以上更新されていない会話を削除し、チェックポイント、添付、diff、スナップショットなどのデータもクリーンアップしてストレージを解放します'
                }
            },
            cleanup: {
                title: 'チェックポイントのクリーンアップ',
                description: '会話ごとにチェックポイントをクリーンアップしてストレージを解放',
                searchPlaceholder: '会話タイトルを検索...',
                loading: '読み込み中...',
                noMatch: '一致する会話が見つかりません',
                noCheckpoints: 'チェックポイントがありません',
                refresh: 'リストを更新',
                checkpointCount: '{count} 個のチェックポイント',
                selectAll: '全選択（絞り込み）',
                selectedCount: '選択中：{count}',
                deleteSelected: '選択したものを削除',
                clearSelection: 'クリア',
                confirmDelete: {
                    title: '削除の確認',
                    message: 'すべてのチェックポイントを削除してもよろしいですか？',
                    messageSingle: '「{title}」のチェックポイントをすべて削除してもよろしいですか？',
                    messageSelected: '選択した {count} 件の会話のチェックポイントをすべて削除してもよろしいですか？',
                    stats: '{count} 個のチェックポイントを削除し、{size} のストレージを解放します',
                    warning: 'この操作は元に戻せません',
                    cancel: 'キャンセル',
                    delete: '削除'
                },
                timeFormat: {
                    justNow: 'たった今',
                    minutesAgo: '{count} 分前',
                    hoursAgo: '{count} 時間前',
                    daysAgo: '{count} 日前'
                }
            }
        }
    },
    summarize: {
        title: 'コンテキスト要約',
        description: '会話履歴を圧縮してトークン使用量を削減',
        enableSummarize: '要約を有効化',
        tokenThreshold: 'トークンしきい値',
        summaryModel: '要約モデル',
        summaryPrompt: '要約プロンプト'
    },
    imageGen: {
        title: '画像生成',
        description: 'AI 画像生成ツールを設定',
        enableImageGen: '画像生成を有効化',
        provider: 'プロバイダー',
        model: 'モデル',
        outputPath: '出力パス',
        maxImages: '最大画像数'
    },
    dependencies: {
        title: '拡張機能の依存関係',
        description: 'オプション機能に必要な依存関係を管理',
        installed: 'インストール済み',
        notInstalled: '未インストール',
        installing: 'インストール中',
        installFailed: 'インストール失敗',
        install: 'インストール',
        uninstall: 'アンインストール',
        required: '必須',
        optional: 'オプション'
    },
    context: {
        title: 'コンテキスト認識',
        description: 'AI に送信されるワークスペースコンテキスト情報を設定',
        includeFileTree: 'ファイルツリーを含める',
        includeOpenFiles: '開いているファイルを含める',
        includeSelection: '選択内容を含める',
        maxDepth: '最大深度',
        excludePatterns: '除外パターン',
        pinnedFiles: 'ピン留めファイル',
        addPinnedFile: 'ピン留めファイルを追加'
    },
    prompt: {
        title: 'システムプロンプト',
        description: 'システムプロンプトの構造と内容をカスタマイズ',
        systemPrompt: 'システムプロンプト',
        customPrompt: 'カスタムプロンプト',
        templateVariables: 'テンプレート変数',
        preview: 'プレビュー',
        sections: {
            environment: '環境情報',
            tools: 'ツール',
            context: 'コンテキスト',
            instructions: '指示'
        }
    },
    general: {
        title: '一般設定',
        description: '基本的な設定オプション',
        proxy: {
            title: 'ネットワークプロキシ',
            description: 'API リクエスト用の HTTP プロキシを設定',
            enable: 'プロキシを有効化',
            url: 'プロキシ URL',
            urlPlaceholder: 'http://127.0.0.1:7890',
            urlError: '有効なプロキシアドレス（http:// または https://）を入力してください'
        },
        language: {
            title: 'インターフェース言語',
            description: '表示言語を選択',
            auto: 'システムに従う',
            autoDescription: 'VS Code の言語設定に自動的に従う'
        },
        appInfo: {
            title: 'アプリケーション情報',
            name: 'Acopilot - Vibe Coding アシスタント',
            version: 'バージョン',
            repository: 'リポジトリ',
            developer: '開発者'
        }
    },
};
