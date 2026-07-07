export const enComponentsSettingsPart2a = {
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
            maxFiles: 'Max files',
            presets: {
                errorsOnly: 'Errors only',
                openFilesFirst: 'Open files first',
                workspace: 'Current workspace'
            }
        },
        ignorePatterns: {
            title: 'Ignore Patterns',
            description: 'Matching files/folders will not appear in context (supports wildcards)',
            removeTooltip: 'Remove',
            emptyHint: 'No custom ignore patterns',
            inputPlaceholder: 'Enter pattern, e.g.: **/node_modules, *.log',
            addButton: 'Add',
            matchedSummary: '{matched}/{scanned} files matched current ignore patterns',
            patternMatchCount: '{count} matches',
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
            openInspector: 'View current context',
            workspaceFilesLabel: 'Workspace file tree ({count} lines):',
            activeEditorLabel: 'Current Active Editor:',
            openTabsLabel: 'Open Tabs ({count}):',
            diagnosticsLabel: 'Diagnostics ({files} files, {count} items):',
            ignoreMatchesLabel: 'Ignored files ({count}):',
            noValue: 'None',
            moreItems: '... {count} more'
        },
        cost: {
            badge: '~{tokens} tok · {chars} ch'
        },
        saveSuccess: 'Saved successfully',
        saveFailed: 'Save failed'
    },
    dependencySettings: {
        title: 'Tool Dependencies',
        description: 'Manage dependencies required by tools. These dependencies will be installed to the local file system and not packaged into the plugin.',
        installPath: 'Install Path:',
        pathRelation: 'Dependency packages are installed under the effective General storage path, in its managed dependencies directory. If you migrate the storage path, this location follows the completed migration; it is not the storage root itself.',
        installed: 'Installed',
        installing: 'Installing...',
        uninstalling: 'Uninstalling...',
        install: 'Install',
        uninstall: 'Uninstall',
        copyFailureLog: 'Copy failure log',
        copyFailureLogSuccess: 'Failure log copied',
        copyFailureLogFailed: 'Failed to copy failure log',
        estimatedSize: 'About {size}MB',
        empty: 'No tools requiring dependencies',
        uninstallConfirm: {
            title: 'Uninstall dependency?',
            message: 'Uninstall {name}? This can make these tools unavailable: {tools}',
            confirm: 'Uninstall',
            cancel: 'Cancel',
            none: 'No known tools'
        },
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
            testConnection: 'Test Connection',
            testSuccess: '{provider} connection OK ({model})',
            testFailed: 'Connection test failed',
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
                together: 'Together AI does not support this parameter in the image generation endpoint.',
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
                together: 'Together AI does not support this parameter in the image generation endpoint.',
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
            label: 'Estimated Token Count',
            channelTooltip: 'Select channel for token calculation',
            refreshTooltip: 'Refresh token count',
            failed: 'Count failed',
            hint: 'Estimate only. Shows template tokens before variable expansion; the actual system prompt includes dynamically filled variable content.'
        },
        validation: {
            emptyTemplate: 'Template cannot be empty.',
            unknownVariables: 'Unknown variable(s): {variables}. Use variables from the reference list.',
            duplicateVariables: 'Duplicate variable(s): {variables}. They will duplicate context in the final prompt.',
            fixBeforeSave: 'Fix template validation errors before saving.'
        },
        history: {
            title: 'Prompt Version History',
            hint: 'Keeps the last 10 local versions before save/reset.',
            empty: 'No previous prompt versions yet.',
            restore: 'Restore',
            restored: 'Restored from history. Save to apply it.'
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
            title: 'Prompt Skills',
            add: 'Add Prompt Skill',
            description: 'Manage reusable Prompt Skills. They are saved here as a library and are not automatically injected into every conversation.',
            lifecycleNote: 'Pinned skill selection is separate: choose Prompt Skills from the pinned panel beside the input box to attach them to a specific conversation or workspace default.',
            empty: 'No Prompt Skills',
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
};
