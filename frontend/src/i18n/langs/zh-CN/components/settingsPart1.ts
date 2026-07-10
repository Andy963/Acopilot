export const zhCNComponentsSettingsPart1 = {
    title: '设置',
    tabs: {
        channel: '渠道',
        tools: '工具',
        autoExec: '自动执行',
        checkpoint: '存档点',
        imageGen: '图像生成',
        dependencies: '扩展依赖',
        context: '上下文',
        prompt: '提示词',
        tokenCount: 'Token 计数',
        general: '通用'
    },
    channelSettings: {
        selector: {
            label: '当前配置',
            placeholder: '选择配置',
            rename: '重命名',
            add: '新建配置',
            delete: '删除配置',
            inputPlaceholder: '输入配置名称',
            confirm: '确认',
            cancel: '取消'
        },
        dialog: {
            new: {
                title: '新建配置',
                nameLabel: '配置名称',
                namePlaceholder: '例如：我的 Gemini',
                typeLabel: '接口类型',
                typePlaceholder: '选择接口类型',
                cancel: '取消',
                create: '创建'
            },
            delete: {
                title: '删除配置',
                message: '确定要删除配置 "{name}" 吗？此操作不可恢复。',
                atLeastOne: '至少需要保留一个配置',
                cancel: '取消',
                confirm: '确定'
            }
        },
        form: {
            apiUrl: {
                label: 'API URL',
                placeholder: '输入 API URL',
                placeholderResponses: '输入 API 基础地址，如 https://api.openai.com/v1'
            },
            apiKey: {
                label: 'API Key',
                placeholder: '输入 API Key',
                show: '显示',
                hide: '隐藏',
                useAuthorization: '使用 Authorization 格式发送',
                useAuthorizationHintGemini: '将 x-goog-api-key 转为 Authorization: Bearer 格式发送',
                useAuthorizationHintAnthropic: '将 x-api-key 转为 Authorization: Bearer 格式发送'
            },
            connectionTest: {
                button: '测试连接',
                testing: '测试中...',
                hint: '用最小请求检查 API Key、URL 和当前模型是否可用'
            },
            stream: {
                label: '流式输出'
            },
            channelType: {
                label: '渠道类型',
                gemini: 'Gemini API',
                openai: 'OpenAI API',
                'openai-responses': 'OpenAI Responses API',
                anthropic: 'Anthropic API'
            },
            toolMode: {
                label: '工具调用格式',
                placeholder: '选择工具调用格式',
                functionCall: {
                    label: 'Function Calling',
                    description: '使用原生函数调用'
                },
                xml: {
                    label: 'XML 提示词',
                    description: '使用 XML 格式提示词'
                },
                json: {
                    label: 'JSON 边界标记',
                    description: '使用 JSON 格式 + 边界标记（推荐）'
                },
                boundaryHint: '这里控制当前 Channel 的请求协议能力；具体工具启用和自动执行请到 Tools 设置中管理。',
                openToolsSettings: '打开 Tools 设置',
                hint: {
                    functionCall: 'Function Calling: 使用 API 原生函数调用功能',
                    xml: 'XML 提示词: 将工具转换为 XML 格式插入系统提示词',
                    json: 'JSON 边界标记: 使用 JSON 格式 + <<<TOOL_CALL>>> 边界标记（推荐）'
                },
                openaiWarning: 'OpenAI Function Call 模式不支持多模态工具（如 read_file 读取图片、generate_image 生成图片、remove_background 抠图、crop_image 裁切图片、resize_image 缩放图片、rotate_image 旋转图片）。如需使用多模态功能，请切换到 XML 或 JSON 模式。'
            },
            multimodal: {
                label: '启用多模态工具',
                supportedTypes: '支持的文件类型：',
                image: '图片',
                imageFormats: 'PNG、JPEG、WebP',
                document: '文档',
                documentFormats: 'PDF',
                capabilities: '多模态工具能力：',
                table: {
                    channel: '渠道 / 模式',
                    readImage: '读取图片',
                    readDocument: '读取文档',
                    generateImage: '生成图片',
                    historyMultimodal: '历史多模态'
                },
                channels: {
                    geminiAll: 'Gemini（全部）',
                    anthropicAll: 'Anthropic（全部）',
                    openaiXmlJson: 'OpenAI（XML/JSON）',
                    openaiResponses: 'OpenAI（Responses）',
                    openaiFunction: 'OpenAI（Function Call）'
                },
                legend: {
                    supported: '支持',
                    notSupported: '不支持'
                },
                notes: {
                    requireEnable: '需要启用此选项才能使用 read_file 读取图片/文档、generate_image 生成图片、remove_background 抠图、crop_image 裁切图片、resize_image 缩放图片、rotate_image 旋转图片等多模态工具',
                    userAttachment: '用户主动发送的附件不受此配置影响，始终按渠道原生能力处理',
                    geminiAnthropic: 'Gemini / Anthropic：工具可直接返回图片和文档，支持生成图片功能',
                    openaiResponses: 'OpenAI Responses：原生支持图片、PDF 读取，支持推理过程实时显示',
                    openaiXmlJson: 'OpenAI XML/JSON：支持读取图片和生成图片，不支持文档'
                }
            },
            timeout: {
                label: '超时时间 (ms)',
                placeholder: '30000'
            },
            maxContextTokens: {
                label: '最大上下文 Tokens',
                placeholder: '128000',
                hint: '用于显示上下文使用量的上限值'
            },
            contextManagement: {
                title: '上下文管理',
                enableTitle: '启用上下文阈值检测',
                threshold: {
                    label: '上下文阈值',
                    placeholder: '80% 或 100000',
                    hint: '当总 token 数超过此阈值时，自动舍弃最旧的对话回合。支持两种格式：百分比（如 80%）或绝对数值（如 100000）'
                },
                extraCut: {
                    label: '额外裁剪量',
                    placeholder: '0 或 10%',
                    hint: '裁剪时额外裁剪的 token 数量。实际保留 = 阈值 - 额外裁剪量。支持百分比或绝对数值，默认为 0'
                },
                autoSummarize: {
                    label: '自动总结（即将推出）',
                    enableTitle: '启用自动总结',
                    hint: '启用后，在舍弃旧回合前先进行总结（功能开发中）'
                }
            },
            toolOptions: {
                title: '工具配置'
            },
            advancedOptions: {
                title: '高级选项'
            },
            customBody: {
                title: '自定义 Body',
                enableTitle: '启用自定义 Body'
            },
            customHeaders: {
                title: '自定义标头',
                enableTitle: '启用自定义标头'
            },
            autoRetry: {
                title: '自动重试',
                enableTitle: '启用自动重试',
                retryCount: {
                    label: '重试次数',
                    hint: 'API 返回错误时的最大重试次数（1-10）'
                },
                retryInterval: {
                    label: '基础间隔 (ms)',
                    hint: '重试的基础等待时间，每次失败后翻倍（指数退避）'
                }
            },
            enabled: {
                label: '启用此配置'
            },
            sections: {
                identityCredentials: '身份与凭据',
                capabilities: '功能能力',
                advancedConfig: '逻辑配置广场'
            },
            status: {
                defaultConfig: '默认配置',
                toolsConfigured: '已加载 {count} 个工具',
                localEstimate: '本地估算',
                fieldsConfigured: '已定义 {count} 个字段',
                headersConfigured: '{count} 个 Header',
                maxRetries: '最多 {count} 次',
                thresholdValue: '阈值'
            },
            capabilitySummary: {
                title: '模型能力摘要',
                model: '模型',
                contextWindow: '上下文',
                maxOutput: '输出',
                toolProtocol: '工具协议',
                multimodal: '多模态',
                reasoning: '推理',
                promptCache: 'Prompt Cache',
                stream: '流式',
                notSelected: '未选择',
                unknown: '未知',
                providerDefault: 'Provider 默认'
            },
            multimodalSummary: '文档图片 (PNG/JPG)，PDF。',
            viewCompatibility: '查看兼容性矩阵'
        }
    },
    tools: {
        title: '工具设置',
        description: '管理和配置可用工具',
        enableAll: '全部启用',
        disableAll: '全部禁用',
        toolName: '工具名称',
        toolDescription: '工具描述',
        toolEnabled: '启用状态'
    },
    autoExec: {
        title: '自动执行',
        intro: {
            title: '工具执行确认',
            description: '配置 AI 调用工具时是否需要用户确认。勾选表示自动执行（无需确认），不勾选表示执行前需要用户确认。'
        },
        actions: {
            refresh: '刷新',
            enableAll: '全部自动执行',
            disableAll: '全部需确认'
        },
        status: {
            loading: '加载工具列表...',
            empty: '暂无可用工具',
            autoExecute: '自动执行',
            needConfirm: '需确认'
        },
        categories: {
            file: '文件操作',
            search: '搜索',
            terminal: '终端',
            lsp: '代码智能',
            media: '媒体处理',
            other: '其他'
        },
        badges: {
            dangerous: '危险'
        },
        tips: {
            dangerousDefault: '• 标记为"危险"的工具默认需要用户确认后才能执行',
            deleteFileWarning: '• delete_file: 删除文件操作不可恢复，建议保持需确认',
            executeCommandWarning: '• execute_command: 执行终端命令可能对系统造成影响',
            useWithCheckpoint: '• 建议配合存档点功能使用，以便在误操作时恢复'
        }
    },
    checkpoint: {
        title: '存档点设置',
        loading: '加载配置...',
        sections: {
            enable: {
                label: '启用存档点功能',
                description: '在工具执行前后自动创建代码库快照，支持一键回退'
            },
            presets: {
                title: '场景预设',
                description: '不用手动理解 before/after 开关，直接套用常见保护策略',
                items: {
                    safe: {
                        title: '安全模式',
                        description: '对会修改工作区的工具执行前后都创建存档，并启用用户消息前存档。'
                    },
                    light: {
                        title: '轻量模式',
                        description: '仅保留修改类工具执行前存档，减少执行后快照数量。'
                    },
                    dangerous: {
                        title: '危险工具保护模式',
                        description: '保护 apply_diff、delete_file、execute_command、replace_in_files 的执行前后状态。'
                    },
                    off: {
                        title: '关闭模式',
                        description: '关闭存档点创建，同时保留当前详细配置，便于之后恢复。'
                    }
                }
            },
            messages: {
                title: '消息类型存档点',
                description: '选择是否为用户消息和模型消息创建存档点（独立于工具调用）',
                beforeLabel: '消息前',
                afterLabel: '消息后',
                types: {
                    user: {
                        name: '用户消息',
                        description: '用户发送的消息'
                    },
                    model: {
                        name: '模型消息',
                        description: '模型回复的消息（不包含工具调用）'
                    }
                },
                options: {
                    modelOuterLayerOnly: {
                        label: '连续调用工具时，只在最外层创建模型消息存档点',
                        hint: '启用后，模型消息的"消息前"存档点只在第一次迭代创建，"消息后"存档点只在最后一次（无工具调用）创建。禁用后每次迭代都会创建。'
                    },
                    mergeUnchanged: {
                        label: '合并显示消息前后无变更的存档点',
                        hint: '启用后，如果消息前后存档点的内容相同，将合并显示为一个"内容未变化"的存档点。禁用后将始终分别显示前后存档点。'
                    }
                }
            },
            tools: {
                title: '工具备份配置',
                description: '选择需要在执行前后创建备份的工具',
                beforeLabel: '执行前',
                afterLabel: '执行后',
                empty: '暂无可用的工具'
            },
            other: {
                title: '其他配置',
                maxCheckpoints: {
                    label: '最大存档点数量',
                    placeholder: '-1',
                    hint: '超过此数量时自动清理旧的存档点，填写 -1 表示无上限'
                },
                autoCleanup: {
                    label: '启动时自动清理过期对话',
                    hint: '启用后，将在扩展启动时删除超过 30 天未更新的对话，并清理其存档点、附件、diff、快照等数据，以释放空间'
                }
            },
            cleanup: {
                title: '清理存档点',
                description: '按对话清理存档点，释放存储空间',
                searchPlaceholder: '搜索对话标题...',
                loading: '加载中...',
                noMatch: '未找到匹配的对话',
                noCheckpoints: '暂无存档点',
                refresh: '刷新列表',
                checkpointCount: '{count} 个存档点',
                selectAll: '全选（当前筛选）',
                selectedCount: '已选择：{count}',
                deleteSelected: '删除选中',
                clearSelection: '清空',
                confirmDelete: {
                    title: '确认删除',
                    message: '确定要删除所有存档点吗？',
                    messageSingle: '确定要删除“{title}”的所有存档点吗？',
                    messageSelected: '确定要删除选中的 {count} 个对话的所有存档点吗？',
                    stats: '将删除 {count} 个存档点，释放 {size} 存储空间',
                    warning: '此操作不可恢复',
                    cancel: '取消',
                    delete: '删除'
                },
                timeFormat: {
                    justNow: '刚刚',
                    minutesAgo: '{count} 分钟前',
                    hoursAgo: '{count} 小时前',
                    daysAgo: '{count} 天前'
                }
            }
        }
    },
    summarize: {
        title: '上下文总结',
        description: '压缩对话历史，减少 Token 使用量',
        enableSummarize: '启用总结',
        tokenThreshold: 'Token 阈值',
        summaryModel: '总结模型',
        summaryPrompt: '总结提示词'
    },
    imageGen: {
        title: '图像生成',
        description: '配置 AI 图像生成工具',
        enableImageGen: '启用图像生成',
        provider: '提供者',
        model: '模型',
        outputPath: '输出路径',
        maxImages: '最大图片数'
    },
    dependencies: {
        title: '扩展依赖',
        description: '管理可选功能所需的依赖',
        installed: '已安装',
        notInstalled: '未安装',
        installing: '安装中',
        installFailed: '安装失败',
        install: '安装',
        uninstall: '卸载',
        required: '必需',
        optional: '可选'
    },
    context: {
        title: '上下文感知',
        description: '配置发送给 AI 的工作区上下文信息',
        includeFileTree: '包含文件树',
        includeOpenFiles: '包含打开的文件',
        includeSelection: '包含选中内容',
        maxDepth: '最大深度',
        excludePatterns: '排除规则',
        pinnedFiles: '固定文件',
        addPinnedFile: '添加固定文件'
    },
    prompt: {
        title: '系统提示词',
        description: '自定义系统提示词的结构和内容',
        systemPrompt: '系统提示词',
        customPrompt: '自定义提示词',
        templateVariables: '模板变量',
        preview: '预览',
        sections: {
            environment: '环境信息',
            tools: '工具描述',
            context: '上下文信息',
            instructions: '指令'
        }
    },
    general: {
        title: '通用设置',
        description: '基本配置选项',
        proxy: {
            title: '网络代理',
            description: '配置 HTTP 代理用于 API 请求',
            enable: '启用代理',
            url: '代理地址',
            urlPlaceholder: 'http://127.0.0.1:7890',
            urlError: '请输入有效的代理地址（http:// 或 https://）'
        },
        language: {
            title: '界面语言',
            description: '选择界面显示语言',
            auto: '跟随系统',
            autoDescription: '自动跟随 VS Code 语言设置'
        },
        appInfo: {
            title: '应用信息',
            name: 'Acopilot - Vibe Coding 助手',
            version: '版本',
            repository: '项目仓库',
            developer: '开发者'
        }
    },
};
