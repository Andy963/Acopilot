export const enComponentsSettingsPart2 = {
    contextSettings: {
        loading: 'Loading...',
        workspaceFiles: {
            title: 'Workspace File Tree',
            description: 'Send workspace directory structure to AI',
            sendFileTree: 'Send workspace file tree',
            maxDepth: 'Max Depth',
            unlimitedHint: '-1 means unlimited'
        },
        openTabs: {
            title: 'Open Tabs',
            description: 'Send current open file list to AI',
            sendOpenTabs: 'Send open tabs',
            maxCount: 'Max Count'
        },
        activeEditor: {
            title: 'Current Active Editor',
            description: 'Send currently editing file path to AI',
            sendActiveEditor: 'Send current active editor path'
        },
        diagnostics: {
            title: 'Diagnostics',
            description: 'Send workspace errors, warnings, and other diagnostics to AI to help fix code issues',
            enableDiagnostics: 'Enable diagnostics',
            severityTypes: 'Problem types',
            severity: {
                error: 'Error',
                warning: 'Warning',
                information: 'Info',
                hint: 'Hint'
            },
            workspaceOnly: 'Workspace files only',
            openFilesOnly: 'Open files only',
            maxPerFile: 'Max per file',
            maxFiles: 'Max files'
        },
        ignorePatterns: {
            title: 'Ignore Patterns',
            description: 'Matching files/folders will not appear in context (supports wildcards)',
            removeTooltip: 'Remove',
            emptyHint: 'No custom ignore patterns',
            inputPlaceholder: 'Enter pattern, e.g.: **/node_modules, *.log',
            addButton: 'Add',
            helpTitle: 'Wildcard Help:',
            helpItems: {
                wildcard: '* - Matches any character (excludes path separator)',
                recursive: '** - Matches any directory level',
                examples: 'e.g.: **/node_modules, *.log, .git'
            }
        },
        preview: {
            title: 'Current Status Preview',
            autoRefreshBadge: 'Live Update',
            description: 'Preview context information to be sent to AI (auto-refresh every 2 seconds)',
            activeEditorLabel: 'Current Active Editor:',
            openTabsLabel: 'Open Tabs ({count}):',
            noValue: 'None',
            moreItems: '... {count} more'
        },
        saveSuccess: 'Saved successfully',
        saveFailed: 'Save failed'
    },
    dependencySettings: {
        title: 'Extension Dependency Management',
        description: 'Manage dependencies required for optional extension features. These dependencies will be installed to the local file system and not packaged into the plugin.',
        installPath: 'Install Path:',
        installed: 'Installed',
        installing: 'Installing...',
        uninstalling: 'Uninstalling...',
        install: 'Install',
        uninstall: 'Uninstall',
        estimatedSize: 'About {size}MB',
        empty: 'No tools requiring dependencies',
        progress: {
            processing: 'Processing {dependency}...',
            complete: '{dependency} processing complete',
            failed: '{dependency} processing failed',
            installSuccess: '{name} installed successfully!',
            installFailed: '{name} installation failed',
            uninstallSuccess: '{name} uninstalled',
            uninstallFailed: '{name} uninstallation failed',
            unknownError: 'Unknown error'
        },
        panel: {
            installedCount: '{installed}/{total}'
        }
    },
    generateImageSettings: {
        description: 'The image generation tool allows AI to call the image generation model to create images. Generated images will be saved to the workspace and returned to AI for viewing in multimodal form.',
        api: {
            title: 'API Configuration',
            provider: 'Provider',
            providerHint: 'Select the image API provider. It will auto-fill a default URL and recommended models.',
            providerOptions: {
                gemini: 'Gemini',
                together: 'Together AI'
            },
            url: 'API URL',
            urlPlaceholder: 'https://generativelanguage.googleapis.com/v1beta',
            urlHint: 'Base URL for image generation API',
            apiKey: 'API Key',
            apiKeyPlaceholder: 'Enter API Key',
            apiKeyHint: 'Secret key for image generation API',
            model: 'Model Name',
            modelPlaceholder: 'gemini-3-pro-Image-preview',
            modelHint: 'e.g.: gemini-3-pro-Image-preview',
            modelPreset: 'Recommended models',
            modelPresetPlaceholder: 'Custom (type manually)',
            modelPresetHint: 'Selecting a preset will fill the model name automatically. You can also type above.',
            show: 'Show',
            hide: 'Hide'
        },
        aspectRatio: {
            title: 'Aspect Ratio Parameters',
            enable: 'Enable aspect ratio parameters',
            fixedRatio: 'Fixed Aspect Ratio',
            placeholder: 'Not fixed (AI can choose)',
            options: {
                auto: 'Auto',
                square: 'Square',
                landscape: 'Landscape',
                portrait: 'Portrait',
                mobilePortrait: 'Mobile Portrait',
                widescreen: 'Widescreen',
                ultrawide: 'Ultra-wide'
            },
            hints: {
                disabled: 'When disabled: AI cannot configure this parameter, API call will not include this parameter',
                fixed: 'Fixed: AI will be told to fix at {ratio}, cannot change',
                flexible: 'Not fixed: AI can choose using aspect_ratio parameter'
            }
        },
        imageSize: {
            title: 'Image Size Parameters',
            enable: 'Enable image size parameters',
            fixedSize: 'Fixed Image Size',
            placeholder: 'Not fixed (AI can choose)',
            options: {
                auto: 'Auto'
            },
            hints: {
                disabled: 'When disabled: AI cannot configure this parameter, API call will not include this parameter',
                fixed: 'Fixed: AI will be told to fix at {size}, cannot change',
                flexible: 'Not fixed: AI can choose using image_size parameter'
            }
        },
        batch: {
            title: 'Batch Generation Limits',
            maxTasks: 'Max Batch Tasks',
            maxTasksHint: 'Maximum number of tasks (images with different prompts) allowed per AI call. Range 1-20.',
            maxImagesPerTask: 'Max Images Per Task',
            maxImagesPerTaskHint: 'Maximum number of images saved per task (single prompt). Range 1-10.',
            summary: 'Current config: AI can initiate up to {maxTasks} tasks per call, with up to {maxImages} images saved per task'
        },
        usage: {
            title: 'Usage Instructions',
            step1: 'Configure API URL, API Key, and model name above',
            step2: 'Ensure the tool is enabled in "Tool Settings"',
            step3: 'Have AI call the generate_image tool in conversation to create images',
            step4: 'Generated images will be saved to the generated_images directory in the workspace',
            warning: 'Please configure API Key before using image generation feature'
        }
    },
    mcpSettings: {
        toolbar: {
            addServer: 'Add Server',
            editJson: 'Edit JSON',
            refresh: 'Refresh'
        },
        loading: 'Loading...',
        empty: {
            title: 'No MCP Servers',
            description: 'Click "Add Server" button to configure your first MCP server'
        },
        serverCard: {
            connect: 'Connect',
            disconnect: 'Disconnect',
            connecting: 'Connecting...',
            edit: 'Edit',
            delete: 'Delete',
            tools: 'Tools',
            resources: 'Resources',
            prompts: 'Prompts'
        },
        status: {
            connected: 'Connected',
            connecting: 'Connecting...',
            error: 'Connection Error',
            disconnected: 'Disconnected'
        },
        form: {
            addTitle: 'Add MCP Server',
            editTitle: 'Edit MCP Server',
            serverId: 'Server ID',
            serverIdPlaceholder: 'Optional, leave blank to auto-generate',
            serverIdHint: 'Can only contain letters, numbers, underscores and hyphens, used to identify server in JSON config',
            serverIdError: 'ID can only contain letters, numbers, underscores and hyphens',
            serverName: 'Server Name',
            serverNamePlaceholder: 'e.g.: My MCP Server',
            description: 'Description',
            descriptionPlaceholder: 'Optional description',
            required: '*',
            transportType: 'Transport Type',
            command: 'Command',
            commandPlaceholder: 'e.g.: npx, python, node',
            args: 'Arguments',
            argsPlaceholder: 'Space separated, e.g.: -m mcp_server',
            env: 'Environment Variables (JSON)',
            envPlaceholder: '{"KEY": "value"}',
            url: 'URL',
            urlPlaceholderSse: 'https://example.com/sse',
            urlPlaceholderHttp: 'https://example.com/mcp',
            headers: 'Headers (JSON)',
            headersPlaceholder: '{"Authorization": "Bearer token"}',
            options: 'Options',
            enabled: 'Enabled',
            autoConnect: 'Auto Connect',
            cleanSchema: 'Clean Schema',
            cleanSchemaHint: 'Remove incompatible fields from JSON Schema (e.g. $schema, additionalProperties), required for some APIs (e.g. Gemini)',
            timeout: 'Connection Timeout (ms)',
            cancel: 'Cancel',
            create: 'Create',
            save: 'Save'
        },
        validation: {
            nameRequired: 'Please enter server name',
            idInvalid: 'ID is invalid',
            idChecking: 'Validating ID, please wait',
            commandRequired: 'Please enter command',
            urlRequired: 'Please enter URL',
            createFailed: 'Create failed',
            updateFailed: 'Update failed'
        },
        delete: {
            title: 'Delete MCP Server',
            message: 'Are you sure you want to delete server "{name}"? This action cannot be undone.',
            confirm: 'Delete',
            cancel: 'Cancel'
        }
    },
    modelManager: {
        title: 'Model List',
        fetchModels: 'Fetch Models',
        clearAll: 'Clear All',
        clearAllTooltip: 'Clear all models',
        empty: 'No models, please click "Fetch Models" or add manually',
        addPlaceholder: 'Manually enter model ID',
        addTooltip: 'Add',
        removeTooltip: 'Remove',
        enabledTooltip: 'Currently enabled model',
        filterPlaceholder: 'Filter models...',
        clearFilter: 'Clear filter',
        noResults: 'No matching models',
        clearDialog: {
            title: 'Clear All Models',
            message: 'Are you sure you want to clear all {count} models? This action cannot be undone.',
            confirm: 'Clear',
            cancel: 'Cancel'
        },
        errors: {
            addFailed: 'Failed to add model',
            removeFailed: 'Failed to remove model',
            setActiveFailed: 'Failed to set active model'
        }
    },
    modelSelectionDialog: {
        title: 'Select Models to Add',
        selectAll: 'Select All',
        deselectAll: 'Deselect All',
        close: 'Close',
        loading: 'Loading...',
        error: 'Failed to load model list',
        retry: 'Retry',
        empty: 'No models available',
        added: 'Added',
        selectionCount: 'Selected {count} models',
        cancel: 'Cancel',
        add: 'Add ({count})',
        filterPlaceholder: 'Filter models...',
        clearFilter: 'Clear filter',
        noResults: 'No matching models'
    },
    promptSettings: {
        loading: 'Loading...',
        enable: 'Enable Custom System Prompt Template',
        enableDescription: 'When enabled, you can customize the structure and content of system prompts using module placeholders',
        templateSection: {
            title: 'System Prompt Template',
            resetButton: 'Reset to Default',
            description: 'Write system prompts directly, use {{$VARIABLE}} format to reference variables, which will be replaced with actual content when sent',
            placeholder: 'Enter system prompt, you can use variables like {{$ENVIRONMENT}}...'
        },
        saveButton: 'Save Configuration',
        saveSuccess: 'Saved successfully',
        saveFailed: 'Save failed',
        tokenCount: {
            label: 'Token Count',
            channelTooltip: 'Select channel for token calculation',
            refreshTooltip: 'Refresh token count',
            failed: 'Count failed',
            hint: 'Shows token count for template only, actual system prompt includes dynamically filled variable content'
        },
        modulesReference: {
            title: 'Available Variables Reference',
            insertTooltip: 'Insert at the end of template'
        },
        modules: {
            ENVIRONMENT: {
                name: 'Environment Info',
                description: 'Contains workspace path, operating system, current time and timezone information'
            },
            WORKSPACE_FILES: {
                name: 'Workspace File Tree',
                description: 'Lists files and directory structure in the workspace, affected by depth and ignore patterns in context awareness settings',
                requiresConfig: 'Context Awareness > Send Workspace File Tree'
            },
            OPEN_TABS: {
                name: 'Open Tabs',
                description: 'Lists file tabs currently open in the editor',
                requiresConfig: 'Context Awareness > Send Open Tabs'
            },
            ACTIVE_EDITOR: {
                name: 'Active Editor',
                description: 'Shows the path of the currently editing file',
                requiresConfig: 'Context Awareness > Send Active Editor'
            },
            DIAGNOSTICS: {
                name: 'Diagnostics',
                description: 'Shows workspace errors, warnings and other diagnostics to help AI fix code issues',
                requiresConfig: 'Context Awareness > Enable Diagnostics'
            },
            PINNED_FILES: {
                name: 'Pinned Files Content',
                description: 'Shows complete content of user-pinned files',
                requiresConfig: 'Need to add files in the pinned files button next to input box'
            },
            TOOLS: {
                name: 'Tool Definitions',
                description: 'Generate tool definitions in XML or Function Call format based on channel configuration (this variable is automatically filled by the system)'
            },
            MCP_TOOLS: {
                name: 'MCP Tools',
                description: 'Additional tool definitions from MCP servers (this variable is automatically filled by the system)',
                requiresConfig: 'Need to configure and connect servers in MCP settings'
            }
        },
        exampleOutput: 'Example Output:',
        requiresConfigLabel: 'Requires Config:',
        skills: {
            title: 'Skills',
            add: 'Add Skill',
            description: 'Manage reusable prompts (skills). You can select them from the pinned panel next to the input box.',
            empty: 'No skills',
            saveSuccess: 'Saved successfully',
            saveFailed: 'Save failed',
            installFromUrl: {
                button: 'Install from URL',
                modal: {
                    title: 'Install Skill from URL',
                    url: 'GitHub URL',
                    urlPlaceholder: 'https://github.com/owner/repo or https://github.com/owner/repo/tree/<ref>/.codex/skills/<skill> (or .codex/<skill>)',
                    hint: 'Will be installed to .codex/skills/ in this project and automatically imported into the Skills list'
                },
                validation: {
                    urlRequired: 'Please enter a GitHub URL',
                    noSkillsFound: 'No Codex skills found to install (requires .codex/skills or .codex/<skill>)',
                    noValidSkillsFound: 'No valid Codex skills found (no SKILL.md detected; this repo may not be a Skill pack)'
                },
                notifications: {
                    installSuccess: 'Installed {count} skill(s)',
                    noNewSkills: 'Skills already exist, no new installs ({count})',
                    partialInvalid: '{count} skill(s) are invalid (missing SKILL.md) and were skipped'
                },
                installFailed: 'Install failed'
            },
            modal: {
                addTitle: 'Add Skill',
                editTitle: 'Edit Skill',
                id: 'ID',
                idPlaceholder: 'e.g. issue_killer',
                name: 'Name',
                namePlaceholder: 'e.g. Issue Killer',
                description: 'Description',
                descriptionPlaceholder: 'Optional, short description',
                prompt: 'Prompt',
                promptPlaceholder: 'Enter the prompt content for this skill...'
            },
            validation: {
                idRequired: 'ID is required',
                promptRequired: 'Prompt is required',
                idDuplicate: 'ID already exists'
            },
            delete: {
                title: 'Delete Skill',
                message: 'Are you sure you want to delete this skill? This action cannot be undone.'
            }
        }
    },
    summarizeSettings: {
        description: 'Context summarization can compress conversation history to reduce Token usage. When conversations get too long, you can manually or automatically trigger summarization to compress old conversation content into a summary.',
        manualSection: {
            title: 'Manual Summarization',
            description: 'Click the compress button on the right side of the input box to manually trigger context summarization. The summarized content will replace the original conversation history.'
        },
        autoSection: {
            title: 'Auto Summarization',
            comingSoon: 'Coming Soon',
            enable: 'Enable Auto Summarization',
            enableHint: 'Automatically trigger summarization when Token usage exceeds the threshold',
            threshold: 'Trigger Threshold',
            thresholdUnit: '%',
            thresholdHint: 'Trigger auto summarization when Token usage reaches this percentage'
        },
        optionsSection: {
            title: 'Summarization Options',
            keepRounds: 'Keep Recent Rounds',
            keepRoundsUnit: 'rounds',
            keepRoundsHint: 'Keep the most recent N rounds of conversation from being summarized to ensure context continuity',
            prompt: 'Summarization Prompt',
            promptPlaceholder: 'Enter the prompt to use for summarization...',
            promptHint: 'Instructions used by AI when performing summarization'
        },
        modelSection: {
            title: 'Dedicated Summarization Model',
            useSeparate: 'Use Dedicated Summarization Model',
            useSeparateHint: 'When enabled, summarization will use the model specified below instead of the model used in the conversation.\nYou can choose a cheaper model to save costs.',
            currentModelHint: 'Currently using the conversation model for summarization',
            selectChannel: 'Select Channel',
            selectChannelPlaceholder: 'Select channel for summarization',
            selectChannelHint: 'Only shows enabled channels',
            selectModel: 'Select Model',
            selectModelPlaceholder: 'Select model for summarization',
            selectModelHint: 'Only shows models added to settings for this channel.\nTo add more models, please go to channel settings to configure.',
            warningHint: 'Please select a channel and model, otherwise the conversation model will be used for summarization'
        }
    },
    settingsPanel: {
        title: 'Settings',
        backToChat: 'Back to Chat',
        sections: {
            channel: {
                title: 'Channel Settings',
                description: 'Configure API channels and models'
            },
            tools: {
                title: 'Tool Settings',
                description: 'Manage and configure available tools'
            },
            autoExec: {
                title: 'Auto Execution',
                description: 'Configure confirmation behavior when executing tools'
            },
            mcp: {
                title: 'MCP Settings',
                description: 'Configure Model Context Protocol servers'
            },
            checkpoint: {
                title: 'Checkpoint Settings',
                description: 'Configure codebase snapshot backup and rollback'
            },
            summarize: {
                title: 'Context Summarization',
                description: 'Compress conversation history to reduce Token usage'
            },
            imageGen: {
                title: 'Image Generation',
                description: 'Configure AI image generation tools'
            },
            context: {
                title: 'Context Awareness',
                description: 'Configure workspace context information sent to AI'
            },
            prompt: {
                title: 'System Prompt',
                description: 'Customize the structure and content of system prompts'
            },
            tokenCount: {
                title: 'Token Count',
                description: 'Configure API for counting tokens'
            },
            general: {
                title: 'General Settings',
                description: 'Basic configuration options'
            }
        },
        proxy: {
            title: 'Network Proxy',
            description: 'Configure HTTP proxy for API requests',
            enable: 'Enable Proxy',
            url: 'Proxy Address',
            urlPlaceholder: 'http://127.0.0.1:7890',
            urlError: 'Please enter a valid proxy address (http:// or https://)',
            save: 'Save',
            saveSuccess: 'Saved successfully',
            saveFailed: 'Save failed'
        },
        language: {
            title: 'Interface Language',
            description: 'Select interface display language',
            placeholder: 'Select Language',
            autoDescription: 'Auto follow VS Code language settings'
        },
        appInfo: {
            title: 'Application Info',
            name: 'acopilot',
            version: 'Version: {version}',
            repository: 'Repository',
            developer: 'Developer'
        }
    },
    toolSettings: {
        files: {
            applyDiff: {
                autoApply: 'Auto Apply Changes',
                enableAutoApply: 'Enable Auto Apply',
                enableAutoApplyDesc: 'When enabled, AI changes will be automatically saved after specified delay without manual confirmation',
                autoSaveDelay: 'Auto Save Delay',
                delayTime: 'Delay Time',
                delayTimeDesc: 'Wait this amount of time after showing changes before auto-saving',
                delay1s: '1 second',
                delay2s: '2 seconds',
                delay3s: '3 seconds',
                delay5s: '5 seconds',
                delay10s: '10 seconds',
                infoEnabled: 'Current setting: After AI modifies files, changes will be automatically saved after {delay} and continue execution.',
                infoDisabled: 'Current setting: After AI modifies files, you need to manually press Ctrl+S in the editor to confirm and save changes.'
            },
            listFiles: {
                ignoreList: 'Ignore List',
                ignoreListHint: '(Supports wildcards, e.g. *.log, temp*)',
                inputPlaceholder: 'Enter file or directory pattern to ignore...',
                deleteTooltip: 'Delete',
                addButton: 'Add'
            }
        },
        search: {
            findFiles: {
                excludeList: 'Exclude Patterns',
                excludeListHint: '(glob format, e.g. **/node_modules/**)',
                inputPlaceholder: 'Enter file or directory pattern to exclude...',
                deleteTooltip: 'Delete',
                addButton: 'Add'
            },
            searchInFiles: {
                excludeList: 'Exclude Patterns',
                excludeListHint: '(glob format, e.g. **/node_modules/**)',
                inputPlaceholder: 'Enter file or directory pattern to exclude...',
                deleteTooltip: 'Delete',
                addButton: 'Add'
            }
        },
        lsp: {
            locate: {
                title: 'Locate',
                hint: '(optional) Auto-trigger Locate mode for locate-style queries',
                useChatModelOption: 'Follow current chat model (no override)',
                modelLabel: 'Locate model',
                modelPlaceholder: 'Leave empty to use current chat model (e.g. gemini-2.5-flash)',
                autoTriggerLabel: 'Auto trigger',
                autoTriggerHint: 'Infer Locate mode when your message matches trigger keywords',
                triggerKeywordsLabel: 'Trigger keywords',
                triggerKeywordsHint: 'One per line; case-insensitive substring match',
                triggerKeywordsPlaceholder: 'e.g.\\nwhere is\\nopen file\\ndefinition\\nusages'
            }
        },
        terminal: {
            executeCommand: {
                shellEnv: 'Shell Environment',
                defaultBadge: 'Default',
                available: 'Available',
                unavailable: 'Unavailable',
                setDefaultTooltip: 'Set as default',
                executablePath: 'Executable Path (optional):',
                executablePathPlaceholder: 'Leave empty to use path from system PATH',
                execTimeout: 'Execution Timeout',
                timeoutHint: 'Commands exceeding this time will be automatically terminated',
                timeout30s: '30 seconds',
                timeout1m: '1 minute',
                timeout2m: '2 minutes',
                timeout5m: '5 minutes',
                timeout10m: '10 minutes',
                timeoutUnlimited: 'Unlimited',
                maxOutputLines: 'Max Output Lines',
                maxOutputLinesHint: 'Last N lines of terminal output sent to AI, to avoid excessive output',
                unlimitedLines: 'Unlimited',
                risk: {
                    title: 'Command Safety',
                    enabled: 'Enable command risk policy',
                    autoExecuteUpTo: {
                        label: 'Auto execute up to',
                        hint: 'Commands above this risk level will require confirmation even if Execute Command is set to auto execute',
                        low: 'Low risk only',
                        medium: 'Up to medium risk'
                    },
                    confirmOn: 'Always require confirmation for',
                    categories: {
                        destructive: 'Destructive actions (rm/del/redirect)',
                        gitHistory: 'Git destructive actions (reset/clean/push --force)',
                        privilege: 'Privilege escalation (sudo)',
                        network: 'Network download/install'
                    },
                    allowPatterns: 'Allowlist patterns (regex, one per line)',
                    allowPatternsHint: 'Commands matching allowlist bypass confirmation (case-insensitive regex)',
                    denyPatterns: 'Denylist patterns (regex, one per line)',
                    denyPatternsHint: 'Commands matching denylist are blocked (case-insensitive regex)'
                },
                tips: {
                    onlyEnabledUsed: '• Only enabled and available shells will be used by AI',
                    statusMeaning: '• ✓ means available, ✗ means unavailable',
                    windowsRecommend: '• Windows recommends using PowerShell (supports UTF-8)',
                    gitBashRequire: '• Git Bash requires Git for Windows to be installed',
                    wslRequire: '• WSL requires Windows Subsystem for Linux to be enabled',
                    confirmSettings: '• To configure execution confirmation, go to "Auto Execute" settings tab'
                }
            }
        },
        media: {
            common: {
                returnImageToAI: 'Return Image Directly to AI',
                returnImageDesc: 'When enabled, the processed image base64 will be returned directly to AI as tool response, allowing AI to view and analyze the image content.',
                returnImageDescDetail: 'When disabled, only text description (e.g. file path) will be returned, AI needs to call read_file tool to view the image.'
            },
            cropImage: {
                title: 'Crop Image',
                description: 'When enabled, AI can directly view the cropping effect to judge if the area is correct. Disable to save token consumption.'
            },
            generateImage: {
                title: 'Image Generation',
                description: 'When enabled, AI can directly see the generated image effect to judge if regeneration or adjustment is needed. Disable to save token consumption.'
            },
            removeBackground: {
                title: 'Remove Background',
                description: 'When enabled, AI can directly view the background removal effect to judge if subject description needs adjustment or reprocessing. Disable to save token consumption.'
            },
            resizeImage: {
                title: 'Resize Image',
                description: 'When enabled, AI can directly view the resizing effect to judge if the dimensions are appropriate. Disable to save token consumption.'
            },
            rotateImage: {
                title: 'Rotate Image',
                description: 'When enabled, AI can directly view the rotation effect to judge if the angle is correct. Disable to save token consumption.'
            }
        },
        common: {
            loading: 'Loading...',
            loadingConfig: 'Loading config...',
            saving: 'Saving...',
            error: 'Error',
            retry: 'Retry'
        }
    },
    toolsSettings: {
        mcpNote: 'MCP tools are provided by MCP servers and cannot be disabled here',
        mcpDisableTooltip: 'Provided by MCP server, cannot be disabled here',
        maxIterations: {
            label: 'Max Tool Calls Per Turn',
            hint: 'Prevents AI from infinite tool call loops, -1 for unlimited',
            unit: 'calls'
        },
        actions: {
            refresh: 'Refresh',
            enableAll: 'Enable All',
            disableAll: 'Disable All'
        },
        badges: {
            enabled: 'Enabled',
            autoExec: 'Auto'
        },
        columns: {
            enabled: 'Enabled',
            auto: 'Auto',
            config: 'Config'
        },
        exec: {
            autoEnabled: 'Enabled'
        },
        dangerConfirm: {
            title: 'Enable Auto Execute?',
            message: 'You are enabling auto execution for a dangerous tool: {tool}. This may cause irreversible changes. Continue?',
            confirm: 'Enable',
            cancel: 'Cancel'
        },
        enableAllDangerous: {
            title: 'Enable Auto Execute',
            message: 'Dangerous tools detected (delete_file / execute_command). Also enable auto execution for them?',
            confirm: 'Include dangerous tools',
            cancel: 'Skip dangerous tools'
        },
        loading: 'Loading tools list...',
        empty: 'No tools available',
        categories: {
            file: 'File Operations',
            search: 'Search',
            terminal: 'Terminal',
            lsp: 'Code Intelligence',
            media: 'Media Processing',
            mcp: 'MCP',
            other: 'Other'
        },
        dependency: {
            required: 'Dependencies Required',
            requiredTooltip: 'This tool requires dependencies to be installed',
            disabledTooltip: 'Tool is disabled or missing dependencies'
        },
        config: {
            tooltip: 'Configure Tool'
        }
    },
    tokenCountSettings: {
        description: 'Configure API for accurate token counting (used for settings/debug token stats). To avoid extra latency and rate-limit impact, chat sending and context trimming use local estimation by default.',
        hint: 'If not configured or the API call fails, it will automatically fall back to local estimation.',
        enableChannel: 'Enable token counting for this channel',
        baseUrl: 'API URL',
        apiKey: 'API Key',
        apiKeyPlaceholder: 'Enter API Key',
        model: 'Model Name',
        geminiUrlPlaceholder: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:countTokens?key={key}',
        geminiUrlHint: 'Use {model} and {key} as placeholders',
        geminiModelPlaceholder: 'gemini-2.5-pro',
        anthropicUrlPlaceholder: 'https://api.anthropic.com/v1/messages/count_tokens',
        anthropicModelPlaceholder: 'claude-sonnet-4-5',
        comingSoon: 'Coming Soon',
        customApi: 'Custom API',
        openaiDocTitle: 'OpenAI Compatible API Interface',
        openaiDocDesc: 'OpenAI does not provide a standalone token counting API. If you have a self-hosted or third-party compatible token counting service, you can configure it here.',
        openaiUrlPlaceholder: 'https://your-api.example.com/count-tokens',
        openaiUrlHint: 'Your custom token counting API endpoint',
        openaiModelPlaceholder: 'gpt-4o',
        apiDocumentation: 'API Specification',
        requestExample: 'Request Example',
        requestBody: '// Request Body',
        responseFormat: '// Response Format',
        openaiDocNote: 'Your API should return a JSON response with a total_tokens field. The request body uses OpenAI Messages format.',
        saveSuccess: 'Configuration saved',
        saveFailed: 'Save failed'
    },
    storageSettings: {
        title: 'Storage Path',
        description: 'Configure storage location for conversation history, checkpoints, etc.',
        currentPath: 'Current Storage Path',
        customPath: 'Custom Path',
        customPathPlaceholder: 'Enter custom storage path...',
        customPathHint: 'Leave empty to use default path (extension storage directory)',
        browse: 'Browse',
        apply: 'Apply',
        reset: 'Reset to Default',
        migrate: 'Migrate Data',
        migrateHint: 'Migrate existing data to new path',
        migrating: 'Migrating...',
        validating: 'Validating...',
        validation: {
            valid: 'Path is valid',
            invalid: 'Path is invalid',
            checking: 'Checking...'
        },
        dialog: {
            migrateTitle: 'Confirm Data Migration',
            migrateMessage: 'Do you want to migrate existing data to the new path? This will copy all conversation history and checkpoints.',
            migrateWarning: 'Do not close the window during migration',
            confirm: 'Confirm Migration',
            cancel: 'Cancel'
        },
        notifications: {
            pathUpdated: 'Storage path updated',
            pathReset: 'Storage path reset to default',
            migrationSuccess: 'Data migration completed, please reload window for changes to take effect',
            migrationFailed: 'Data migration failed: {error}',
            validationFailed: 'Path validation failed: {error}'
        },
        reloadWindow: 'Reload Window'
    }
};
