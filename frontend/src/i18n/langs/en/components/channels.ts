export const enComponentsChannels = {
    common: {
        temperature: {
            label: 'Temperature',
            hint: '0.0 - 1.0, default 1.0',
            toggleHint: 'When enabled, this parameter will be sent to API'
        },
        maxTokens: {
            label: 'Max Output Tokens',
            placeholder: '4096',
            toggleHint: 'When enabled, this parameter will be sent to API'
        },
        topP: {
            label: 'Top-P',
            hint: '0.0 - 1.0',
            toggleHint: 'When enabled, this parameter will be sent to API'
        },
        topK: {
            label: 'Top-K',
            toggleHint: 'When enabled, this parameter will be sent to API'
        },
        thinking: {
            title: 'Thinking Configuration',
            toggleHint: 'When enabled, thinking parameters will be sent to API'
        },
        currentThinking: {
            title: 'Current Round Config',
            sendSignatures: 'Send Current Signatures',
            sendSignaturesHint: 'Maintain reasoning context for current step',
            sendContent: 'Send Current Thoughts',
            sendContentHint: 'Send reasoning content of the current turn',
        },
        historyThinking: {
            title: 'History Rounds Config',
            sendSignatures: 'Send History Signatures',
            sendSignaturesHint: 'Maintain reasoning context across turns',
            sendContent: 'Send History Thoughts',
            sendContentHint: 'Let AI see thought processes of completed rounds',
            roundsLabel: 'History Thinking Rounds',
            roundsHint: 'How many non-latest rounds to send. -1 for all, 0 for none, positive N for last N rounds (e.g., 1 for only the second-to-last round)'
        }
    },
    anthropic: {
        thinking: {
            budgetLabel: 'Thinking Budget (Budget Tokens)',
            budgetPlaceholder: '10000',
            budgetHint: 'Maximum token count for thinking process, recommended 5000-50000'
        }
    },
    gemini: {
        thinking: {
            includeThoughts: 'Return Thought Content',
            includeThoughtsHint: 'When enabled, API response will include the model\'s thinking process',
            mode: 'Thinking Intensity Mode',
            modeHint: 'Default: Use API default | Level: Choose preset level | Budget: Custom token count',
            modeDefault: 'Default',
            modeLevel: 'Level',
            modeBudget: 'Budget',
            levelLabel: 'Thinking Level',
            levelHint: 'minimal: Minimal thinking | low: Less thinking | medium: Moderate | high: Deep thinking',
            levelMinimal: 'Minimal',
            levelLow: 'Low',
            levelMedium: 'Medium',
            levelHigh: 'High',
            budgetLabel: 'Thinking Budget (Token)',
            budgetPlaceholder: '1024',
            budgetHint: 'Custom token count allowed for thinking process'
        },
        historyThinking: {
            sendContentHint: 'When enabled, thought content (including summaries) from historical conversations will be sent, which may significantly increase context length'
        }
    },
    openai: {
        frequencyPenalty: {
            label: 'Frequency Penalty',
            hint: '-2.0 - 2.0',
            toggleHint: 'When enabled, this parameter will be sent to API'
        },
        presencePenalty: {
            label: 'Presence Penalty',
            hint: '-2.0 - 2.0',
            toggleHint: 'When enabled, this parameter will be sent to API'
        },
        thinking: {
            effortLabel: 'Thinking Effort',
            effortHint: 'none: Not used | minimal: Minimal | low: Less | medium: Moderate | high: More | xhigh: Maximum',
            effortNone: 'None',
            effortMinimal: 'Minimal',
            effortLow: 'Low',
            effortMedium: 'Medium',
            effortHigh: 'High',
            effortXHigh: 'Extra High',
            summaryLabel: 'Output Detail (Summary)',
            summaryHint: 'auto: Auto select | concise: Brief output | detailed: Detailed output',
            summaryAuto: 'Auto',
            summaryConcise: 'Concise',
            summaryDetailed: 'Detailed'
        },
        historyThinking: {
            sendSignaturesHint: 'When enabled, thought signatures from historical conversations will be sent (OpenAI not supported). Not recommended, and only signatures from non-latest turns are sent.',
            sendContentHint: 'When enabled, reasoning_content (including summaries) from historical conversations will be sent, which may significantly increase context length'
        }
    },
    'openai-responses': {
        maxOutputTokens: {
            label: 'Max Output Tokens',
            placeholder: '8192',
            hint: 'Maps to API max_output_tokens parameter'
        },
        thinking: {
            effortLabel: 'Thinking Effort',
            effortHint: 'none: Not used | minimal: Minimal | low: Less | medium: Moderate | high: More | xhigh: Maximum',
            effortNone: 'None (none)',
            effortMinimal: 'Minimal (minimal)',
            effortLow: 'Low (low)',
            effortMedium: 'Medium (medium)',
            effortHigh: 'High (high)',
            effortXHigh: 'Maximum (xhigh)',
            summaryLabel: 'Output Detail (Summary)',
            summaryHint: 'auto: Auto select | concise: Brief output | detailed: Detailed output',
            summaryAuto: 'Auto',
            summaryConcise: 'Concise',
            summaryDetailed: 'Detailed'
        },
        historyThinking: {
            sendSignaturesHint: 'Maintain reasoning context across turns',
            sendContentHint: 'When enabled, reasoning_content from historical conversations will be sent'
        }
    },
    customBody: {
        hint: 'Add custom request body fields, supports nested JSON override',
        modeSimple: 'Simple Mode',
        modeAdvanced: 'Advanced Mode',
        keyPlaceholder: 'Key name (e.g.: extra_body)',
        valuePlaceholder: 'Value (supports JSON, e.g.: {"key": "value"})',
        empty: 'No custom body items',
        addItem: 'Add Item',
        clearItems: 'Clear Items',
        insertExample: 'Insert Example',
        resetDefault: 'Reset Default',
        jsonError: 'JSON format error',
        jsonHint: 'Complete JSON format, supports nested override',
        jsonPlaceholder: '{\n  "extra_body": {\n    "google": {\n      "thinking_config": {\n        "include_thoughts": false\n      }\n    }\n  }\n}',
        enabled: 'Enabled',
        disabled: 'Disabled',
        deleteTooltip: 'Delete',
        validation: {
            invalidJson: 'Invalid JSON',
            rootMustBeObject: 'JSON root must be an object',
            emptyKey: 'Enabled key cannot be empty',
            emptyPathSegment: 'Dotted path cannot contain empty segments',
            duplicateKey: 'Duplicate key',
            location: '(line {line}, column {column})'
        }
    },
    customHeaders: {
        hint: 'Add custom HTTP request headers, sent to API in order',
        keyPlaceholder: 'Header-Name',
        valuePlaceholder: 'Header Value',
        keyDuplicate: 'Duplicate key name',
        empty: 'No custom headers',
        addHeader: 'Add Header',
        clearHeaders: 'Clear Headers',
        enabled: 'Enabled',
        disabled: 'Disabled',
        deleteTooltip: 'Delete',
        validation: {
            emptyKey: 'Enabled header name cannot be empty',
            invalidHeaderName: 'Invalid HTTP header name',
            duplicateKey: 'Duplicate header name'
        }
    },
    toolOptions: {
        cropImage: {
            title: 'Crop Image (crop_image)',
            useNormalizedCoords: 'Use Normalized Coordinates (0-1000)',
            enabledTitle: 'When Enabled',
            enabledNote: 'Suitable for models using normalized coordinates like Gemini',
            disabledTitle: 'When Disabled',
            disabledNote: 'Model needs to calculate actual pixel coordinates',
            coordTopLeft: '= Top-left corner',
            coordBottomRight: '= Bottom-right corner',
            coordCenter: '= Center point'
        }
    },
    tokenCountMethod: {
        title: 'Token Count Method',
        label: 'Count Method',
        placeholder: 'Select count method',
        hint: 'Select the method for calculating token count, affects context trimming accuracy',
        options: {
            channelDefault: 'Use Channel Default',
            gemini: 'Gemini API',
            openaiCustom: 'Custom OpenAI Format',
            openaiCustomDesc: 'Use custom API endpoint',
            openaiResponses: 'OpenAI Responses API',
            anthropic: 'Anthropic API',
            local: 'Local Estimation',
            localDesc: '~4 chars = 1 token'
        },
        defaultDesc: {
            gemini: 'Default uses Gemini countTokens API',
            anthropic: 'Default uses Anthropic count_tokens API',
            openai: 'Default uses local estimation (OpenAI has no official API)'
        },
        apiConfig: {
            title: 'API Configuration',
            url: 'API URL',
            urlHint: 'Leave empty to use channel URL',
            apiKey: 'API Key',
            apiKeyPlaceholder: 'Enter API Key',
            apiKeyHint: 'Leave empty to use channel API Key',
            model: 'Model',
            modelHint: 'Model name for token counting'
        }
    }
};
