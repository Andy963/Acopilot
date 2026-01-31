export const jaComponentsChannels = {
    common: {
        temperature: {
            label: '温度 (Temperature)',
            hint: '0.0 - 1.0、デフォルト 1.0',
            toggleHint: '有効にすると、このパラメータが API に送信されます'
        },
        maxTokens: {
            label: '最大出力トークン',
            placeholder: '4096',
            toggleHint: '有効にすると、このパラメータが API に送信されます'
        },
        topP: {
            label: 'Top-P',
            hint: '0.0 - 1.0',
            toggleHint: '有効にすると、このパラメータが API に送信されます'
        },
        topK: {
            label: 'Top-K',
            toggleHint: '有効にすると、このパラメータが API に送信されます'
        },
        thinking: {
            title: '思考設定',
            toggleHint: '有効にすると、思考パラメータが API に送信されます'
        },
        currentThinking: {
            title: '最新ターンの思考設定',
            sendSignatures: '最新の思考署名を送信',
            sendSignaturesHint: '現在のステップの思考継続性を維持',
            sendContent: '最新の思考内容を送信',
            sendContentHint: '最新ターンの推論プロセスを送信',
        },
        historyThinking: {
            title: '履歴ターンの思考設定',
            sendSignatures: '履歴思考署名を送信',
            sendSignaturesHint: '以前のターンの思考署名を送信',
            sendContent: '履歴思考内容を送信',
            sendContentHint: '完了した履歴ターンの思考プロセスを AI に送信',
            roundsLabel: '履歴思考ラウンド数',
            roundsHint: '最新以外のラウンドをいくつ送信するか。-1 ですべて、0 で送信なし、正の N で最近の N ラウンド（例：1 は最後から 2 番目のラウンドのみ）'
        }
    },
    anthropic: {
        thinking: {
            budgetLabel: '思考バジェット (Budget Tokens)',
            budgetPlaceholder: '10000',
            budgetHint: '思考プロセスに使用する最大トークン数、5000-50000 を推奨'
        }
    },
    gemini: {
        thinking: {
            includeThoughts: '思考内容を返す',
            includeThoughtsHint: '有効にすると、API レスポンスにモデルの思考プロセスが含まれます',
            mode: '思考強度モード',
            modeHint: 'デフォルト: API デフォルトを使用 | レベル: プリセットレベルを選択 | バジェット: カスタムトークン数',
            modeDefault: 'デフォルト',
            modeLevel: 'レベル',
            modeBudget: 'バジェット',
            levelLabel: '思考レベル',
            levelHint: 'minimal: 最小限の思考 | low: 少ない思考 | medium: 中程度 | high: 深い思考',
            levelMinimal: '最小',
            levelLow: '低',
            levelMedium: '中',
            levelHigh: '高',
            budgetLabel: '思考バジェット (Token)',
            budgetPlaceholder: '1024',
            budgetHint: '思考プロセスに許可されるカスタムトークン数'
        },
        historyThinking: {
            sendContentHint: '有効にすると、履歴会話の思考内容（要約を含む）が送信されます。これによりコンテキスト長が大幅に増加する可能性があります'
        }
    },
    openai: {
        frequencyPenalty: {
            label: '頻度ペナルティ (Frequency Penalty)',
            hint: '-2.0 - 2.0',
            toggleHint: '有効にすると、このパラメータが API に送信されます'
        },
        presencePenalty: {
            label: '存在ペナルティ (Presence Penalty)',
            hint: '-2.0 - 2.0',
            toggleHint: '有効にすると、このパラメータが API に送信されます'
        },
        thinking: {
            effortLabel: '思考強度 (Effort)',
            effortHint: 'none: 使用しない | minimal: 極小 | low: 少ない | medium: 中程度 | high: 多い | xhigh: 最大',
            effortNone: 'なし',
            effortMinimal: '極小',
            effortLow: '低',
            effortMedium: '中',
            effortHigh: '高',
            effortXHigh: '最高',
            summaryLabel: '出力詳細度 (Summary)',
            summaryHint: 'auto: 自動選択 | concise: 簡潔な出力 | detailed: 詳細な出力',
            summaryAuto: '自動',
            summaryConcise: '簡潔',
            summaryDetailed: '詳細'
        },
        historyThinking: {
            sendSignaturesHint: '有効にすると、履歴会話の思考署名が送信されます（OpenAI 未対応）。非推奨であり、最新以外のターンの署名が送信されます。',
            sendContentHint: '有効にすると、履歴会話の reasoning_content（要約を含む）が送信されます。これによりコンテキスト長が大幅に増加する可能性があります。'
        }
    },
    'openai-responses': {
        maxOutputTokens: {
            label: '最大出力トークン',
            placeholder: '8192',
            hint: 'API の max_output_tokens パラメータに対応'
        },
        thinking: {
            effortLabel: '思考強度 (Effort)',
            effortHint: 'none: 使用しない | minimal: 極小 | low: 少ない | medium: 中程度 | high: 多い | xhigh: 最大',
            effortNone: 'なし (none)',
            effortMinimal: '極小 (minimal)',
            effortLow: '低 (low)',
            effortMedium: '中 (medium)',
            effortHigh: '高 (high)',
            effortXHigh: '最大 (xhigh)',
            summaryLabel: '出力詳細度 (Summary)',
            summaryHint: 'auto: 自動選択 | concise: 簡潔な出力 | detailed: 詳細な出力',
            summaryAuto: '自動',
            summaryConcise: '簡潔',
            summaryDetailed: '詳細'
        },
        historyThinking: {
            sendSignaturesHint: '以前のターンの思考署名を送信',
            sendContentHint: '有効にすると、履歴会話の reasoning_content が送信されます。これによりコンテキスト長が増加します'
        }
    },
    customBody: {
        hint: 'カスタムリクエストボディフィールドを追加、ネストされた JSON オーバーライドをサポート',
        modeSimple: 'シンプルモード',
        modeAdvanced: '高度モード',
        keyPlaceholder: 'キー名（例: extra_body）',
        valuePlaceholder: '値（JSON をサポート、例: {"key": "value"}）',
        empty: 'カスタム Body アイテムがありません',
        addItem: 'アイテムを追加',
        jsonError: 'JSON 形式エラー',
        jsonHint: '完全な JSON 形式、ネストされたオーバーライドをサポート',
        jsonPlaceholder: '{\n  "extra_body": {\n    "google": {\n      "thinking_config": {\n        "include_thoughts": false\n      }\n    }\n  }\n}',
        enabled: '有効',
        disabled: '無効',
        deleteTooltip: '削除'
    },
    customHeaders: {
        hint: 'カスタム HTTP リクエストヘッダーを追加、順番に API に送信',
        keyPlaceholder: 'Header-Name',
        valuePlaceholder: 'Header Value',
        keyDuplicate: 'キー名が重複しています',
        empty: 'カスタムヘッダーがありません',
        addHeader: 'ヘッダーを追加',
        enabled: '有効',
        disabled: '無効',
        deleteTooltip: '削除'
    },
    toolOptions: {
        cropImage: {
            title: '画像のトリミング (crop_image)',
            useNormalizedCoords: '正規化座標を使用 (0-1000)',
            enabledTitle: '有効時',
            enabledNote: 'Gemini など正規化座標を使用するモデルに適しています',
            disabledTitle: '無効時',
            disabledNote: 'モデルは実際のピクセル座標を計算する必要があります',
            coordTopLeft: '= 左上隅',
            coordBottomRight: '= 右下隅',
            coordCenter: '= 中心点'
        }
    },
    tokenCountMethod: {
        title: 'トークンカウント方式',
        label: 'カウント方式',
        placeholder: 'カウント方式を選択',
        hint: 'トークン数を計算する方式を選択します。コンテキストトリミングの精度に影響します',
        options: {
            channelDefault: 'チャンネルのデフォルトを使用',
            gemini: 'Gemini API',
            openaiCustom: 'カスタム OpenAI フォーマット',
            openaiCustomDesc: 'カスタム API エンドポイントを使用',
            openaiResponses: 'OpenAI Responses API',
            anthropic: 'Anthropic API',
            local: 'ローカル推定',
            localDesc: '約4文字 = 1トークン'
        },
        defaultDesc: {
            gemini: 'デフォルトは Gemini countTokens API を使用',
            anthropic: 'デフォルトは Anthropic count_tokens API を使用',
            openai: 'デフォルトはローカル推定を使用（OpenAI には公式 API がありません）'
        },
        apiConfig: {
            title: 'API 設定',
            url: 'API URL',
            urlHint: '空の場合はチャンネルの URL を使用',
            apiKey: 'API キー',
            apiKeyPlaceholder: 'API キーを入力',
            apiKeyHint: '空の場合はチャンネルの API キーを使用',
            model: 'モデル',
            modelHint: 'トークンカウントに使用するモデル名'
        }
    }
};
