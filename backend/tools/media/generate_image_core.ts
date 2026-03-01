import * as path from 'path';
import type { MultimodalData } from '../types';
import { calculateAspectRatio } from '../utils';
import {
    SUPPORTED_ASPECT_RATIOS,
    SUPPORTED_IMAGE_SIZES,
    type AspectRatio,
    type GenerateImageConfig,
    type GeneratedImage,
    type ImageSize,
    type ImageTask,
    type ReferenceImage,
    type TaskResult
} from './generateImageTypes';
import {
    callGeminiImageApi,
    callTogetherImagesApi,
    detectImageProvider,
    extractFromResponse,
    extractFromTogetherResponse,
    getExtensionFromMimeType,
    readReferenceImage,
    saveImage
} from './generateImageHelpers';

export async function executeImageTask(
    task: ImageTask,
    index: number,
    config: GenerateImageConfig,
    maxImagesPerTask: number,
    abortSignal?: AbortSignal
): Promise<TaskResult> {
    const { prompt, reference_images, aspect_ratio, image_size, output_path } = task;

    if (!prompt) {
        return { index, success: false, error: 'Task ' + (index + 1) + ': prompt is required' };
    }

    if (!output_path) {
        return { index, success: false, error: 'Task ' + (index + 1) + ': output_path is required' };
    }

    if (aspect_ratio && !SUPPORTED_ASPECT_RATIOS.includes(aspect_ratio as AspectRatio)) {
        return {
            index,
            success: false,
            error: `Task ${index + 1}: Invalid aspect_ratio. Supported: ${SUPPORTED_ASPECT_RATIOS.join(', ')}`
        };
    }

    if (image_size && !SUPPORTED_IMAGE_SIZES.includes(image_size as ImageSize)) {
        return {
            index,
            success: false,
            error: `Task ${index + 1}: Invalid image_size. Supported: ${SUPPORTED_IMAGE_SIZES.join(', ')}`
        };
    }

    if (reference_images && reference_images.length > 14) {
        return {
            index,
            success: false,
            error: `Task ${index + 1}: Maximum 14 reference images allowed`
        };
    }

    try {
        if (abortSignal?.aborted) {
            return { index, success: false, error: `Task ${index + 1}: User cancelled image generation`, cancelled: true };
        }

        const provider = detectImageProvider(config);

        if (provider === 'together' && reference_images && reference_images.length > 0) {
            return {
                index,
                success: false,
                error: `Task ${index + 1}: Together Images API does not support reference_images yet. Please omit reference_images or switch to Gemini.`
            };
        }

        const referenceImages: ReferenceImage[] = [];
        if (provider === 'gemini' && reference_images && reference_images.length > 0) {
            for (const imgPath of reference_images) {
                if (abortSignal?.aborted) {
                    return { index, success: false, error: `Task ${index + 1}: User cancelled image generation`, cancelled: true };
                }
                const img = await readReferenceImage(imgPath);
                if (!img) {
                    return {
                        index,
                        success: false,
                        error: `Task ${index + 1}: Cannot read reference image: ${imgPath}`
                    };
                }
                referenceImages.push(img);
            }
        }

        let finalAspectRatio: string | undefined;
        if (config.enableAspectRatio) {
            finalAspectRatio = config.defaultAspectRatio || aspect_ratio;
        }

        let finalImageSize: string | undefined;
        if (config.enableImageSize) {
            finalImageSize = config.defaultImageSize || image_size;
        }

        let images: GeneratedImage[] = [];
        let texts: string[] = [];

        if (provider === 'together') {
            if (referenceImages.length > 0) {
                return {
                    index,
                    success: false,
                    error: `Task ${index + 1}: reference_images is not supported for Together image generation. Please omit reference_images or use Gemini.`
                };
            }

            // aspect_ratio / image_size are Gemini-specific; accept them but do not forward.
            if (finalAspectRatio || finalImageSize) {
                texts.push('Note: aspect_ratio/image_size are not forwarded for Together image generation.');
            }

            const response = await callTogetherImagesApi(prompt, config, abortSignal);
            if (response.error?.message) {
                return {
                    index,
                    success: false,
                    error: `Task ${index + 1}: API error - ${response.error.message}`
                };
            }

            ({ images, texts } = extractFromTogetherResponse(response));
        } else {
            const response = await callGeminiImageApi(
                prompt,
                referenceImages,
                finalAspectRatio,
                finalImageSize,
                config,
                abortSignal
            );

            if (response.error) {
                return {
                    index,
                    success: false,
                    error: `Task ${index + 1}: API error - ${response.error.message}`
                };
            }

            ({ images, texts } = extractFromResponse(response));
        }

        if (images.length === 0) {
            return {
                index,
                success: false,
                error: `Task ${index + 1}: No images generated. Content may have been filtered or an error occurred.`
            };
        }

        const savedPaths: string[] = [];
        const multimodal: MultimodalData[] = [];
        const allDimensions: Array<{ width: number; height: number; aspectRatio: string }> = [];
        const limitedImages = images.slice(0, maxImagesPerTask);

        for (let i = 0; i < limitedImages.length; i++) {
            const img = limitedImages[i];
            const ext = getExtensionFromMimeType(img.mimeType);

            let finalOutputPath: string;
            if (i === 0) {
                finalOutputPath = output_path;
            } else {
                const baseName = output_path.replace(/\\.[^.]+$/, '');
                finalOutputPath = `${baseName}_${i}${ext}`;
            }

            await saveImage(img.data, finalOutputPath);
            savedPaths.push(finalOutputPath);

            if (img.dimensions) {
                allDimensions.push({
                    width: img.dimensions.width,
                    height: img.dimensions.height,
                    aspectRatio: calculateAspectRatio(img.dimensions.width, img.dimensions.height)
                });
            }

            multimodal.push({
                mimeType: img.mimeType,
                data: img.data,
                name: path.basename(finalOutputPath)
            });
        }

        const textDescription = texts.length > 0 ? texts.join('\n') : `Task ${index + 1}: Successfully generated ${images.length} images`;

        return {
            index,
            success: true,
            paths: savedPaths,
            count: images.length,
            dimensions: allDimensions.length > 0 ? allDimensions : undefined,
            description: textDescription,
            multimodal
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorName = error instanceof Error ? error.name : '';

        const isCancelled =
            abortSignal?.aborted ||
            errorName === 'AbortError' ||
            errorMessage.includes('aborted') ||
            errorMessage.includes('cancelled') ||
            errorMessage.includes('canceled') ||
            errorMessage.includes('Request cancelled') ||
            errorMessage.includes('The operation was aborted') ||
            errorMessage.includes('signal is aborted') ||
            errorMessage.includes('fetch failed');

        return {
            index,
            success: false,
            error: isCancelled ? `Task ${index + 1}: User cancelled image generation` : `Task ${index + 1}: ${errorMessage}`,
            cancelled: isCancelled
        };
    }
}

