import * as path from 'path';
import * as vscode from 'vscode';
import type { MultimodalData } from '../types';
import { resolveUri, calculateAspectRatio } from '../utils';
import { parseImageDimensions } from '../file/parseImageDimensions';
import { createProxyFetch } from '../../modules/channel/proxyFetch';
import { getSharp } from '../../modules/dependencies';

export interface RemoveBackgroundConfig {
    url?: string;
    apiKey?: string;
    model?: string;
    proxyUrl?: string;
    maxBatchTasks?: number;
    returnImageToAI?: boolean;
}

export interface RemoveTask {
    image_path: string;
    output_path: string;
    subject_description?: string;
    mask_path?: string;
}

interface TaskResult {
    index: number;
    success: boolean;
    error?: string;
    outputPath?: string;
    maskPath?: string;
    dimensions?: { width: number; height: number; aspectRatio: string } | null;
    multimodal?: MultimodalData[];
    cancelled?: boolean;
}

interface GeminiImageResponse {
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

async function readImageFile(imagePath: string): Promise<{ data: Buffer; mimeType: string } | null> {
    const uri = resolveUri(imagePath);
    if (!uri) {
        return null;
    }

    try {
        const content = await vscode.workspace.fs.readFile(uri);
        const ext = path.extname(imagePath).toLowerCase();
        let mimeType = 'image/png';
        if (ext === '.jpg' || ext === '.jpeg') {
            mimeType = 'image/jpeg';
        } else if (ext === '.webp') {
            mimeType = 'image/webp';
        }

        return {
            data: Buffer.from(content),
            mimeType
        };
    } catch {
        return null;
    }
}

async function getImageDimensions(
    buffer: Buffer,
    mimeType: string
): Promise<{ width: number; height: number; aspectRatio: string } | null> {
    const parsed = parseImageDimensions(buffer, mimeType);
    if (parsed) {
        return { width: parsed.width, height: parsed.height, aspectRatio: parsed.aspectRatio };
    }

    try {
        const sharp = await getSharp();
        if (!sharp) return null;
        const metadata = await sharp(buffer).metadata();
        if (!metadata.width || !metadata.height) return null;
        return {
            width: metadata.width,
            height: metadata.height,
            aspectRatio: calculateAspectRatio(metadata.width, metadata.height)
        };
    } catch {
        return null;
    }
}

function calculateAspectRatioForApi(width: number, height: number): string | undefined {
    const ratio = width / height;

    const supportedRatios: { [key: string]: number } = {
        '1:1': 1,
        '3:2': 1.5,
        '2:3': 0.667,
        '3:4': 0.75,
        '4:3': 1.333,
        '4:5': 0.8,
        '5:4': 1.25,
        '9:16': 0.5625,
        '16:9': 1.778,
        '21:9': 2.333
    };

    let closest = '1:1';
    let minDiff = Infinity;

    for (const [name, value] of Object.entries(supportedRatios)) {
        const diff = Math.abs(ratio - value);
        if (diff < minDiff) {
            minDiff = diff;
            closest = name;
        }
    }

    // If the closest ratio differs by more than 5%, omit the parameter and let the API decide.
    const closestValue = supportedRatios[closest];
    const diffPercent = Math.abs(ratio - closestValue) / closestValue;
    if (diffPercent > 0.05) {
        return undefined;
    }

    return closest;
}

async function generateMaskImage(
    originalImage: { data: string; mimeType: string },
    subjectDescription: string | undefined,
    aspectRatio: string | undefined,
    config: RemoveBackgroundConfig,
    abortSignal?: AbortSignal
): Promise<GeminiImageResponse> {
    const apiKey = config.apiKey;
    if (!apiKey) {
        throw new Error('API Key not configured.');
    }

    const model = config.model || 'gemini-3-pro-image-preview';
    const baseUrl = config.url || 'https://generativelanguage.googleapis.com/v1beta';
    const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;

    let maskPrompt = `Generate a binary mask image for background removal.

CRITICAL REQUIREMENTS:
- Main subject/foreground: Pure BLACK color (#000000)
- Background: Pure WHITE color (#FFFFFF)
- NO gradients, NO gray colors, NO anti-aliasing
- Sharp, clean edges between subject and background
- The mask should precisely outline the main subject
- Keep the original aspect ratio unchanged`;

    if (subjectDescription) {
        maskPrompt += `\n\nThe main subject to keep is: ${subjectDescription}`;
    }

    const parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [
        { text: maskPrompt },
        {
            inline_data: {
                mime_type: originalImage.mimeType,
                data: originalImage.data
            }
        }
    ];

    const imageConfig: { aspectRatio?: string } = {};
    if (aspectRatio) {
        imageConfig.aspectRatio = aspectRatio;
    }

    const requestBody = {
        contents: [{ parts }],
        generationConfig: {
            responseModalities: ['IMAGE'],
            ...(Object.keys(imageConfig).length > 0 ? { imageConfig } : {})
        }
    };

    if (abortSignal?.aborted) {
        throw new Error('Request cancelled');
    }

    const fetchFn = createProxyFetch(config.proxyUrl);

    const response = await fetchFn(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: abortSignal
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${errorText}`);
    }

    return (await response.json()) as GeminiImageResponse;
}

function extractMaskFromResponse(response: GeminiImageResponse): { data: string; mimeType: string } | null {
    if (response.candidates) {
        for (const candidate of response.candidates) {
            if (candidate.content?.parts) {
                for (const part of candidate.content.parts) {
                    if (part.inlineData) {
                        return {
                            data: part.inlineData.data,
                            mimeType: part.inlineData.mimeType
                        };
                    }
                }
            }
        }
    }
    return null;
}

export async function executeRemoveTask(
    task: RemoveTask,
    index: number,
    config: RemoveBackgroundConfig,
    abortSignal?: AbortSignal
): Promise<TaskResult> {
    const { image_path, output_path, subject_description, mask_path } = task;

    if (!image_path) {
        return { index, success: false, error: `Task ${index + 1}: image_path is required` };
    }

    if (!output_path) {
        return { index, success: false, error: `Task ${index + 1}: output_path is required` };
    }

    try {
        if (abortSignal?.aborted) {
            return {
                index,
                success: false,
                error: `Task ${index + 1}: User cancelled the background removal`,
                cancelled: true
            };
        }

        const imageFile = await readImageFile(image_path);
        if (!imageFile) {
            return { index, success: false, error: `Task ${index + 1}: Cannot read image: ${image_path}` };
        }

        const base64Data = imageFile.data.toString('base64');

        let dimensions: { width: number; height: number; aspectRatio: string } | null = null;
        let aspectRatioForApi: string | undefined;

        try {
            const rawDimensions = await getImageDimensions(imageFile.data, imageFile.mimeType);
            if (rawDimensions) {
                dimensions = rawDimensions;
                aspectRatioForApi = calculateAspectRatioForApi(rawDimensions.width, rawDimensions.height);
            }
        } catch {
            // Ignore dimension parsing failures.
        }

        if (abortSignal?.aborted) {
            return {
                index,
                success: false,
                error: `Task ${index + 1}: User cancelled the background removal`,
                cancelled: true
            };
        }

        const maskResponse = await generateMaskImage(
            { data: base64Data, mimeType: imageFile.mimeType },
            subject_description,
            aspectRatioForApi,
            config,
            abortSignal
        );

        if (maskResponse.error) {
            return { index, success: false, error: `Task ${index + 1}: API error - ${maskResponse.error.message}` };
        }

        const maskImage = extractMaskFromResponse(maskResponse);
        if (!maskImage) {
            return {
                index,
                success: false,
                error: `Task ${index + 1}: Failed to generate mask. Content may have been filtered.`
            };
        }

        if (mask_path) {
            const maskUri = resolveUri(mask_path);
            if (maskUri) {
                const maskDirUri = vscode.Uri.joinPath(maskUri, '..');
                try {
                    await vscode.workspace.fs.createDirectory(maskDirUri);
                } catch {
                    // Directory may already exist.
                }
                const maskBuffer = Buffer.from(maskImage.data, 'base64');
                await vscode.workspace.fs.writeFile(maskUri, maskBuffer);
            }
        }

        const multimodal: MultimodalData[] = [];

        const sharp = await getSharp();

        if (!sharp) {
            return {
                index,
                success: false,
                error: `Task ${index + 1}: sharp library not installed, please install in Settings -> Extension Dependencies`
            };
        }

        const maskBuffer = Buffer.from(maskImage.data, 'base64');
        const originalMeta = await sharp(imageFile.data).metadata();

        const resizedMask = await sharp(maskBuffer)
            .resize(originalMeta.width, originalMeta.height)
            .greyscale()
            .raw()
            .toBuffer();

        const originalRgba = await sharp(imageFile.data).ensureAlpha().raw().toBuffer();

        const width = originalMeta.width!;
        const height = originalMeta.height!;
        const resultData = Buffer.alloc(width * height * 4);

        for (let i = 0; i < width * height; i++) {
            const maskValue = resizedMask[i];
            const srcOffset = i * 4;
            const dstOffset = i * 4;

            resultData[dstOffset] = originalRgba[srcOffset];
            resultData[dstOffset + 1] = originalRgba[srcOffset + 1];
            resultData[dstOffset + 2] = originalRgba[srcOffset + 2];
            resultData[dstOffset + 3] = maskValue < 128 ? 255 : 0;
        }

        const resultBuffer = await sharp(resultData, {
            raw: { width, height, channels: 4 }
        })
            .png()
            .toBuffer();

        const outputUri = resolveUri(output_path);
        if (!outputUri) {
            return { index, success: false, error: `Task ${index + 1}: Cannot resolve output path` };
        }

        const dirUri = vscode.Uri.joinPath(outputUri, '..');
        try {
            await vscode.workspace.fs.createDirectory(dirUri);
        } catch {
            // Directory may already exist.
        }

        await vscode.workspace.fs.writeFile(outputUri, resultBuffer);

        multimodal.push({
            mimeType: 'image/png',
            data: resultBuffer.toString('base64'),
            name: path.basename(output_path)
        });

        if (mask_path) {
            multimodal.push({
                mimeType: maskImage.mimeType,
                data: maskImage.data,
                name: path.basename(mask_path)
            });
        }

        return {
            index,
            success: true,
            outputPath: output_path,
            maskPath: mask_path,
            dimensions,
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
            errorMessage.includes('Request cancelled');

        return {
            index,
            success: false,
            error: isCancelled ? `Task ${index + 1}: User cancelled the background removal` : `Task ${index + 1}: ${errorMessage}`,
            cancelled: isCancelled
        };
    }
}

