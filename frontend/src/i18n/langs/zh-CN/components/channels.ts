export const zhCNComponentsChannels = {
    common: {
        temperature: {
            label: '温度 (Temperature)',
            hint: '0.0 - 1.0, 默认 1.0',
            toggleHint: '启用后此参数将发送到 API'
        },
        maxTokens: {
            label: '最大输出Tokens',
            placeholder: '4096',
            toggleHint: '启用后此参数将发送到 API'
        },
        topP: {
            label: 'Top-P',
            hint: '0.0 - 1.0',
            toggleHint: '启用后此参数将发送到 API'
        },
        topK: {
            label: 'Top-K',
            toggleHint: '启用后此参数将发送到 API'
        },
        thinking: {
            title: '思考配置',
            toggleHint: '启用后思考参数将发送到 API'
        },
        currentThinking: {
            title: '当前轮次回传配置',
            sendSignatures: '发送最新思考签名',
            sendSignaturesHint: '保持当前步骤的思考衔接',
            sendContent: '发送最新思考内容',
            sendContentHint: '回传当前轮次的推理过程',
        },
        historyThinking: {
            title: '历史回合回传配置',
            sendSignatures: '发送历史思考签名',
            sendSignaturesHint: '保持跨多轮交互的思考上下文',
            sendContent: '发送历史思考内容',
            sendContentHint: '让 AI 看到之前已完成回合的思考过程',
            roundsLabel: '发送历史思考回合数',
            roundsHint: '控制发送多少轮非最新回合的历史对话思考。-1 表示全部，0 表示不发送历史对话，正数 N 表示发送最近 N 轮（如 1 表示只发送倒数第二回合）'
        }
    },
    anthropic: {
        thinking: {
            budgetLabel: '思考预算 (Budget Tokens)',
            budgetPlaceholder: '10000',
            budgetHint: '思考过程使用的最大 Token 数量，建议 5000-50000'
        }
    },
    gemini: {
        thinking: {
            includeThoughts: '返回思考内容',
            includeThoughtsHint: '启用后，API 响应将包含模型的思考过程',
            mode: '思考强度模式',
            modeHint: '默认: 使用 API 默认值 | 等级: 选择预设等级 | 预算: 自定义 token 数',
            modeDefault: '默认',
            modeLevel: '等级',
            modeBudget: '预算',
            levelLabel: '思考等级',
            levelHint: 'minimal: 最少思考 | low: 较少思考 | medium: 中等 | high: 深度思考',
            levelMinimal: '最少',
            levelLow: '低',
            levelMedium: '中',
            levelHigh: '高',
            budgetLabel: '思考预算 (Token)',
            budgetPlaceholder: '1024',
            budgetHint: '自定义思考过程允许使用的 token 数量'
        },
        historyThinking: {
            sendContentHint: '启用后，将发送历史对话中的思考内容（包括摘要），这可能会显著增加上下文长度'
        }
    },
    openai: {
        frequencyPenalty: {
            label: '频率惩罚 (Frequency Penalty)',
            hint: '-2.0 - 2.0',
            toggleHint: '启用后此参数将发送到 API'
        },
        presencePenalty: {
            label: '存在惩罚 (Presence Penalty)',
            hint: '-2.0 - 2.0',
            toggleHint: '启用后此参数将发送到 API'
        },
        thinking: {
            effortLabel: '思考强度 (Effort)',
            effortHint: 'none: 不使用 | minimal: 极少 | low: 较少 | medium: 中等 | high: 较多 | xhigh: 最高',
            effortNone: '无',
            effortMinimal: '极少',
            effortLow: '低',
            effortMedium: '中',
            effortHigh: '高',
            effortXHigh: '最高',
            summaryLabel: '输出详细程度 (Summary)',
            summaryHint: 'auto: 自动选择 | concise: 简洁输出 | detailed: 详细输出',
            summaryAuto: '自动',
            summaryConcise: '简洁',
            summaryDetailed: '详细'
        },
        historyThinking: {
            sendSignaturesHint: '启用后，将发送历史对话中的思考签名（OpenAI 暂不支持）。不建议开启，且发送的是非最新一轮对话的签名',
            sendContentHint: '启用后，将发送历史对话中的 reasoning_content（包括摘要），这可能会显著增加上下文长度'
        }
    },
    'openai-responses': {
        maxOutputTokens: {
            label: '最大输出 Tokens',
            placeholder: '8192',
            hint: '对应 API 的 max_output_tokens 参数'
        },
        thinking: {
            effortLabel: '思考强度 (Effort)',
            effortHint: 'none: 不使用 | minimal: 极少 | low: 较少 | medium: 中等 | high: 较多 | xhigh: 最高',
            effortNone: '无 (none)',
            effortMinimal: '极少 (minimal)',
            effortLow: '低 (low)',
            effortMedium: '中 (medium)',
            effortHigh: '高 (high)',
            effortXHigh: '最高 (xhigh)',
            summaryLabel: '输出详细程度 (Summary)',
            summaryHint: 'auto: 自动选择 | concise: 简洁输出 | detailed: 详细输出',
            summaryAuto: '自动',
            summaryConcise: '简洁',
            summaryDetailed: '详细'
        },
        historyThinking: {
            sendSignaturesHint: '保持跨多轮交互的思考上下文',
            sendContentHint: '启用后，将发送历史对话中的 reasoning_content，这将增加上下文长度'
        }
    },
    customBody: {
        hint: '添加自定义请求体字段，支持嵌套 JSON 覆盖',
        modeSimple: '简单模式',
        modeAdvanced: '复杂模式',
        keyPlaceholder: '键名 (如: extra_body)',
        valuePlaceholder: '值 (支持 JSON，如: {"key": "value"})',
        empty: '暂无自定义 Body 项',
        addItem: '添加项',
        clearItems: '清空项',
        insertExample: '插入示例',
        resetDefault: '恢复默认',
        jsonError: 'JSON 格式错误',
        jsonHint: '完整 JSON 格式，支持嵌套覆盖',
        jsonPlaceholder: '{\n  "extra_body": {\n    "google": {\n      "thinking_config": {\n        "include_thoughts": false\n      }\n    }\n  }\n}',
        enabled: '已启用',
        disabled: '已禁用',
        deleteTooltip: '删除',
        validation: {
            invalidJson: 'JSON 格式错误',
            rootMustBeObject: 'JSON 根节点必须是对象',
            emptyKey: '已启用字段的键名不能为空',
            emptyPathSegment: '点路径不能包含空片段',
            duplicateKey: '键名重复',
            location: '（第 {line} 行，第 {column} 列）'
        }
    },
    customHeaders: {
        hint: '添加自定义 HTTP 请求标头，按照顺序发送到 API',
        keyPlaceholder: 'Header-Name',
        valuePlaceholder: 'Header Value',
        keyDuplicate: '键名重复',
        empty: '暂无自定义标头',
        addHeader: '添加标头',
        clearHeaders: '清空标头',
        enabled: '已启用',
        disabled: '已禁用',
        deleteTooltip: '删除',
        validation: {
            emptyKey: '已启用 Header 名不能为空',
            invalidHeaderName: 'HTTP Header 名不合法',
            duplicateKey: 'Header 名重复'
        }
    },
    toolOptions: {
        cropImage: {
            title: '裁切图片 (crop_image)',
            useNormalizedCoords: '使用归一化坐标 (0-1000)',
            enabledTitle: '启用时',
            enabledNote: '适用于 Gemini 等使用归一化坐标的模型',
            disabledTitle: '禁用时',
            disabledNote: '模型需自行计算图片的实际像素坐标',
            coordTopLeft: '= 左上角',
            coordBottomRight: '= 右下角',
            coordCenter: '= 中心点'
        }
    },
    tokenCountMethod: {
        title: 'Token 计数方式',
        label: '计数方式',
        placeholder: '选择计数方式',
        hint: '选择用于计算 token 数量的方式，影响上下文裁剪的精确度',
        options: {
            channelDefault: '使用渠道默认',
            gemini: 'Gemini API',
            openaiCustom: '自定义 OpenAI 格式',
            openaiCustomDesc: '使用自定义 API 端点',
            openaiResponses: 'OpenAI Responses API',
            anthropic: 'Anthropic API',
            local: '本地估算',
            localDesc: '约 4 字符 = 1 token'
        },
        defaultDesc: {
            gemini: '默认使用 Gemini countTokens API',
            anthropic: '默认使用 Anthropic count_tokens API',
            openai: '默认使用本地估算（OpenAI 无官方接口）'
        },
        apiConfig: {
            title: 'API 配置',
            url: 'API URL',
            urlHint: '留空则使用渠道的 URL',
            apiKey: 'API Key',
            apiKeyPlaceholder: '输入 API Key',
            apiKeyHint: '留空则使用渠道的 API Key',
            model: '模型',
            modelHint: '用于 token 计数的模型名称'
        }
    }
};
