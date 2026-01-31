export const enComponentsSettingsPart1 = {
    title: 'Settings',
    tabs: {
        channel: 'Channel',
        tools: 'Tools',
        autoExec: 'Auto Execute',
        mcp: 'MCP',
        checkpoint: 'Checkpoint',
        summarize: 'Summarize',
        imageGen: 'Image Generation',
        dependencies: 'Dependencies',
        context: 'Context',
        prompt: 'Prompt',
        tokenCount: 'Token Count',
        general: 'General'
    },
    channelSettings: {
        selector: {
            placeholder: 'Select Config',
            rename: 'Rename',
            add: 'New Config',
            delete: 'Delete Config',
            inputPlaceholder: 'Enter config name',
            confirm: 'Confirm',
            cancel: 'Cancel'
        },
        dialog: {
            new: {
                title: 'New Configuration',
                nameLabel: 'Config Name',
                namePlaceholder: 'e.g.: My Gemini',
                typeLabel: 'API Type',
                typePlaceholder: 'Select API type',
                cancel: 'Cancel',
                create: 'Create'
            },
            delete: {
                title: 'Delete Configuration',
                message: 'Are you sure you want to delete config "{name}"? This action cannot be undone.',
                atLeastOne: 'At least one config must be kept',
                cancel: 'Cancel',
                confirm: 'Confirm'
            }
        },
        form: {
            apiUrl: {
                label: 'API URL',
                placeholder: 'Enter API URL',
                placeholderResponses: 'Enter base API URL, e.g., https://api.openai.com/v1'
            },
            apiKey: {
                label: 'API Key',
                placeholder: 'Enter API Key',
                show: 'Show',
                hide: 'Hide',
                useAuthorization: 'Send as Authorization format',
                useAuthorizationHintGemini: 'Convert x-goog-api-key to Authorization: Bearer format',
                useAuthorizationHintAnthropic: 'Convert x-api-key to Authorization: Bearer format'
            },
            stream: {
                label: 'Stream Output'
            },
            channelType: {
                label: 'Channel Type',
                gemini: 'Gemini API',
                openai: 'OpenAI API',
                'openai-responses': 'OpenAI Responses API',
                anthropic: 'Anthropic API'
            },
            toolMode: {
                label: 'Tool Call Format',
                placeholder: 'Select tool call format',
                functionCall: {
                    label: 'Function Calling',
                    description: 'Use native function calling'
                },
                xml: {
                    label: 'XML Prompt',
                    description: 'Use XML format prompt'
                },
                json: {
                    label: 'JSON Boundary Markers',
                    description: 'Use JSON format + boundary markers (recommended)'
                },
                hint: {
                    functionCall: 'Function Calling: Use API native function calling feature',
                    xml: 'XML Prompt: Convert tools to XML format in system prompt',
                    json: 'JSON Boundary Markers: Use JSON format + <<<TOOL_CALL>>> boundary markers (recommended)'
                },
                openaiWarning: 'OpenAI Function Call mode does not support multimodal tools (such as read_file for reading images, generate_image, remove_background, crop_image, resize_image, rotate_image). To use multimodal features, please switch to XML or JSON mode.'
            },
            multimodal: {
                label: 'Enable Multimodal Tools',
                supportedTypes: 'Supported file types:',
                image: 'Image',
                imageFormats: 'PNG, JPEG, WebP',
                document: 'Document',
                documentFormats: 'PDF',
                capabilities: 'Multimodal Tool Capabilities:',
                table: {
                    channel: 'Channel / Mode',
                    readImage: 'Read Image',
                    readDocument: 'Read Document',
                    generateImage: 'Generate Image',
                    historyMultimodal: 'History Multimodal'
                },
                channels: {
                    geminiAll: 'Gemini (All)',
                    anthropicAll: 'Anthropic (All)',
                    openaiXmlJson: 'OpenAI (XML/JSON)',
                    openaiResponses: 'OpenAI (Responses)',
                    openaiFunction: 'OpenAI (Function Call)'
                },
                legend: {
                    supported: 'Supported',
                    notSupported: 'Not Supported'
                },
                notes: {
                    requireEnable: 'This option must be enabled to use multimodal tools like read_file for images/documents, generate_image, remove_background, crop_image, resize_image, rotate_image',
                    userAttachment: 'User-submitted attachments are not affected by this config and are always processed according to channel native capabilities',
                    geminiAnthropic: 'Gemini / Anthropic: Tools can directly return images and documents, support image generation',
                    openaiResponses: 'OpenAI Responses: Native support for images/PDFs, supports real-time thinking display',
                    openaiXmlJson: 'OpenAI XML/JSON: Supports reading images and generating images, does not support documents'
                }
            },
            timeout: {
                label: 'Timeout (ms)',
                placeholder: '30000'
            },
            maxContextTokens: {
                label: 'Max Context Tokens',
                placeholder: '128000',
                hint: 'Upper limit for displaying context usage'
            },
            contextManagement: {
                title: 'Context Management',
                enableTitle: 'Enable context threshold detection',
                threshold: {
                    label: 'Context Threshold',
                    placeholder: '80% or 100000',
                    hint: 'When total tokens exceed this threshold, automatically discard oldest conversation turns. Supports two formats: percentage (e.g. 80%) or absolute value (e.g. 100000)'
                },
                extraCut: {
                    label: 'Extra Cut',
                    placeholder: '0 or 10%',
                    hint: 'Extra tokens to cut when trimming. Actual reserve = threshold - extra cut. Supports percentage or absolute value, defaults to 0'
                },
                autoSummarize: {
                    label: 'Auto Summarize (Coming Soon)',
                    enableTitle: 'Enable auto summarize',
                    hint: 'When enabled, summarize old turns before discarding (feature in development)'
                }
            },
            toolOptions: {
                title: 'Tool Configuration'
            },
            advancedOptions: {
                title: 'Advanced Options'
            },
            customBody: {
                title: 'Custom Body',
                enableTitle: 'Enable custom body'
            },
            customHeaders: {
                title: 'Custom Headers',
                enableTitle: 'Enable custom headers'
            },
            autoRetry: {
                title: 'Auto Retry',
                enableTitle: 'Enable auto retry',
                retryCount: {
                    label: 'Retry Count',
                    hint: 'Maximum retry attempts when API returns error (1-10)'
                },
                retryInterval: {
                    label: 'Base Interval (ms)',
                    hint: 'Base wait time for retry, doubles after each failure (exponential backoff)'
                }
            },
            enabled: {
                label: 'Enable this configuration'
            },
            sections: {
                identityCredentials: 'Identity & Credentials',
                capabilities: 'Capabilities',
                advancedConfig: 'Advanced Configuration'
            },
            status: {
                defaultConfig: 'Default config',
                toolsConfigured: '{count} tools loaded',
                localEstimate: 'Local estimate',
                fieldsConfigured: '{count} fields defined',
                headersConfigured: '{count} Header(s)',
                maxRetries: 'Max {count} times',
                thresholdValue: 'threshold'
            },
            multimodalSummary: 'Images (PNG/JPG), PDF.',
            viewCompatibility: 'View compatibility matrix'
        }
    },
    tools: {
        title: 'Tools Settings',
        description: 'Manage and configure available tools',
        enableAll: 'Enable All',
        disableAll: 'Disable All',
        toolName: 'Tool Name',
        toolDescription: 'Tool Description',
        toolEnabled: 'Enabled'
    },
    autoExec: {
        title: 'Auto Execute',
        intro: {
            title: 'Tool Execution Confirmation',
            description: 'Configure whether user confirmation is required when AI calls tools. Checked means auto execute (no confirmation needed), unchecked means confirmation required before execution.'
        },
        actions: {
            refresh: 'Refresh',
            enableAll: 'Auto Execute All',
            disableAll: 'Confirm All'
        },
        status: {
            loading: 'Loading tools list...',
            empty: 'No tools available',
            autoExecute: 'Auto Execute',
            needConfirm: 'Need Confirm'
        },
        categories: {
            file: 'File Operations',
            search: 'Search',
            terminal: 'Terminal',
            lsp: 'Code Intelligence',
            media: 'Media Processing',
            mcp: 'MCP Tools',
            other: 'Other'
        },
        badges: {
            dangerous: 'Dangerous'
        },
        tips: {
            dangerousDefault: '• Tools marked as "Dangerous" require user confirmation by default before execution',
            deleteFileWarning: '• delete_file: File deletion is irreversible, recommend keeping confirmation enabled',
            executeCommandWarning: '• execute_command: Executing terminal commands may affect the system',
            mcpToolsDefault: '• MCP Tools: From connected MCP servers, auto execute by default',
            useWithCheckpoint: '• Recommend using with checkpoint feature to restore in case of mistakes'
        }
    },
    mcp: {
        title: 'MCP Settings',
        description: 'Configure Model Context Protocol servers',
        addServer: 'Add Server',
        serverName: 'Server Name',
        serverCommand: 'Command',
        serverArgs: 'Arguments',
        serverEnv: 'Environment Variables',
        serverStatus: 'Server Status',
        connecting: 'Connecting',
        connected: 'Connected',
        disconnected: 'Disconnected',
        error: 'Error'
    },
    checkpoint: {
        title: 'Checkpoint Settings',
        loading: 'Loading config...',
        sections: {
            enable: {
                label: 'Enable Checkpoint Feature',
                description: 'Automatically create codebase snapshots before and after tool execution, supporting one-click rollback'
            },
            messages: {
                title: 'Message Type Checkpoints',
                description: 'Choose whether to create checkpoints for user and model messages (independent of tool calls)',
                beforeLabel: 'Before Message',
                afterLabel: 'After Message',
                types: {
                    user: {
                        name: 'User Message',
                        description: 'Messages sent by user'
                    },
                    model: {
                        name: 'Model Message',
                        description: 'Messages replied by model (excluding tool calls)'
                    }
                },
                options: {
                    modelOuterLayerOnly: {
                        label: 'When tools are called continuously, only create model message checkpoints at outermost layer',
                        hint: 'When enabled, "before message" checkpoint is only created in first iteration, "after message" checkpoint is only created in last iteration (no tool calls). When disabled, checkpoints are created in every iteration.'
                    },
                    mergeUnchanged: {
                        label: 'Merge checkpoints when content is unchanged before and after messages',
                        hint: 'When enabled, if checkpoint content is the same before and after message, they will be merged and displayed as a single "unchanged" checkpoint. When disabled, before/after checkpoints will always be displayed separately.'
                    }
                }
            },
            tools: {
                title: 'Tool Backup Configuration',
                description: 'Select tools that need backups before and after execution',
                beforeLabel: 'Before Execution',
                afterLabel: 'After Execution',
                empty: 'No tools available'
            },
            other: {
                title: 'Other Configuration',
                maxCheckpoints: {
                    label: 'Maximum Checkpoints',
                    placeholder: '-1',
                    hint: 'Automatically clean up old checkpoints when exceeding this number, -1 means unlimited'
                }
            },
            cleanup: {
                title: 'Cleanup Checkpoints',
                description: 'Clean up checkpoints by conversation to free up storage',
                searchPlaceholder: 'Search conversation title...',
                loading: 'Loading...',
                noMatch: 'No matching conversations found',
                noCheckpoints: 'No checkpoints',
                refresh: 'Refresh List',
                checkpointCount: '{count} checkpoints',
                selectAll: 'Select all (filtered results)',
                selectedCount: 'Selected: {count}',
                deleteSelected: 'Delete selected',
                clearSelection: 'Clear selection',
                confirmDelete: {
                    title: 'Confirm Deletion',
                    message: 'Are you sure you want to delete all checkpoints?',
                    messageSingle: 'Are you sure you want to delete all checkpoints for "{title}"?',
                    messageSelected: 'Are you sure you want to delete checkpoints for {count} selected conversations?',
                    stats: 'Will delete {count} checkpoints, freeing {size} storage',
                    warning: 'This operation cannot be undone',
                    cancel: 'Cancel',
                    delete: 'Delete'
                },
                timeFormat: {
                    justNow: 'Just now',
                    minutesAgo: '{count} minutes ago',
                    hoursAgo: '{count} hours ago',
                    daysAgo: '{count} days ago'
                }
            }
        }
    },
    summarize: {
        title: 'Context Summarize',
        description: 'Compress conversation history to reduce token usage',
        enableSummarize: 'Enable Summarize',
        tokenThreshold: 'Token Threshold',
        summaryModel: 'Summary Model',
        summaryPrompt: 'Summary Prompt'
    },
    imageGen: {
        title: 'Image Generation',
        description: 'Configure AI image generation tool',
        enableImageGen: 'Enable Image Generation',
        provider: 'Provider',
        model: 'Model',
        outputPath: 'Output Path',
        maxImages: 'Max Images'
    },
    dependencies: {
        title: 'Extension Dependencies',
        description: 'Manage dependencies for optional features',
        installed: 'Installed',
        notInstalled: 'Not Installed',
        installing: 'Installing',
        installFailed: 'Install Failed',
        install: 'Install',
        uninstall: 'Uninstall',
        required: 'Required',
        optional: 'Optional'
    },
    context: {
        title: 'Context Awareness',
        description: 'Configure workspace context sent to AI',
        includeFileTree: 'Include File Tree',
        includeOpenFiles: 'Include Open Files',
        includeSelection: 'Include Selection',
        maxDepth: 'Max Depth',
        excludePatterns: 'Exclude Patterns',
        pinnedFiles: 'Pinned Files',
        addPinnedFile: 'Add Pinned File'
    },
    prompt: {
        title: 'System Prompt',
        description: 'Customize system prompt structure and content',
        systemPrompt: 'System Prompt',
        customPrompt: 'Custom Prompt',
        templateVariables: 'Template Variables',
        preview: 'Preview',
        sections: {
            environment: 'Environment',
            tools: 'Tools',
            context: 'Context',
            instructions: 'Instructions'
        }
    },
    general: {
        title: 'General Settings',
        description: 'Basic configuration options',
        proxy: {
            title: 'Network Proxy',
            description: 'Configure HTTP proxy for API requests',
            enable: 'Enable Proxy',
            url: 'Proxy URL',
            urlPlaceholder: 'http://127.0.0.1:7890',
            urlError: 'Please enter a valid proxy address (http:// or https://)'
        },
        language: {
            title: 'Interface Language',
            description: 'Choose interface display language',
            auto: 'Follow System',
            autoDescription: 'Automatically follow VS Code language setting'
        },
        appInfo: {
            title: 'Application Info',
            name: 'Acopilot - Vibe Coding Assistant',
            version: 'Version',
            repository: 'Repository',
            developer: 'Developer'
        }
    },
};
