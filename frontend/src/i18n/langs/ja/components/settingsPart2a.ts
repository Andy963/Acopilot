export const jaComponentsSettingsPart2a = {
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
        title: 'ツールの依存関係',
        description: 'ツールに必要な依存関係を管理します。これらの依存関係はローカルファイルシステムにインストールされ、プラグインにはパッケージ化されません。',
        installPath: 'インストールパス：',
        pathRelation: '依存パッケージは General の有効なストレージパス配下の管理用 dependencies ディレクトリにインストールされます。ストレージパス移行が完了すると、この場所も新しいストレージパスに追従します。ストレージルートそのものではありません。',
        installed: 'インストール済み',
        installing: 'インストール中...',
        uninstalling: 'アンインストール中...',
        install: 'インストール',
        uninstall: 'アンインストール',
        copyFailureLog: '失敗ログをコピー',
        copyFailureLogSuccess: '失敗ログをコピーしました',
        copyFailureLogFailed: '失敗ログのコピーに失敗しました',
        estimatedSize: '約 {size}MB',
        empty: '依存関係を必要とするツールがありません',
        uninstallConfirm: {
            title: '依存関係をアンインストールしますか？',
            message: '{name} をアンインストールしますか？次のツールが利用できなくなる可能性があります: {tools}',
            confirm: 'アンインストール',
            cancel: 'キャンセル',
            none: '既知のツールはありません'
        },
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
            label: '推定トークン数',
            channelTooltip: 'トークン計算に使用するチャンネルを選択',
            refreshTooltip: 'トークン数を更新',
            failed: 'カウント失敗',
            hint: '推定値です。変数展開前のテンプレートのトークン数のみを表示し、実際のシステムプロンプトには動的に入力される変数コンテンツが含まれます。'
        },
        validation: {
            emptyTemplate: 'テンプレートを空にすることはできません。',
            unknownVariables: '不明な変数：{variables}。リファレンス一覧の変数を使用してください。',
            duplicateVariables: '重複した変数：{variables}。最終プロンプトで同じコンテキストが重複します。',
            fixBeforeSave: '保存する前にテンプレートの検証エラーを修正してください。'
        },
        history: {
            title: 'Prompt バージョン履歴',
            hint: '保存/リセット前のローカル版を最新 10 件保持します。',
            empty: '以前の Prompt バージョンはまだありません。',
            restore: '復元',
            restored: '履歴から復元しました。適用するには保存してください。'
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
            title: 'Prompt Skills',
            add: 'Prompt Skill を追加',
            description: '再利用可能な Prompt Skill を管理します。ここではライブラリとして保存され、すべての会話へ自動注入されるわけではありません。',
            lifecycleNote: 'ピン留め Skill の選択は別の流れです。入力ボックス横のピン留めパネルで Prompt Skill を選択すると、特定の会話またはワークスペース既定に添付されます。',
            empty: 'Prompt Skill がありません',
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
};
