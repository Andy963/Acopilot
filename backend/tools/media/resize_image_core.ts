import * as path from 'path';
import * as vscode from 'vscode';
import type { MultimodalData } from '../types';
import { resolveUri, calculateAspectRatio } from '../utils';
import { getSharp } from '../../modules/dependencies';

/**
 * Single resize task.
 */
export interface ResizeTask {
    /** Source image path */
    image_path: string;
    /** Output file path */
    output_path: string;
    /** Target width (px) */
    width: number;
    /** Target height (px) */
    height: number;
}

interface TaskResult {
    index: number;
    success: boolean;
    error?: string;
    outputPath?: string;
    originalDimensions?: { width: number; height: number; aspectRatio: string };
    resizedDimensions?: { width: number; height: number; aspectRatio: string };
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

export async function executeResizeTask(
    task: ResizeTask,
    index: number,
    abortSignal?: AbortSignal
): Promise<TaskResult> {
    const { image_path, output_path, width, height } = task;

    if (!image_path) {
        return { index, success: false, error: `Task ${index + 1}: image_path is required` };
    }

    if (!output_path) {
        return { index, success: false, error: `Task ${index + 1}: output_path is required` };
    }

    if (!width || width <= 0) {
        return { index, success: false, error: `Task ${index + 1}: width must be a positive integer` };
    }

    if (!height || height <= 0) {
        return { index, success: false, error: `Task ${index + 1}: height must be a positive integer` };
    }

    const MAX_DIMENSION = 16384; // 16K
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        return {
            index,
            success: false,
            error: `Task ${index + 1}: Target dimensions cannot exceed ${MAX_DIMENSION}x${MAX_DIMENSION}`
        };
    }

    try {
        if (abortSignal?.aborted) {
            return {
                index,
                success: false,
                error: `Task ${index + 1}: User cancelled the resize operation`,
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

        if (abortSignal?.aborted) {
            return {
                index,
                success: false,
                error: `Task ${index + 1}: User cancelled the resize operation`,
                cancelled: true
            };
        }

        const resizedBuffer = await sharp(imageFile.data)
            .resize(width, height, {
                fit: 'fill',
                kernel: 'lanczos3'
            })
            .toBuffer();

        const outputExt = path.extname(output_path).toLowerCase();
        let finalBuffer: Buffer;
        let outputMimeType = 'image/png';

        if (outputExt === '.jpg' || outputExt === '.jpeg') {
            finalBuffer = await sharp(resizedBuffer).jpeg({ quality: 90 }).toBuffer();
            outputMimeType = 'image/jpeg';
        } else if (outputExt === '.webp') {
            finalBuffer = await sharp(resizedBuffer).webp({ quality: 90 }).toBuffer();
            outputMimeType = 'image/webp';
        } else {
            finalBuffer = await sharp(resizedBuffer).png().toBuffer();
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
            resizedDimensions: {
                width,
                height,
                aspectRatio: calculateAspectRatio(width, height)
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
            error: isCancelled ? `Task ${index + 1}: User cancelled the resize operation` : `Task ${index + 1}: ${errorMessage}`,
            cancelled: isCancelled
        };
    }
}

