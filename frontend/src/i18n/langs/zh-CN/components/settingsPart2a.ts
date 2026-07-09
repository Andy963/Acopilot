export const zhCNComponentsSettingsPart2a = {
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
            maxFiles: '最大文件数',
            presets: {
                errorsOnly: '仅错误',
                openFilesFirst: '打开文件优先',
                workspace: '当前工作区'
            }
        },
        ignorePatterns: {
            title: '忽略模式',
            description: '匹配的文件/文件夹不会出现在上下文中（支持通配符）',
            removeTooltip: '移除',
            emptyHint: '暂无自定义忽略模式',
            inputPlaceholder: '输入模式，如：**/node_modules, *.log',
            addButton: '添加',
            matchedSummary: '当前忽略规则命中 {matched}/{scanned} 个文件',
            patternMatchCount: '命中 {count} 个',
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
            openInspector: '查看当前上下文',
            workspaceFilesLabel: '工作区文件树（{count} 行）：',
            activeEditorLabel: '当前活动编辑器：',
            openTabsLabel: '打开的标签页（{count} 个）：',
            diagnosticsLabel: '诊断信息（{files} 个文件，{count} 条）：',
            ignoreMatchesLabel: '被忽略的文件（{count} 个）：',
            noValue: '无',
            moreItems: '... 还有 {count} 个'
        },
        cost: {
            badge: '~{tokens} tok · {chars} ch'
        },
        saveSuccess: '保存成功',
        saveFailed: '保存失败'
    },
    dependencySettings: {
        title: '工具依赖',
        description: '管理工具所需的依赖。这些依赖将安装到本地文件系统，不会打包进插件。',
        installPath: '安装路径：',
        pathRelation: '依赖包安装在 General 存储路径下的 dependencies 托管目录中。完成存储路径迁移后，此位置会跟随新的存储路径；它不是存储根目录本身。',
        installed: '已安装',
        installing: '安装中...',
        uninstalling: '卸载中...',
        install: '安装',
        uninstall: '卸载',
        copyFailureLog: '复制失败日志',
        copyFailureLogSuccess: '失败日志已复制',
        copyFailureLogFailed: '复制失败日志失败',
        estimatedSize: '约 {size}MB',
        empty: '暂无需要依赖的工具',
        uninstallConfirm: {
            title: '卸载依赖？',
            message: '确定卸载 {name} 吗？以下工具可能变为不可用：{tools}',
            confirm: '卸载',
            cancel: '取消',
            none: '暂无已知工具'
        },
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
            testConnection: '测试连接',
            testSuccess: '{provider} 连接正常（{model}）',
            testFailed: '连接测试失败',
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
                together: 'Together AI 的图像生成接口不支持此参数。',
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
                together: 'Together AI 的图像生成接口不支持此参数。',
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
        validation: {
            emptyTemplate: '模板不能为空。',
            unknownVariables: '未知变量：{variables}。请使用参考列表中的变量。',
            duplicateVariables: '重复变量：{variables}。最终提示词中会重复注入对应上下文。',
            fixBeforeSave: '请先修复模板校验错误再保存。'
        },
        history: {
            title: 'Prompt 版本历史',
            hint: '本地保留最近 10 次保存/重置前的版本。',
            empty: '暂无历史版本。',
            restore: '恢复',
            restored: '已从历史恢复，请保存后生效。'
        },
        modulesReference: {
            title: '可用变量参考',
            insertTooltip: '插入到模板末尾'
        },
        tokenCount: {
            label: '预估 Token 数量',
            channelTooltip: '选择用于计算 token 的渠道',
            refreshTooltip: '刷新 token 计数',
            failed: '计数失败',
            hint: '仅为估算值，显示变量展开前的模板 token 数；实际系统提示词还包含动态填充的变量内容。'
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
            PINNED_PROMPTS: {
                name: '固定提示词',
                description: '显示当前对话启用的固定提示词块'
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
            title: 'Prompt Skills',
            add: '添加 Prompt Skill',
            description: '管理可复用的 Prompt Skills。它们会作为素材库保存，不会自动注入每次对话。',
            lifecycleNote: '固定 Skill 选择是独立流程：在输入框旁的固定内容面板中选择 Prompt Skill，才会附加到某个对话或工作区默认选择。',
            empty: '暂无 Prompt Skill',
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
};
