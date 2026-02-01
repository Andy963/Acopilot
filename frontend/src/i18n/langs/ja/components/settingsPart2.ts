export const jaComponentsSettingsPart2 = {
    contextSettings: {
        loading: '読み込み中...',
        workspaceFiles: {
            title: 'ワークスペースファイルツリー',
            description: 'ワークスペースのディレクトリ構造を AI に送信',
            sendFileTree: 'ワークスペースファイルツリーを送信',
            maxDepth: '最大深度',
            unlimitedHint: '-1 は無制限を意味します'
        },
        openTabs: {
            title: '開いているタブ',
            description: '現在開いているファイルリストを AI に送信',
            sendOpenTabs: '開いているタブを送信',
            maxCount: '最大数'
        },
        activeEditor: {
            title: '現在のアクティブエディター',
            description: '現在編集中のファイルパスを AI に送信',
            sendActiveEditor: '現在のアクティブエディターのパスを送信'
        },
        diagnostics: {
            title: '診断情報',
            description: 'ワークスペースのエラー、警告などの診断情報を AI に送信して、コードの問題を修正します',
            enableDiagnostics: '診断情報を有効化',
            severityTypes: '問題の種類',
            severity: {
                error: 'エラー',
                warning: '警告',
                information: '情報',
                hint: 'ヒント'
            },
            workspaceOnly: 'ワークスペース内のファイルのみ',
            openFilesOnly: '開いているファイルのみ',
            maxPerFile: 'ファイルあたりの最大数',
            maxFiles: '最大ファイル数'
        },
        ignorePatterns: {
            title: '無視パターン',
            description: '一致するファイル/フォルダーはコンテキストに表示されません（ワイルドカードをサポート）',
            removeTooltip: '削除',
            emptyHint: 'カスタム無視パターンがありません',
            inputPlaceholder: 'パターンを入力、例: **/node_modules, *.log',
            addButton: '追加',
            helpTitle: 'ワイルドカードのヘルプ:',
            helpItems: {
                wildcard: '* - 任意の文字に一致（パス区切りを除く）',
                recursive: '** - 任意のディレクトリレベルに一致',
                examples: '例: **/node_modules, *.log, .git'
            }
        },
        preview: {
            title: '現在の状態プレビュー',
            autoRefreshBadge: 'リアルタイム更新',
            description: 'AI に送信されるコンテキスト情報のプレビュー（2 秒ごとに自動更新）',
            activeEditorLabel: '現在のアクティブエディター：',
            openTabsLabel: '開いているタブ（{count} 個）：',
            noValue: 'なし',
            moreItems: '... さらに {count} 個'
        },
        saveSuccess: '保存しました',
        saveFailed: '保存に失敗しました'
    },
    dependencySettings: {
        title: '拡張機能の依存関係管理',
        description: 'オプションの拡張機能に必要な依存関係を管理します。これらの依存関係はローカルファイルシステムにインストールされ、プラグインにはパッケージ化されません。',
        installPath: 'インストールパス：',
        installed: 'インストール済み',
        installing: 'インストール中...',
        uninstalling: 'アンインストール中...',
        install: 'インストール',
        uninstall: 'アンインストール',
        estimatedSize: '約 {size}MB',
        empty: '依存関係を必要とするツールがありません',
        progress: {
            processing: '{dependency} を処理中...',
            complete: '{dependency} の処理が完了しました',
            failed: '{dependency} の処理に失敗しました',
            installSuccess: '{name} のインストールが成功しました！',
            installFailed: '{name} のインストールに失敗しました',
            uninstallSuccess: '{name} がアンインストールされました',
            uninstallFailed: '{name} のアンインストールに失敗しました',
            unknownError: '不明なエラー'
        },
        panel: {
            installedCount: '{installed}/{total}'
        }
    },
    generateImageSettings: {
        description: '画像生成ツールにより、AI は画像生成モデルを呼び出して画像を作成できます。生成された画像はワークスペースに保存され、マルチモーダル形式で AI に返されて表示されます。',
        api: {
            title: 'API 設定',
            provider: 'Provider',
            providerHint: '画像生成 API のプロバイダーを選択します。デフォルト URL と推奨モデルを自動入力します。',
            providerOptions: {
                gemini: 'Gemini',
                together: 'Together AI'
            },
            url: 'API URL',
            urlPlaceholder: 'https://generativelanguage.googleapis.com/v1beta',
            urlHint: '画像生成 API のベース URL',
            apiKey: 'API Key',
            apiKeyPlaceholder: 'API Key を入力',
            apiKeyHint: '画像生成 API のシークレットキー',
            model: 'モデル名',
            modelPlaceholder: 'gemini-3-pro-Image-preview',
            modelHint: '例: gemini-3-pro-Image-preview',
            modelPreset: '推奨モデル',
            modelPresetPlaceholder: 'カスタム（手入力）',
            modelPresetHint: 'プリセットを選ぶとモデル名が自動入力されます。上の欄で手入力もできます。',
            show: '表示',
            hide: '非表示'
        },
        aspectRatio: {
            title: 'アスペクト比パラメータ',
            enable: 'アスペクト比パラメータを有効化',
            fixedRatio: '固定アスペクト比',
            placeholder: '固定しない（AI が選択可能）',
            options: {
                auto: '自動',
                square: '正方形',
                landscape: '横長',
                portrait: '縦長',
                mobilePortrait: 'モバイル縦画面',
                widescreen: 'ワイドスクリーン',
                ultrawide: 'ウルトラワイド'
            },
            hints: {
                disabled: '無効時：AI はこのパラメータを設定できず、API 呼び出しにこのパラメータは含まれません',
                fixed: '固定：AI は {ratio} に固定されることが通知され、変更できません',
                flexible: '固定しない：AI は aspect_ratio パラメータを使用して選択できます'
            }
        },
        imageSize: {
            title: '画像サイズパラメータ',
            enable: '画像サイズパラメータを有効化',
            fixedSize: '固定画像サイズ',
            placeholder: '固定しない（AI が選択可能）',
            options: {
                auto: '自動'
            },
            hints: {
                disabled: '無効時：AI はこのパラメータを設定できず、API 呼び出しにこのパラメータは含まれません',
                fixed: '固定：AI は {size} に固定されることが通知され、変更できません',
                flexible: '固定しない：AI は image_size パラメータを使用して選択できます'
            }
        },
        batch: {
            title: 'バッチ生成制限',
            maxTasks: '最大バッチタスク数',
            maxTasksHint: 'AI の 1 回の呼び出しで許可される最大タスク数（異なるプロンプトの画像）。範囲 1-20。',
            maxImagesPerTask: 'タスクあたりの最大画像数',
            maxImagesPerTaskHint: '各タスク（単一のプロンプト）で保存される最大画像数。範囲 1-10。',
            summary: '現在の設定：AI は 1 回の呼び出しで最大 {maxTasks} タスクを開始でき、各タスクで最大 {maxImages} 枚の画像を保存できます'
        },
        usage: {
            title: '使用方法',
            step1: '上記の API URL、API Key、モデル名を設定',
            step2: 'ツールが「ツール設定」で有効になっていることを確認',
            step3: '会話で AI に generate_image ツールを呼び出して画像を生成させる',
            step4: '生成された画像はワークスペースの generated_images ディレクトリに保存されます',
            warning: '画像生成機能を使用する前に API Key を設定してください'
        }
    },
    mcpSettings: {
        toolbar: {
            addServer: 'サーバーを追加',
            editJson: 'JSON を編集',
            refresh: '更新'
        },
        loading: '読み込み中...',
        empty: {
            title: 'MCP サーバーがありません',
            description: '「サーバーを追加」ボタンをクリックして、最初の MCP サーバーを設定してください'
        },
        serverCard: {
            connect: '接続',
            disconnect: '切断',
            connecting: '接続中...',
            edit: '編集',
            delete: '削除',
            tools: 'ツール',
            resources: 'リソース',
            prompts: 'プロンプト'
        },
        status: {
            connected: '接続済み',
            connecting: '接続中...',
            error: '接続エラー',
            disconnected: '未接続'
        },
        form: {
            addTitle: 'MCP サーバーを追加',
            editTitle: 'MCP サーバーを編集',
            serverId: 'サーバー ID',
            serverIdPlaceholder: 'オプション、空白の場合は自動生成',
            serverIdHint: '英数字、アンダースコア、ハイフンのみ使用可能、JSON 設定でサーバーを識別するために使用',
            serverIdError: 'ID には英数字、アンダースコア、ハイフンのみ使用できます',
            serverName: 'サーバー名',
            serverNamePlaceholder: '例: マイ MCP サーバー',
            description: '説明',
            descriptionPlaceholder: 'オプションの説明',
            required: '*',
            transportType: 'トランスポートタイプ',
            command: 'コマンド',
            commandPlaceholder: '例: npx, python, node',
            args: '引数',
            argsPlaceholder: 'スペース区切り、例: -m mcp_server',
            env: '環境変数 (JSON)',
            envPlaceholder: '{"KEY": "value"}',
            url: 'URL',
            urlPlaceholderSse: 'https://example.com/sse',
            urlPlaceholderHttp: 'https://example.com/mcp',
            headers: 'ヘッダー (JSON)',
            headersPlaceholder: '{"Authorization": "Bearer token"}',
            options: 'オプション',
            enabled: '有効',
            autoConnect: '自動接続',
            cleanSchema: 'スキーマをクリーンアップ',
            cleanSchemaHint: 'JSON Schema から互換性のないフィールド（$schema、additionalProperties など）を削除します。一部の API（Gemini など）ではこのオプションを有効にする必要があります',
            timeout: '接続タイムアウト (ms)',
            cancel: 'キャンセル',
            create: '作成',
            save: '保存'
        },
        validation: {
            nameRequired: 'サーバー名を入力してください',
            idInvalid: 'ID が無効です',
            idChecking: 'ID を検証中、お待ちください',
            commandRequired: 'コマンドを入力してください',
            urlRequired: 'URL を入力してください',
            createFailed: '作成に失敗しました',
            updateFailed: '更新に失敗しました'
        },
        delete: {
            title: 'MCP サーバーを削除',
            message: 'サーバー "{name}" を削除してもよろしいですか？この操作は元に戻せません。',
            confirm: '削除',
            cancel: 'キャンセル'
        }
    },
    modelManager: {
        title: 'モデルリスト',
        fetchModels: 'モデルを取得',
        clearAll: 'すべてクリア',
        clearAllTooltip: 'すべてのモデルをクリア',
        empty: 'モデルがありません。「モデルを取得」をクリックするか、手動で追加してください',
        addPlaceholder: 'モデル ID を手動入力',
        addTooltip: '追加',
        removeTooltip: '削除',
        enabledTooltip: '現在有効なモデル',
        filterPlaceholder: 'モデルをフィルター...',
        clearFilter: 'フィルターをクリア',
        noResults: '一致するモデルがありません',
        clearDialog: {
            title: 'すべてのモデルをクリア',
            message: 'すべての {count} モデルをクリアしてもよろしいですか？この操作は元に戻せません。',
            confirm: 'クリア',
            cancel: 'キャンセル'
        },
        errors: {
            addFailed: 'モデルの追加に失敗しました',
            removeFailed: 'モデルの削除に失敗しました',
            setActiveFailed: 'アクティブモデルの設定に失敗しました'
        }
    },
    modelSelectionDialog: {
        title: '追加するモデルを選択',
        selectAll: 'すべて選択',
        deselectAll: 'すべて解除',
        close: '閉じる',
        loading: '読み込み中...',
        error: 'モデルリストの読み込みに失敗しました',
        retry: '再試行',
        empty: '利用可能なモデルがありません',
        added: '追加済み',
        selectionCount: '{count} モデルを選択',
        cancel: 'キャンセル',
        add: '追加 ({count})',
        filterPlaceholder: 'モデルを絞り込み...',
        clearFilter: 'フィルタをクリア',
        noResults: '一致するモデルがありません'
    },
    promptSettings: {
        loading: '読み込み中...',
        enable: 'カスタムシステムプロンプトテンプレートを有効化',
        enableDescription: '有効にすると、モジュールプレースホルダーを使用してシステムプロンプトの構造と内容をカスタマイズできます',
        templateSection: {
            title: 'システムプロンプトテンプレート',
            resetButton: 'デフォルトにリセット',
            description: 'システムプロンプトを直接記述し、{{$VARIABLE}} 形式で変数を参照します。送信時に実際の内容に置き換えられます',
            placeholder: 'システムプロンプトを入力、{{$ENVIRONMENT}} などの変数を使用できます...'
        },
        saveButton: '設定を保存',
        saveSuccess: '保存しました',
        saveFailed: '保存に失敗しました',
        tokenCount: {
            label: 'トークン数',
            channelTooltip: 'トークン計算に使用するチャンネルを選択',
            refreshTooltip: 'トークン数を更新',
            failed: 'カウント失敗',
            hint: 'テンプレートのみのトークン数を表示、実際のシステムプロンプトには動的に入力される変数コンテンツが含まれます'
        },
        modulesReference: {
            title: '利用可能な変数リファレンス',
            insertTooltip: 'テンプレートの末尾に挿入'
        },
        modules: {
            ENVIRONMENT: {
                name: '環境情報',
                description: 'ワークスペースパス、オペレーティングシステム、現在時刻、タイムゾーン情報を含みます'
            },
            WORKSPACE_FILES: {
                name: 'ワークスペースファイルツリー',
                description: 'ワークスペース内のファイルとディレクトリ構造をリストします。コンテキスト認識設定の深度と無視パターンの影響を受けます',
                requiresConfig: 'コンテキスト認識 > ワークスペースファイルツリーを送信'
            },
            OPEN_TABS: {
                name: '開いているタブ',
                description: 'エディターで現在開いているファイルタブをリストします',
                requiresConfig: 'コンテキスト認識 > 開いているタブを送信'
            },
            ACTIVE_EDITOR: {
                name: 'アクティブエディター',
                description: '現在編集中のファイルのパスを表示します',
                requiresConfig: 'コンテキスト認識 > アクティブエディターを送信'
            },
            DIAGNOSTICS: {
                name: '診断情報',
                description: 'ワークスペースのエラー、警告などの診断情報を表示し、AI がコードの問題を修正するのを助けます',
                requiresConfig: 'コンテキスト認識 > 診断情報を有効化'
            },
            PINNED_FILES: {
                name: 'ピン留めファイルの内容',
                description: 'ユーザーがピン留めしたファイルの完全な内容を表示します',
                requiresConfig: '入力ボックス横のピン留めファイルボタンでファイルを追加する必要があります'
            },
            TOOLS: {
                name: 'ツール定義',
                description: 'チャンネル設定に基づいて XML または Function Call 形式でツール定義を生成します（この変数はシステムによって自動的に入力されます）'
            },
            MCP_TOOLS: {
                name: 'MCP ツール',
                description: 'MCP サーバーからの追加ツール定義（この変数はシステムによって自動的に入力されます）',
                requiresConfig: 'MCP 設定でサーバーを設定して接続する必要があります'
            }
        },
        exampleOutput: '出力例：',
        requiresConfigLabel: '必要な設定：',
        skills: {
            title: 'Skills',
            add: 'Skill を追加',
            description: '再利用可能なプロンプト（Skill）を管理します。入力ボックス横のピン留めパネルから選択して使用できます。',
            empty: 'Skill がありません',
            saveSuccess: '保存しました',
            saveFailed: '保存に失敗しました',
            installFromUrl: {
                button: 'URL からインストール',
                modal: {
                    title: 'URL から Skill をインストール',
                    url: 'GitHub URL',
                    urlPlaceholder: 'https://github.com/owner/repo または https://github.com/owner/repo/tree/<ref>/.codex/skills/<skill>（または .codex/<skill>）',
                    hint: 'このプロジェクトの .codex/skills/ にインストールし、Skills リストに自動的にインポートします'
                },
                validation: {
                    urlRequired: 'GitHub URL を入力してください',
                    noSkillsFound: 'インストール可能な Codex skill が見つかりません（.codex/skills または .codex/<skill> が必要です）',
                    noValidSkillsFound: '有効な Codex skill が見つかりません（SKILL.md が見つからないため、このリポジトリは Skill ではない可能性があります）'
                },
                notifications: {
                    installSuccess: '{count} 件の Skill をインストールしました',
                    noNewSkills: '既に存在するため新規追加はありません（{count} 件）',
                    partialInvalid: '{count} 件の Skill が無効（SKILL.md がありません）なためスキップしました'
                },
                installFailed: 'インストールに失敗しました'
            },
            modal: {
                addTitle: 'Skill を追加',
                editTitle: 'Skill を編集',
                id: 'ID',
                idPlaceholder: '例：issue_killer',
                name: '名前',
                namePlaceholder: '例：Issue Killer',
                description: '説明',
                descriptionPlaceholder: '任意、短い説明',
                prompt: 'プロンプト',
                promptPlaceholder: 'この Skill のプロンプト内容を入力...'
            },
            validation: {
                idRequired: 'ID を入力してください',
                promptRequired: 'プロンプトを入力してください',
                idDuplicate: 'ID は既に存在します'
            },
            delete: {
                title: 'Skill を削除',
                message: 'この Skill を削除しますか？この操作は元に戻せません。'
            }
        }
    },
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
            warningHint: 'チャンネルとモデルを選択してください。そうしないと、会話モデルが要約に使用されます'
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
            }
        },
        lsp: {
            locate: {
                title: 'Locate',
                hint: '（任意）Locate クエリを自動判定して起動します（/locate も利用可能）',
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
            message: '危険なツール（delete_file / execute_command）が検出されました。これらも自動実行にしますか？',
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
        dependency: {
            required: '依存関係が必要',
            requiredTooltip: 'このツールを使用するには依存関係のインストールが必要です',
            disabledTooltip: 'ツールが無効か、依存関係が不足しています'
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
