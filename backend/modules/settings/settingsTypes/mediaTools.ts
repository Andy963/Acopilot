export interface GenerateImageToolConfig {
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
    url: 'https://generativelanguage.googleapis.com/v1beta',
    apiKey: '',
    model: 'gemini-3-pro-image-preview',
    enableAspectRatio: false,
    defaultAspectRatio: undefined,
    enableImageSize: false,
    defaultImageSize: undefined,
    maxBatchTasks: 5,
    maxImagesPerTask: 1,
    returnImageToAI: false
};

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

