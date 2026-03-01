export const enComponentsSettingsPart2b = {
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
