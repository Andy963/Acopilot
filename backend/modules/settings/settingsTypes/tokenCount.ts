export interface TokenCountChannelConfig {
    enabled: boolean;
    baseUrl: string;
    apiKey: string;
    model: string;
}

export interface TokenCountConfig {
    gemini?: TokenCountChannelConfig;
    openai?: TokenCountChannelConfig;
    anthropic?: TokenCountChannelConfig;
    'openai-responses'?: TokenCountChannelConfig;
    [key: string]: unknown;
}

export const DEFAULT_GEMINI_TOKEN_COUNT_CONFIG: TokenCountChannelConfig = {
    enabled: false,
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:countTokens?key={key}',
    apiKey: '',
    model: 'gemini-2.5-pro'
};

export const DEFAULT_OPENAI_TOKEN_COUNT_CONFIG: TokenCountChannelConfig = {
    enabled: false,
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    apiKey: '',
    model: 'gpt-5'
};

export const DEFAULT_OPENAI_RESPONSES_TOKEN_COUNT_CONFIG: TokenCountChannelConfig = {
    enabled: false,
    baseUrl: 'https://api.openai.com/v1/responses/input_tokens',
    apiKey: '',
    model: 'gpt-5'
};

export const DEFAULT_ANTHROPIC_TOKEN_COUNT_CONFIG: TokenCountChannelConfig = {
    enabled: false,
    baseUrl: 'https://api.anthropic.com/v1/messages/count_tokens',
    apiKey: '',
    model: 'claude-sonnet-4-5'
};

export const DEFAULT_TOKEN_COUNT_CONFIG: TokenCountConfig = {
    gemini: DEFAULT_GEMINI_TOKEN_COUNT_CONFIG,
    openai: DEFAULT_OPENAI_TOKEN_COUNT_CONFIG,
    anthropic: DEFAULT_ANTHROPIC_TOKEN_COUNT_CONFIG,
    'openai-responses': DEFAULT_OPENAI_RESPONSES_TOKEN_COUNT_CONFIG
};

