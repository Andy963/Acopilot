export const zhCNComponentsSettingsPart2b = {
    summarizeSettings: {
        description: '上下文总结功能可以压缩对话历史，减少 Token 使用量。当对话过长时，可以手动或自动触发总结，将旧的对话内容压缩为摘要。',
        manualSection: {
            title: '手动总结',
            description: '点击输入框右侧的压缩按钮，可以手动触发上下文总结。总结后的内容会替换原有的历史对话。'
        },
        autoSection: {
            title: '自动总结',
            comingSoon: '即将推出',
            enable: '启用自动总结',
            enableHint: '当 Token 使用量超过阈值时自动触发总结',
            threshold: '触发阈值',
            thresholdUnit: '%',
            thresholdHint: '当 Token 使用量达到此百分比时触发自动总结'
        },
        optionsSection: {
            title: '总结选项',
            keepRounds: '保留最近轮数',
            keepRoundsUnit: '轮',
            keepRoundsHint: '保留最近 N 轮对话不参与总结，确保上下文连贯',
            prompt: '总结提示词',
            promptPlaceholder: '输入总结时使用的提示词...',
            promptHint: 'AI 进行总结时使用的指令'
        },
        modelSection: {
            title: '专用总结模型',
            useSeparate: '使用专用总结模型',
            useSeparateHint: '启用后，总结时将使用下方指定的模型，而不是对话时使用的模型。\n可以选择更便宜的模型来节省成本。',
            currentModelHint: '当前使用对话时的模型进行总结',
            selectChannel: '选择渠道',
            selectChannelPlaceholder: '选择用于总结的渠道',
            selectChannelHint: '只显示已启用的渠道',
            selectModel: '选择模型',
            selectModelPlaceholder: '选择用于总结的模型',
            selectModelHint: '只显示该渠道已添加到设置中的模型。\n如需添加更多模型，请前往渠道设置进行配置。',
            warningHint: '请选择渠道和模型，否则将使用对话时的模型进行总结',
            invalidSelectionHint: '已选择的总结渠道或模型不存在，请前往渠道设置更新。',
            openChannelSettings: '打开渠道设置'
        }
    },
    settingsPanel: {
        title: '设置',
        backToChat: '返回对话',
        sections: {
            channel: {
                title: '渠道设置',
                description: '配置 API 渠道和模型'
            },
            tools: {
                title: '工具设置',
                description: '管理和配置可用工具'
            },
            autoExec: {
                title: '自动执行',
                description: '配置工具执行时的确认行为'
            },
            checkpoint: {
                title: '存档点设置',
                description: '配置代码库快照备份和回退'
            },
            summarize: {
                title: '上下文总结',
                description: '压缩对话历史，减少 Token 使用量'
            },
            imageGen: {
                title: '图像生成',
                description: '配置 AI 图像生成工具'
            },
            context: {
                title: '上下文感知',
                description: '配置发送给 AI 的工作区上下文信息'
            },
            prompt: {
                title: '系统提示词',
                description: '自定义系统提示词的结构和内容'
            },
            tokenCount: {
                title: 'Token 计数',
                description: '配置用于计算 Token 数量的 API'
            },
            general: {
                title: '通用设置',
                description: '基本配置选项'
            }
        },
        proxy: {
            title: '网络代理',
            description: '配置 HTTP 代理用于 API 请求',
            enable: '启用代理',
            url: '代理地址',
            urlPlaceholder: 'http://127.0.0.1:7890',
            urlError: '请输入有效的代理地址（http:// 或 https://）',
            save: '保存',
            saveSuccess: '保存成功',
            saveFailed: '保存失败'
        },
        language: {
            title: '界面语言',
            description: '选择界面显示语言',
            placeholder: '选择语言',
            autoDescription: '自动跟随 VS Code 语言设置'
        },
        appInfo: {
            title: '应用信息',
            name: 'acopilot',
            version: '版本：{version}',
            repository: '项目仓库',
            developer: '开发者'
        }
    },
    toolSettings: {
        files: {
            applyDiff: {
                autoApply: '自动应用修改',
                enableAutoApply: '启用自动应用',
                enableAutoApplyDesc: '开启后，AI 修改将在指定延迟后自动保存，无需手动确认',
                autoSaveDelay: '自动保存延迟',
                delayTime: '延迟时间',
                delayTimeDesc: '修改显示后等待此时间再自动保存',
                delay1s: '1 秒',
                delay2s: '2 秒',
                delay3s: '3 秒',
                delay5s: '5 秒',
                delay10s: '10 秒',
                infoEnabled: '当前设置：AI 修改文件后，将在 {delay} 后自动保存并继续执行。',
                infoDisabled: '当前设置：AI 修改文件后，需要您手动在编辑器中按 Ctrl+S 保存确认修改。'
            },
            listFiles: {
                ignoreList: '忽略列表',
                ignoreListHint: '（支持通配符，如 *.log, temp*）',
                inputPlaceholder: '输入要忽略的文件或目录模式...',
                deleteTooltip: '删除',
                addButton: '添加'
            }
        },
        search: {
            findFiles: {
                excludeList: '排除模式',
                excludeListHint: '（glob 格式，如 **/node_modules/**）',
                inputPlaceholder: '输入要排除的文件或目录模式...',
                deleteTooltip: '删除',
                addButton: '添加'
            },
            searchInFiles: {
                excludeList: '排除模式',
                excludeListHint: '（glob 格式，如 **/node_modules/**）',
                inputPlaceholder: '输入要排除的文件或目录模式...',
                deleteTooltip: '删除',
                addButton: '添加'
            },
            replaceInFiles: {
                excludeList: '替换排除模式',
                excludeListHint: '（glob 格式，如 **/node_modules/**）',
                inputPlaceholder: '输入替换时要排除的文件或目录模式...',
                deleteTooltip: '删除',
                addButton: '添加'
            }
        },
        lsp: {
            locate: {
                title: '定位（Locate）',
                hint: '（可选）可自动触发 Locate 模式。可配置模型覆盖与触发关键词',
                useChatModelOption: '跟随当前对话模型（不覆盖）',
                modelLabel: '定位模型',
                modelPlaceholder: '留空使用当前对话模型（例如：gemini-2.5-flash）',
                autoTriggerLabel: '自动触发',
                autoTriggerHint: '开启后，当消息命中触发关键词时会自动进入 Locate 模式',
                triggerKeywordsLabel: '触发关键词',
                triggerKeywordsHint: '每行一个；大小写不敏感；子串匹配',
                triggerKeywordsPlaceholder: '例如：\\n在哪\\n打开\\ndefinition\\nusages'
            }
        },
        terminal: {
            executeCommand: {
                shellEnv: 'Shell 环境',
                defaultBadge: '默认',
                available: '可用',
                unavailable: '不可用',
                setDefaultTooltip: '设为默认',
                executablePath: '可执行文件路径（可选）：',
                executablePathPlaceholder: '留空则使用系统 PATH 中的路径',
                execTimeout: '执行超时',
                timeoutHint: '命令执行超过此时间将自动终止',
                timeout30s: '30 秒',
                timeout1m: '1 分钟',
                timeout2m: '2 分钟',
                timeout5m: '5 分钟',
                timeout10m: '10 分钟',
                timeoutUnlimited: '无限制',
                maxOutputLines: '最大输出行数',
                maxOutputLinesHint: '发送给 AI 的终端输出的最后 N 行，避免输出过大',
                unlimitedLines: '无限制',
                risk: {
                    title: '命令安全策略',
                    enabled: '启用命令风险策略',
                    autoExecuteUpTo: {
                        label: '自动执行阈值',
                        hint: '超过此风险等级的命令将强制要求确认（即使 execute_command 设置为自动执行）',
                        low: '仅低风险',
                        medium: '允许到中风险'
                    },
                    confirmOn: '以下类型始终需要确认',
                    categories: {
                        destructive: '破坏性操作（rm/del/重定向）',
                        gitHistory: 'Git 破坏性操作（reset/clean/push --force）',
                        privilege: '提权命令（sudo）',
                        network: '网络下载/安装'
                    },
                    allowPatterns: '允许列表（正则，每行一条）',
                    allowPatternsHint: '命中允许列表的命令将跳过确认（不区分大小写正则）',
                    denyPatterns: '拒绝列表（正则，每行一条）',
                    denyPatternsHint: '命中拒绝列表的命令将被拦截（不区分大小写正则）'
                },
                tips: {
                    onlyEnabledUsed: '• 只有启用且可用的 Shell 才会被 AI 使用',
                    statusMeaning: '• ✓ 表示可用，✗ 表示不可用',
                    windowsRecommend: '• Windows 建议使用 PowerShell（支持 UTF-8）',
                    gitBashRequire: '• Git Bash 需要安装 Git for Windows',
                    wslRequire: '• WSL 需要启用 Windows Subsystem for Linux',
                    confirmSettings: '• 如需配置是否需要确认后执行，请前往"自动执行"设置页签'
                }
            }
        },
        media: {
            common: {
                returnImageToAI: '直接返回图片给 AI',
                returnImageDesc: '启用后，处理结果的图片 base64 将直接作为工具响应返回给 AI，AI 可以直接查看和分析图片内容。',
                returnImageDescDetail: '禁用后，只返回文字描述（如文件路径），AI 需要调用 read_file 工具才能查看图片。'
            },
            cropImage: {
                title: '裁切图片',
                description: '启用后，AI 可以直接查看裁切效果，判断区域是否正确。禁用可节省 token 消耗。'
            },
            generateImage: {
                title: '图像生成',
                description: '启用后，AI 可以直接看到生成的图片效果，便于判断是否需要重新生成或调整。禁用可节省 token 消耗。'
            },
            removeBackground: {
                title: '抠图',
                description: '启用后，AI 可以直接查看抠图效果，判断是否需要调整主体描述或重新处理。禁用可节省 token 消耗。'
            },
            resizeImage: {
                title: '缩放图片',
                description: '启用后，AI 可以直接查看缩放效果，判断尺寸是否合适。禁用可节省 token 消耗。'
            },
            rotateImage: {
                title: '旋转图片',
                description: '启用后，AI 可以直接查看旋转效果，判断角度是否正确。禁用可节省 token 消耗。'
            }
        },
        common: {
            loading: '加载中...',
            loadingConfig: '加载配置...',
            saving: '保存中...',
            error: '错误',
            retry: '重试'
        }
    },
    toolsSettings: {
        maxIterations: {
            label: '单回合最大工具调用次数',
            hint: '防止 AI 无限循环调用工具，-1 表示无限制',
            unit: '次'
        },
        actions: {
            refresh: '刷新',
            enableAll: '全部启用',
            disableAll: '全部禁用'
        },
        badges: {
            enabled: '启用',
            autoExec: '自动'
        },
        columns: {
            enabled: '启用',
            auto: '自动',
            config: '配置'
        },
        exec: {
            autoEnabled: '启用'
        },
        dangerConfirm: {
            title: '确认开启自动执行',
            message: '你正在为危险工具 {tool} 开启自动执行，这可能导致不可恢复的修改。继续前会先为该工具补齐执行前后存档点保护。是否继续？',
            checkpointFailed: '为危险工具启用存档点保护失败，已取消开启自动执行。',
            confirm: '继续开启',
            cancel: '取消'
        },
        enableAllDangerous: {
            title: '批量开启自动执行',
            message: '检测到危险工具（apply_diff / delete_file / execute_command / replace_in_files）。是否也将它们设为自动执行，并确保开启存档点保护？',
            confirm: '包含危险工具',
            cancel: '跳过危险工具'
        },
        loading: '加载工具列表...',
        empty: '暂无可用工具',
        categories: {
            file: '文件操作',
            search: '搜索',
            terminal: '终端',
            lsp: '代码智能',
            media: '媒体处理',
            other: '其他'
        },
        descriptions: {
            list_files: '列出工作区目录中的文件和子目录，可按需要递归展开。',
            read_file: '读取一个或多个文件内容，支持指定起止行范围。',
            write_file: '写入一个或多个文件，适用于创建或覆盖文件内容。',
            apply_diff: '对文件应用精确的搜索替换补丁。',
            delete_file: '删除一个或多个指定文件。',
            create_directory: '创建一个或多个目录，缺失的父目录会一并创建。',
            find_files: '按 glob 模式查找文件路径。',
            search_in_files: '在文件内容中搜索关键字或正则表达式。',
            replace_in_files: '在多个文件中搜索并替换文本，支持预览模式。',
            execute_command: '执行 Shell 命令并返回输出。',
            locate: '打开或定位到指定文件位置。',
            open_file: '在编辑器中打开文件并可定位到指定范围。',
            goto_definition: '跳转到符号定义位置。',
            find_references: '查找指定符号的引用位置。',
            get_usages: '查找符号使用位置并可返回上下文行。',
            get_symbols: '列出文件或目录中的代码符号。',
            get_errors: '读取工作区诊断信息，包括错误和警告。',
            generate_image: '根据提示词和可选参考图生成图片。',
            remove_background: '移除图片背景，并可保存透明结果或遮罩。',
            crop_image: '裁切图片到指定区域。',
            resize_image: '调整图片宽高。',
            rotate_image: '按指定角度旋转图片。'
        },
        dependency: {
            required: '需要依赖',
            requiredTooltip: '此工具需要安装依赖才能使用',
            disabledTooltip: '工具已禁用或缺少依赖',
            installSuccess: '已安装依赖：{dependencies}',
            copyLogSuccess: '依赖失败日志已复制',
            copyLogFailed: '复制依赖失败日志失败'
        },
        config: {
            tooltip: '配置工具'
        }
    },
    tokenCountSettings: {
        description: '配置用于精确计算 Token 数量的 API（用于设置页/调试中的 Token 统计）。为避免额外延迟与限流影响，对话发送与上下文裁剪默认使用本地估算。',
        hint: '如未配置或 API 调用失败，将自动回退到本地估算。',
        enableChannel: '启用此渠道的 Token 计数',
        baseUrl: 'API URL',
        apiKey: 'API Key',
        apiKeyPlaceholder: '输入 API Key',
        model: '模型名称',
        geminiUrlPlaceholder: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:countTokens?key={key}',
        geminiUrlHint: '使用 {model} 和 {key} 作为占位符',
        geminiModelPlaceholder: 'gemini-2.5-pro',
        anthropicUrlPlaceholder: 'https://api.anthropic.com/v1/messages/count_tokens',
        anthropicModelPlaceholder: 'claude-sonnet-4-5',
        comingSoon: '即将推出',
        customApi: '自定义 API',
        openaiDocTitle: 'OpenAI 兼容 API 接口',
        openaiDocDesc: 'OpenAI 官方未提供独立的 Token 计数 API。如果您有自建或第三方兼容的 Token 计数服务，可以在此配置。',
        openaiUrlPlaceholder: 'https://your-api.example.com/count-tokens',
        openaiUrlHint: '您的自定义 Token 计数 API 端点',
        openaiModelPlaceholder: 'gpt-4o',
        apiDocumentation: 'API 接口规范',
        requestExample: '请求示例',
        requestBody: '// 请求体',
        responseFormat: '// 响应格式',
        openaiDocNote: '您的 API 需要返回包含 total_tokens 字段的 JSON 响应。请求体使用 OpenAI Messages 格式。',
        saveSuccess: '配置已保存',
        saveFailed: '保存失败'
    },
    storageSettings: {
        title: '存储路径',
        description: '配置对话历史、存档点等数据的存储位置',
        currentPath: '当前存储路径',
        customPath: '自定义路径',
        customPathPlaceholder: '输入自定义存储路径...',
        customPathHint: '留空则使用默认路径（扩展存储目录）',
        browse: '浏览',
        apply: '应用',
        reset: '重置为默认',
        migrate: '迁移数据',
        migrateHint: '将现有数据迁移到新路径',
        migrating: '迁移中...',
        validating: '验证中...',
        validation: {
            valid: '路径有效',
            invalid: '路径无效',
            checking: '检查中...'
        },
        dialog: {
            migrateTitle: '确认迁移数据',
            migrateMessage: '是否将现有数据迁移到新路径？这将复制所有对话历史和存档点。',
            migrateWarning: '迁移过程中请勿关闭窗口',
            confirm: '确认迁移',
            cancel: '取消'
        },
        notifications: {
            pathUpdated: '存储路径已更新',
            pathReset: '存储路径已重置为默认',
            migrationSuccess: '数据迁移完成，请重新加载窗口以使更改生效',
            migrationFailed: '数据迁移失败: {error}',
            validationFailed: '路径验证失败: {error}'
        },
        reloadWindow: '重新加载窗口'
    }
};
