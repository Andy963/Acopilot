import type { MultimodalData } from '../types';

/**
 * Supported aspect ratios for Gemini Image API.
 */
export const SUPPORTED_ASPECT_RATIOS = [
    '1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'
] as const;

export type AspectRatio = typeof SUPPORTED_ASPECT_RATIOS[number];

/**
 * Supported image sizes for Gemini Image API.
 */
export const SUPPORTED_IMAGE_SIZES = ['1K', '2K', '4K'] as const;
export type ImageSize = typeof SUPPORTED_IMAGE_SIZES[number];

export interface ImageTask {
    prompt: string;
    reference_images?: string[];
    aspect_ratio?: AspectRatio;
    image_size?: ImageSize;
    output_path: string;
}

export interface GenerateImageConfig {
    provider?: ImageProvider;
    url?: string;
    apiKey?: string;
    model?: string;
    enableAspectRatio?: boolean;
    defaultAspectRatio?: string;
    enableImageSize?: boolean;
    defaultImageSize?: string;
    maxBatchTasks?: number;
    maxImagesPerTask?: number;
    proxyUrl?: string;
    abortSignal?: AbortSignal;
    returnImageToAI?: boolean;
}

export interface ToolParamsConfig {
    provider?: ImageProvider;
    enableAspectRatio: boolean;
    forcedAspectRatio?: string;
    enableImageSize: boolean;
    forcedImageSize?: string;
}

export interface TaskResult {
    index: number;
    success: boolean;
    error?: string;
    paths?: string[];
    count?: number;
    dimensions?: Array<{ width: number; height: number; aspectRatio: string }>;
    description?: string;
    multimodal?: MultimodalData[];
    cancelled?: boolean;
}

export interface ReferenceImage {
    data: string;
    mimeType: string;
}

export interface GeneratedImage {
    data: string;
    mimeType: string;
    dimensions?: { width: number; height: number };
}

export interface GeminiImageResponse {
    candidates?: Array<{
        content?: {
            parts?: Array<{
                text?: string;
                inlineData?: {
                    mimeType: string;
                    data: string;
                };
            }>;
        };
    }>;
    error?: {
        code: number;
        message: string;
    };
}

export interface TogetherImageResponse {
    data?: Array<{
        b64_json?: string;
        url?: string;
    }>;
    error?: {
        message?: string;
        type?: string;
        code?: unknown;
    };
}

export type ImageProvider = 'gemini' | 'together';

