export type ImageProvider = 'gemini' | 'together';

export const SUPPORTED_GENERATE_IMAGE_PROVIDERS: ImageProvider[] = ['gemini', 'together'];
export const SUPPORTED_GENERATE_IMAGE_ASPECT_RATIOS = [
    '1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'
] as const;
export const SUPPORTED_GENERATE_IMAGE_SIZES = ['1K', '2K', '4K'] as const;

const GEMINI_DEFAULT_URL = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_DEFAULT_MODEL = 'gemini-3-pro-image-preview';
const TOGETHER_DEFAULT_URL = 'https://api.together.xyz/v1';
const TOGETHER_DEFAULT_MODEL = 'google/flash-image-2.5';

export interface GenerateImageToolConfig {
    provider: ImageProvider;
    url: string;
    apiKey: string;
    model: string;
    enableAspectRatio: boolean;
    defaultAspectRatio?: string;
    enableImageSize: boolean;
    defaultImageSize?: string;
    maxBatchTasks: number;
    maxImagesPerTask: number;
    returnImageToAI: boolean;
    [key: string]: unknown;
}

export interface RemoveBackgroundToolConfig {
    returnImageToAI: boolean;
    [key: string]: unknown;
}

export interface CropImageToolConfig {
    returnImageToAI: boolean;
    [key: string]: unknown;
}

export interface ResizeImageToolConfig {
    returnImageToAI: boolean;
    [key: string]: unknown;
}

export interface RotateImageToolConfig {
    returnImageToAI: boolean;
    [key: string]: unknown;
}

export const DEFAULT_GENERATE_IMAGE_CONFIG: GenerateImageToolConfig = {
    provider: 'gemini',
    url: GEMINI_DEFAULT_URL,
    apiKey: '',
    model: GEMINI_DEFAULT_MODEL,
    enableAspectRatio: false,
    defaultAspectRatio: undefined,
    enableImageSize: false,
    defaultImageSize: undefined,
    maxBatchTasks: 5,
    maxImagesPerTask: 1,
    returnImageToAI: false
};

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(numeric)));
}

function normalizeOptionalEnum<T extends readonly string[]>(value: unknown, allowed: T): T[number] | undefined {
    return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? value as T[number] : undefined;
}

export function resolveGenerateImageProvider(config?: Partial<GenerateImageToolConfig>): ImageProvider {
    const explicitProvider = config?.provider;
    if (explicitProvider === 'gemini' || explicitProvider === 'together') return explicitProvider;

    const url = String(config?.url || '').toLowerCase();
    const model = String(config?.model || '').toLowerCase();
    if (url.includes('together') || url.includes('/images/generations') || model.includes('/')) return 'together';
    return 'gemini';
}

export function normalizeGenerateImageConfig(config?: Partial<GenerateImageToolConfig>): GenerateImageToolConfig {
    const raw = config || {};
    const provider = resolveGenerateImageProvider(raw);
    const base = provider === 'together'
        ? {
            ...DEFAULT_GENERATE_IMAGE_CONFIG,
            provider,
            url: TOGETHER_DEFAULT_URL,
            model: TOGETHER_DEFAULT_MODEL
        }
        : {
            ...DEFAULT_GENERATE_IMAGE_CONFIG,
            provider,
            url: GEMINI_DEFAULT_URL,
            model: GEMINI_DEFAULT_MODEL
        };

    const merged = {
        ...base,
        ...raw,
        provider
    };

    const url = String(merged.url || '').trim() || base.url;
    const apiKey = String(merged.apiKey || '').trim();
    const model = String(merged.model || '').trim() || base.model;
    const enableAspectRatio = provider === 'gemini' && merged.enableAspectRatio === true;
    const enableImageSize = provider === 'gemini' && merged.enableImageSize === true;

    return {
        ...merged,
        provider,
        url,
        apiKey,
        model,
        enableAspectRatio,
        defaultAspectRatio: enableAspectRatio
            ? normalizeOptionalEnum(merged.defaultAspectRatio, SUPPORTED_GENERATE_IMAGE_ASPECT_RATIOS)
            : undefined,
        enableImageSize,
        defaultImageSize: enableImageSize
            ? normalizeOptionalEnum(merged.defaultImageSize, SUPPORTED_GENERATE_IMAGE_SIZES)
            : undefined,
        maxBatchTasks: clampInteger(merged.maxBatchTasks, base.maxBatchTasks, 1, 20),
        maxImagesPerTask: clampInteger(merged.maxImagesPerTask, base.maxImagesPerTask, 1, 10),
        returnImageToAI: merged.returnImageToAI === true
    };
}

export const DEFAULT_REMOVE_BACKGROUND_CONFIG: RemoveBackgroundToolConfig = {
    returnImageToAI: false
};

export const DEFAULT_CROP_IMAGE_CONFIG: CropImageToolConfig = {
    returnImageToAI: false
};

export const DEFAULT_RESIZE_IMAGE_CONFIG: ResizeImageToolConfig = {
    returnImageToAI: false
};

export const DEFAULT_ROTATE_IMAGE_CONFIG: RotateImageToolConfig = {
    returnImageToAI: false
};

