export const zhCNComponentsSettingsPart2 = {
    contextSettings: {
        loading: '加载中...',
        workspaceFiles: {
            title: '工作区文件树',
            description: '将工作区文件目录结构发送给 AI',
            sendFileTree: '发送工作区文件树',
            maxDepth: '最大深度',
            unlimitedHint: '-1 表示无限制'
        },
        openTabs: {
            title: '打开的标签页',
            description: '将当前打开的文件列表发送给 AI',
            sendOpenTabs: '发送打开的标签页',
            maxCount: '最大数量'
        },
        activeEditor: {
            title: '当前活动编辑器',
            description: '将当前正在编辑的文件路径发送给 AI',
            sendActiveEditor: '发送当前活动编辑器路径'
        },
        diagnostics: {
            title: '诊断信息',
            description: '将工作区的错误、警告等诊断信息发送给 AI，帮助 AI 修复代码问题',
            enableDiagnostics: '启用诊断信息',
            severityTypes: '问题类型',
            severity: {
                error: '错误',
                warning: '警告',
                information: '信息',
                hint: '提示'
            },
            workspaceOnly: '仅工作区内文件',
            openFilesOnly: '仅打开的文件',
            maxPerFile: '每文件最大数量',
            maxFiles: '最大文件数'
        },
        ignorePatterns: {
            title: '忽略模式',
            description: '匹配的文件/文件夹不会出现在上下文中（支持通配符）',
            removeTooltip: '移除',
            emptyHint: '暂无自定义忽略模式',
            inputPlaceholder: '输入模式，如：**/node_modules, *.log',
            addButton: '添加',
            helpTitle: '通配符说明:',
            helpItems: {
                wildcard: '* - 匹配任意字符（不包含路径分隔符）',
                recursive: '** - 匹配任意层级目录',
                examples: '例如: **/node_modules、*.log、.git'
            }
        },
        preview: {
            title: '当前状态预览',
            autoRefreshBadge: '实时更新',
            description: '预览当前会发送给 AI 的上下文信息（每 2 秒自动刷新）',
            activeEditorLabel: '当前活动编辑器：',
            openTabsLabel: '打开的标签页（{count} 个）：',
            noValue: '无',
            moreItems: '... 还有 {count} 个'
        },
        saveSuccess: '保存成功',
        saveFailed: '保存失败'
    },
    dependencySettings: {
        title: '扩展依赖管理',
        description: '管理可选的扩展功能所需的依赖。这些依赖将安装到本地文件系统，不会打包进插件。',
        installPath: '安装路径：',
        installed: '已安装',
        installing: '安装中...',
        uninstalling: '卸载中...',
        install: '安装',
        uninstall: '卸载',
        estimatedSize: '约 {size}MB',
        empty: '暂无需要依赖的工具',
        progress: {
            processing: '正在处理 {dependency}...',
            complete: '{dependency} 处理完成',
            failed: '{dependency} 处理失败',
            installSuccess: '{name} 安装成功！',
            installFailed: '{name} 安装失败',
            uninstallSuccess: '{name} 已卸载',
            uninstallFailed: '{name} 卸载失败',
            unknownError: '未知错误'
        },
        panel: {
            installedCount: '{installed}/{total}'
        }
    },
    generateImageSettings: {
        description: '图像生成工具允许 AI 调用图像生成模型来创建图片。生成的图片会保存到工作区并以多模态形式返回给 AI 查看。',
        api: {
            title: 'API 配置',
            provider: 'Provider',
            providerHint: '选择图像生成 API 的服务商，会自动填充默认 URL 与推荐模型。',
            providerOptions: {
                gemini: 'Gemini',
                together: 'Together AI'
            },
            url: 'API URL',
            urlPlaceholder: 'https://generativelanguage.googleapis.com/v1beta',
            urlHint: '图像生成 API 的基础 URL',
            apiKey: 'API Key',
            apiKeyPlaceholder: '输入 API Key',
            apiKeyHint: '用于图像生成 API 的密钥',
            model: '模型名称',
            modelPlaceholder: 'gemini-3-pro-Image-preview',
            modelHint: '例如：gemini-3-pro-Image-preview',
            modelPreset: '推荐模型',
            modelPresetPlaceholder: '自定义（手动输入）',
            modelPresetHint: '选择后会自动填充模型名称；也可直接在上方手动输入。',
            show: '显示',
            hide: '隐藏'
        },
        aspectRatio: {
            title: '宽高比参数',
            enable: '启用宽高比参数',
            fixedRatio: '固定宽高比',
            placeholder: '不固定（AI 可选择）',
            options: {
                auto: '自动',
                square: '正方形',
                landscape: '横向',
                portrait: '纵向',
                mobilePortrait: '手机屏幕竖屏',
                widescreen: '宽屏',
                ultrawide: '超宽屏'
            },
            hints: {
                disabled: '禁用时：AI 不能配置此参数，API 调用不传入此参数',
                fixed: '已固定：AI 将被告知固定为 {ratio}，不能更改',
                flexible: '未固定：AI 可使用 aspect_ratio 参数自行选择'
            }
        },
        imageSize: {
            title: '图片尺寸参数',
            enable: '启用图片尺寸参数',
            fixedSize: '固定图片尺寸',
            placeholder: '不固定（AI 可选择）',
            options: {
                auto: '自动'
            },
            hints: {
                disabled: '禁用时：AI 不能配置此参数，API 调用不传入此参数',
                fixed: '已固定：AI 将被告知固定为 {size}，不能更改',
                flexible: '未固定：AI 可使用 image_size 参数自行选择'
            }
        },
        batch: {
            title: '批量生成限制',
            maxTasks: '最大批量任务数',
            maxTasksHint: 'AI 单次调用允许的最大任务数（不同提示词的图片）。范围 1-20。',
            maxImagesPerTask: '单任务最大图片数',
            maxImagesPerTaskHint: '每个任务（单个提示词）最多保存的图片数量。范围 1-10。',
            summary: '当前配置：AI 单次最多发起 {maxTasks} 个任务，每个任务最多保存 {maxImages} 张图片'
        },
        usage: {
            title: '使用说明',
            step1: '配置上方的 API URL、API Key 和模型名称',
            step2: '确保工具在"工具设置"中已启用',
            step3: '在对话中让 AI 调用 generate_image 工具生成图片',
            step4: '生成的图片会保存到工作区的 generated_images 目录',
            warning: '请配置 API Key 后才能使用图像生成功能'
        }
    },
    mcpSettings: {
        toolbar: {
            addServer: '添加服务器',
            editJson: '编辑 JSON',
            refresh: '刷新'
        },
        loading: '加载中...',
        empty: {
            title: '暂无 MCP 服务器',
            description: '点击"添加服务器"按钮来配置您的第一个 MCP 服务器'
        },
        serverCard: {
            connect: '连接',
            disconnect: '断开',
            connecting: '连接中...',
            edit: '编辑',
            delete: '删除',
            tools: '工具',
            resources: '资源',
            prompts: '提示'
        },
        status: {
            connected: '已连接',
            connecting: '连接中...',
            error: '连接错误',
            disconnected: '未连接'
        },
        form: {
            addTitle: '添加 MCP 服务器',
            editTitle: '编辑 MCP 服务器',
            serverId: '服务器 ID',
            serverIdPlaceholder: '可选，留空则自动生成',
            serverIdHint: '只能包含字母、数字、下划线和中划线，用于在 JSON 配置中标识服务器',
            serverIdError: 'ID 只能包含字母、数字、下划线和中划线',
            serverName: '服务器名称',
            serverNamePlaceholder: '例如：My MCP Server',
            description: '描述',
            descriptionPlaceholder: '可选的描述信息',
            required: '*',
            transportType: '传输类型',
            command: '命令',
            commandPlaceholder: '例如：npx, python, node',
            args: '参数',
            argsPlaceholder: '空格分隔，例如：-m mcp_server',
            env: '环境变量 (JSON)',
            envPlaceholder: '{"KEY": "value"}',
            url: 'URL',
            urlPlaceholderSse: 'https://example.com/sse',
            urlPlaceholderHttp: 'https://example.com/mcp',
            headers: '请求头 (JSON)',
            headersPlaceholder: '{"Authorization": "Bearer token"}',
            options: '选项',
            enabled: '启用',
            autoConnect: '自动连接',
            cleanSchema: '清理 Schema',
            cleanSchemaHint: '移除 JSON Schema 中不兼容的字段（如 $schema, additionalProperties），某些 API（如 Gemini）需要启用此选项',
            timeout: '连接超时 (毫秒)',
            cancel: '取消',
            create: '创建',
            save: '保存'
        },
        validation: {
            nameRequired: '请输入服务器名称',
            idInvalid: 'ID 无效',
            idChecking: '正在验证 ID，请稍候',
            commandRequired: '请输入命令',
            urlRequired: '请输入 URL',
            createFailed: '创建失败',
            updateFailed: '更新失败'
        },
        delete: {
            title: '删除 MCP 服务器',
            message: '确定要删除服务器 "{name}" 吗？此操作不可恢复。',
            confirm: '删除',
            cancel: '取消'
        }
    },
    modelManager: {
        title: '模型列表',
        fetchModels: '获取模型',
        clearAll: '清除全部',
        clearAllTooltip: '清除所有模型',
        empty: '暂无模型，请点击"获取模型"或手动添加',
        addPlaceholder: '手动输入模型 ID',
        addTooltip: '添加',
        removeTooltip: '移除',
        enabledTooltip: '当前启用的模型',
        filterPlaceholder: '筛选模型...',
        clearFilter: '清除筛选',
        noResults: '没有匹配的模型',
        clearDialog: {
            title: '清除所有模型',
            message: '确定要清除所有 {count} 个模型吗？此操作不可恢复。',
            confirm: '清除',
            cancel: '取消'
        },
        errors: {
            addFailed: '添加模型失败',
            removeFailed: '移除模型失败',
            setActiveFailed: '设置激活模型失败'
        }
    },
    modelSelectionDialog: {
        title: '选择要添加的模型',
        selectAll: '全选',
        deselectAll: '全不选',
        close: '关闭',
        loading: '加载中...',
        error: '加载模型列表失败',
        retry: '重试',
        empty: '暂无可用模型',
        added: '已添加',
        selectionCount: '已选择 {count} 个模型',
        cancel: '取消',
        add: '添加 ({count})',
        filterPlaceholder: '筛选模型...',
        clearFilter: '清除筛选',
        noResults: '没有匹配的模型'
    },
    promptSettings: {
        loading: '加载中...',
        enable: '启用自定义系统提示词模板',
        enableDescription: '启用后可以自定义系统提示词的结构和内容，使用模块占位符组装提示词',
        templateSection: {
            title: '系统提示词模板',
            resetButton: '重置为默认',
            description: '直接编写系统提示词，使用 {{$VARIABLE}} 格式引用变量，变量会在发送时被替换为实际内容',
            placeholder: '输入系统提示词，可以使用 {{$ENVIRONMENT}} 等变量...'
        },
        saveButton: '保存配置',
        saveSuccess: '保存成功',
        saveFailed: '保存失败',
        modulesReference: {
            title: '可用变量参考',
            insertTooltip: '插入到模板末尾'
        },
        tokenCount: {
            label: 'Token 数量',
            channelTooltip: '选择用于计算 token 的渠道',
            refreshTooltip: '刷新 token 计数',
            failed: '计数失败',
            hint: '显示的是仅模板本身的 token 数，实际系统提示词还包含动态填充的变量内容'
        },
        modules: {
            ENVIRONMENT: {
                name: '环境信息',
                description: '包含工作区路径、操作系统、当前时间和时区信息'
            },
            WORKSPACE_FILES: {
                name: '工作区文件树',
                description: '列出工作区中的文件和目录结构，受上下文感知设置中的深度和忽略模式影响',
                requiresConfig: '上下文感知 > 发送工作区文件树'
            },
            OPEN_TABS: {
                name: '打开的标签页',
                description: '列出当前在编辑器中打开的文件标签页',
                requiresConfig: '上下文感知 > 发送打开的标签页'
            },
            ACTIVE_EDITOR: {
                name: '活动编辑器',
                description: '显示当前正在编辑的文件路径',
                requiresConfig: '上下文感知 > 发送当前活动编辑器'
            },
            DIAGNOSTICS: {
                name: '诊断信息',
                description: '显示工作区的错误、警告等诊断信息，帮助 AI 修复代码问题',
                requiresConfig: '上下文感知 > 启用诊断信息'
            },
            PINNED_FILES: {
                name: '固定文件内容',
                description: '显示用户固定的文件的完整内容',
                requiresConfig: '需要在输入框旁的固定文件按钮中添加文件'
            },
            TOOLS: {
                name: '工具定义',
                description: '根据渠道配置生成 XML 或 Function Call 格式的工具定义（此变量由系统自动填充）'
            },
            MCP_TOOLS: {
                name: 'MCP 工具',
                description: '来自 MCP 服务器的额外工具定义（此变量由系统自动填充）',
                requiresConfig: 'MCP 设置中需要配置并连接服务器'
            }
        },
        exampleOutput: '示例输出：',
        requiresConfigLabel: '依赖配置：',
        skills: {
            title: 'Skills',
            add: '添加 Skill',
            description: '管理可复用的提示词（Skill）。可在对话输入框旁的固定内容面板中选择使用。',
            empty: '暂无 Skill',
            saveSuccess: '保存成功',
            saveFailed: '保存失败',
            installFromUrl: {
                button: '从 URL 安装',
                modal: {
                    title: '从 URL 安装 Skill',
                    url: 'GitHub URL',
                    urlPlaceholder: 'https://github.com/owner/repo 或 https://github.com/owner/repo/tree/<ref>/.codex/skills/<skill>（或 .codex/<skill>）',
                    hint: '会下载安装到当前项目的 .codex/skills/ 目录，并自动导入到 Skills 列表'
                },
                validation: {
                    urlRequired: '请输入 GitHub URL',
                    noSkillsFound: '未找到可安装的 Codex skill（需要包含 .codex/skills 或 .codex/<skill>）',
                    noValidSkillsFound: '未找到有效的 Codex skill（未发现任何 SKILL.md，可能该仓库不是 Skill）'
                },
                notifications: {
                    installSuccess: '已安装 {count} 个 Skill',
                    noNewSkills: 'Skill 已存在，无新增（{count} 个）',
                    partialInvalid: '有 {count} 个 Skill 无效（缺少 SKILL.md），已跳过'
                },
                installFailed: '安装失败'
            },
            modal: {
                addTitle: '添加 Skill',
                editTitle: '编辑 Skill',
                id: 'ID',
                idPlaceholder: '例如：issue_killer',
                name: '名称',
                namePlaceholder: '例如：Issue Killer',
                description: '描述',
                descriptionPlaceholder: '可选，简短说明用途',
                prompt: '提示词内容',
                promptPlaceholder: '输入该 Skill 的提示词内容...'
            },
            validation: {
                idRequired: '请输入 ID',
                promptRequired: '请输入提示词内容',
                idDuplicate: 'ID 已存在'
            },
            delete: {
                title: '删除 Skill',
                message: '确定要删除这个 Skill 吗？此操作不可恢复。'
            }
        }
    },
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
            warningHint: '请选择渠道和模型，否则将使用对话时的模型进行总结'
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
            mcp: {
                title: 'MCP 设置',
                description: '配置 Model Context Protocol 服务器'
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
        mcpNote: 'MCP 工具由 MCP 服务提供，无法在此禁用',
        mcpDisableTooltip: '由 MCP 服务提供，无法在此禁用',
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
            message: '你正在为危险工具 {tool} 开启自动执行，这可能导致不可恢复的修改。是否继续？',
            confirm: '继续开启',
            cancel: '取消'
        },
        enableAllDangerous: {
            title: '批量开启自动执行',
            message: '检测到危险工具（delete_file / execute_command）。是否也将它们设为自动执行？',
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
            mcp: 'MCP',
            other: '其他'
        },
        dependency: {
            required: '需要依赖',
            requiredTooltip: '此工具需要安装依赖才能使用',
            disabledTooltip: '工具已禁用或缺少依赖'
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
