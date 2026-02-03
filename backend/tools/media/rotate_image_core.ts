import * as path from 'path';
import * as vscode from 'vscode';
import type { MultimodalData } from '../types';
import { resolveUri, calculateAspectRatio } from '../utils';
import { getSharp } from '../../modules/dependencies';

export interface RotateTask {
    image_path: string;
    output_path: string;
    angle: number;
    format?: string;
}

interface TaskResult {
    index: number;
    success: boolean;
    error?: string;
    outputPath?: string;
    originalDimensions?: { width: number; height: number; aspectRatio: string };
    rotatedDimensions?: { width: number; height: number; aspectRatio: string };
    angle?: number;
    multimodal?: MultimodalData[];
    cancelled?: boolean;
}

async function readImageFile(imagePath: string): Promise<{ data: Buffer; mimeType: string; ext: string } | null> {
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
            mimeType,
            ext
        };
    } catch {
        return null;
    }
}

function getOutputFormat(
    outputPath: string,
    specifiedFormat?: string,
    originalExt?: string
): {
    ext: string;
    mimeType: string;
    background: { r: number; g: number; b: number; alpha: number };
} {
    let ext: string;
    if (specifiedFormat) {
        ext = specifiedFormat.toLowerCase();
        if (!ext.startsWith('.')) {
            ext = '.' + ext;
        }
    } else {
        ext = path.extname(outputPath).toLowerCase();
        if (!ext && originalExt) {
            ext = originalExt;
        }
    }

    if (ext === '.jpeg') ext = '.jpg';

    let mimeType: string;
    let background: { r: number; g: number; b: number; alpha: number };

    if (ext === '.jpg') {
        mimeType = 'image/jpeg';
        background = { r: 0, g: 0, b: 0, alpha: 1 };
    } else if (ext === '.webp') {
        mimeType = 'image/webp';
        background = { r: 0, g: 0, b: 0, alpha: 0 };
    } else {
        ext = '.png';
        mimeType = 'image/png';
        background = { r: 0, g: 0, b: 0, alpha: 0 };
    }

    return { ext, mimeType, background };
}

export async function executeRotateTask(
    task: RotateTask,
    index: number,
    abortSignal?: AbortSignal
): Promise<TaskResult> {
    const { image_path, output_path, angle, format } = task;

    if (!image_path) {
        return { index, success: false, error: `Task ${index + 1}: image_path is required` };
    }

    if (!output_path) {
        return { index, success: false, error: `Task ${index + 1}: output_path is required` };
    }

    if (angle === undefined || angle === null || isNaN(angle)) {
        return { index, success: false, error: `Task ${index + 1}: angle is required and must be a valid number` };
    }

    try {
        if (abortSignal?.aborted) {
            return {
                index,
                success: false,
                error: `Task ${index + 1}: User cancelled the rotate operation`,
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

        const outputFormat = getOutputFormat(output_path, format, imageFile.ext);

        if (abortSignal?.aborted) {
            return {
                index,
                success: false,
                error: `Task ${index + 1}: User cancelled the rotate operation`,
                cancelled: true
            };
        }

        const rotatedBuffer = await sharp(imageFile.data)
            .rotate(angle, {
                background: outputFormat.background
            })
            .toBuffer();

        const rotatedMetadata = await sharp(rotatedBuffer).metadata();
        const rotatedWidth = rotatedMetadata.width || originalWidth;
        const rotatedHeight = rotatedMetadata.height || originalHeight;

        let finalBuffer: Buffer;

        if (outputFormat.ext === '.jpg') {
            finalBuffer = await sharp(rotatedBuffer).jpeg({ quality: 90 }).toBuffer();
        } else if (outputFormat.ext === '.webp') {
            finalBuffer = await sharp(rotatedBuffer).webp({ quality: 90 }).toBuffer();
        } else {
            finalBuffer = await sharp(rotatedBuffer).png().toBuffer();
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
                mimeType: outputFormat.mimeType,
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
            rotatedDimensions: {
                width: rotatedWidth,
                height: rotatedHeight,
                aspectRatio: calculateAspectRatio(rotatedWidth, rotatedHeight)
            },
            angle,
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
            error: isCancelled ? `Task ${index + 1}: User cancelled the rotate operation` : `Task ${index + 1}: ${errorMessage}`,
            cancelled: isCancelled
        };
    }
}

