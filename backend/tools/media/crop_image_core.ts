import * as path from 'path';
import * as vscode from 'vscode';
import type { CropImageToolOptions, MultimodalData } from '../types';
import { resolveUri, calculateAspectRatio } from '../utils';
import { getSharp } from '../../modules/dependencies';

const NORMALIZED_MAX = 1000;

function normalizeCoord(normalized: number, actualSize: number): number {
    const clamped = Math.max(0, Math.min(NORMALIZED_MAX, normalized));
    return Math.round((clamped / NORMALIZED_MAX) * actualSize);
}

export interface CropTask {
    image_path: string;
    output_path: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

interface TaskResult {
    index: number;
    success: boolean;
    error?: string;
    outputPath?: string;
    originalDimensions?: { width: number; height: number; aspectRatio: string };
    croppedDimensions?: { width: number; height: number; aspectRatio: string };
    multimodal?: MultimodalData[];
    cancelled?: boolean;
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
        } else if (ext === '.gif') {
            mimeType = 'image/gif';
        }

        return {
            data: Buffer.from(content),
            mimeType
        };
    } catch {
        return null;
    }
}

export async function executeCropTask(
    task: CropTask,
    index: number,
    abortSignal?: AbortSignal,
    options?: CropImageToolOptions
): Promise<TaskResult> {
    const { image_path, output_path, x1, y1, x2, y2 } = task;
    const useNormalized = options?.useNormalizedCoordinates ?? true;

    if (!image_path) {
        return { index, success: false, error: `Task ${index + 1}: image_path is required` };
    }

    if (!output_path) {
        return { index, success: false, error: `Task ${index + 1}: output_path is required` };
    }

    if (useNormalized) {
        if (x1 < 0 || x1 > NORMALIZED_MAX || y1 < 0 || y1 > NORMALIZED_MAX || x2 < 0 || x2 > NORMALIZED_MAX || y2 < 0 || y2 > NORMALIZED_MAX) {
            return { index, success: false, error: `Task ${index + 1}: Coordinates must be in range 0-${NORMALIZED_MAX}` };
        }
    } else {
        if (x1 < 0 || y1 < 0 || x2 < 0 || y2 < 0) {
            return { index, success: false, error: `Task ${index + 1}: Coordinates must be non-negative` };
        }
    }

    if (x1 >= x2 || y1 >= y2) {
        return { index, success: false, error: `Task ${index + 1}: x1 must be less than x2, y1 must be less than y2` };
    }

    try {
        if (abortSignal?.aborted) {
            return {
                index,
                success: false,
                error: `Task ${index + 1}: User cancelled the crop operation`,
                cancelled: true
            };
        }

        const sharp = await getSharp();

        if (!sharp) {
            return {
                index,
                success: false,
                error: `Task ${index + 1}: sharp library not installed, please install in Settings -> Extension Dependencies`
            };
        }

        const imageFile = await readImageFile(image_path);
        if (!imageFile) {
            return { index, success: false, error: `Task ${index + 1}: Cannot read image: ${image_path}` };
        }

        const metadata = await sharp(imageFile.data).metadata();
        if (!metadata.width || !metadata.height) {
            return { index, success: false, error: `Task ${index + 1}: Cannot get image dimensions` };
        }

        const originalWidth = metadata.width;
        const originalHeight = metadata.height;

        let left: number, top: number, right: number, bottom: number;

        if (useNormalized) {
            left = normalizeCoord(x1, originalWidth);
            top = normalizeCoord(y1, originalHeight);
            right = normalizeCoord(x2, originalWidth);
            bottom = normalizeCoord(y2, originalHeight);
        } else {
            left = Math.round(x1);
            top = Math.round(y1);
            right = Math.round(x2);
            bottom = Math.round(y2);
        }

        left = Math.max(0, Math.min(originalWidth - 1, left));
        top = Math.max(0, Math.min(originalHeight - 1, top));
        right = Math.max(left + 1, Math.min(originalWidth, right));
        bottom = Math.max(top + 1, Math.min(originalHeight, bottom));

        const cropWidth = right - left;
        const cropHeight = bottom - top;

        if (cropWidth <= 0 || cropHeight <= 0) {
            return { index, success: false, error: `Task ${index + 1}: Invalid crop dimensions after conversion` };
        }

        if (abortSignal?.aborted) {
            return {
                index,
                success: false,
                error: `Task ${index + 1}: User cancelled the crop operation`,
                cancelled: true
            };
        }

        const croppedBuffer = await sharp(imageFile.data)
            .extract({ left, top, width: cropWidth, height: cropHeight })
            .toBuffer();

        const outputExt = path.extname(output_path).toLowerCase();
        let finalBuffer: Buffer;
        let outputMimeType = 'image/png';

        if (outputExt === '.jpg' || outputExt === '.jpeg') {
            finalBuffer = await sharp(croppedBuffer).jpeg({ quality: 90 }).toBuffer();
            outputMimeType = 'image/jpeg';
        } else if (outputExt === '.webp') {
            finalBuffer = await sharp(croppedBuffer).webp({ quality: 90 }).toBuffer();
            outputMimeType = 'image/webp';
        } else {
            finalBuffer = await sharp(croppedBuffer).png().toBuffer();
            outputMimeType = 'image/png';
        }

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

        await vscode.workspace.fs.writeFile(outputUri, finalBuffer);

        const multimodal: MultimodalData[] = [
            {
                mimeType: outputMimeType,
                data: finalBuffer.toString('base64'),
                name: path.basename(output_path)
            }
        ];

        return {
            index,
            success: true,
            outputPath: output_path,
            originalDimensions: {
                width: originalWidth,
                height: originalHeight,
                aspectRatio: calculateAspectRatio(originalWidth, originalHeight)
            },
            croppedDimensions: {
                width: cropWidth,
                height: cropHeight,
                aspectRatio: calculateAspectRatio(cropWidth, cropHeight)
            },
            multimodal
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorName = error instanceof Error ? error.name : '';

        const isCancelled =
            abortSignal?.aborted ||
            errorName === 'AbortError' ||
            errorMessage.includes('aborted') ||
            errorMessage.includes('cancelled');

        return {
            index,
            success: false,
            error: isCancelled ? `Task ${index + 1}: User cancelled the crop operation` : `Task ${index + 1}: ${errorMessage}`,
            cancelled: isCancelled
        };
    }
}

