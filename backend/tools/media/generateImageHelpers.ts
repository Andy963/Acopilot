import * as vscode from 'vscode';
import * as path from 'path';

import { resolveUri } from '../utils';
import { createProxyFetch } from '../../modules/channel/proxyFetch';
import { redactSensitiveText } from '../../core/redaction';
import { normalizeGenerateImageConfig, resolveGenerateImageProvider } from '../../modules/settings/types';

import type {
    GenerateImageConfig,
    GeminiImageResponse,
    TogetherImageResponse,
    ImageProvider,
    ReferenceImage,
    GeneratedImage
} from './generateImageTypes';

export function detectImageProvider(config: GenerateImageConfig): ImageProvider {
    return resolveGenerateImageProvider(config as any);
}

function redactImageConfigError(text: string, config: GenerateImageConfig): string {
    let redacted = redactSensitiveText(text);
    if (config.apiKey) {
        redacted = redacted.split(config.apiKey).join('***REDACTED***');
    }
    return redacted;
}

function getTogetherImagesEndpoint(configUrl?: string): string {
    const defaultBase = 'https://api.together.xyz/v1';
    const raw = (configUrl && configUrl.trim()) ? configUrl.trim() : '';

    const normalized = (raw || defaultBase).replace(/\/+$/, '');

    if (normalized.includes('generativelanguage.googleapis.com')) {
        return `${defaultBase}/images/generations`;
    }
    if (normalized.endsWith('/images/generations')) {
        return normalized;
    }
    return `${normalized}/images/generations`;
}

function getTogetherBaseEndpoint(configUrl?: string): string {
    const defaultBase = 'https://api.together.xyz/v1';
    const raw = (configUrl && configUrl.trim()) ? configUrl.trim() : '';
    const normalized = (raw || defaultBase).replace(/\/+$/, '');

    if (normalized.includes('generativelanguage.googleapis.com')) {
        return defaultBase;
    }
    if (normalized.endsWith('/images/generations')) {
        return normalized.replace(/\/images\/generations$/, '');
    }
    return normalized;
}

export interface GenerateImageConnectionTestResult {
    success: boolean;
    provider: ImageProvider;
    model: string;
    error?: string;
}

export async function testGenerateImageConnection(
    config: GenerateImageConfig,
    fetchOverride?: typeof fetch
): Promise<GenerateImageConnectionTestResult> {
    const normalized = normalizeGenerateImageConfig(config as any);
    const provider = detectImageProvider(normalized);
    const model = normalized.model || '';

    if (!normalized.url) {
        return { success: false, provider, model, error: 'API URL is required.' };
    }
    if (!normalized.apiKey) {
        return { success: false, provider, model, error: 'API Key is required.' };
    }
    if (!model) {
        return { success: false, provider, model, error: 'Model name is required.' };
    }

    try {
        const proxyUrl = typeof (normalized as any).proxyUrl === 'string' ? (normalized as any).proxyUrl : undefined;
        const fetchFn = fetchOverride || createProxyFetch(proxyUrl);
        const url = provider === 'together'
            ? `${getTogetherBaseEndpoint(normalized.url)}/models`
            : `${normalized.url.replace(/\/+$/, '')}/models/${encodeURIComponent(model)}?key=${encodeURIComponent(normalized.apiKey)}`;

        const response = await fetchFn(url, {
            method: 'GET',
            headers: provider === 'together'
                ? { 'Authorization': `Bearer ${normalized.apiKey}` }
                : undefined
        });

        if (!response.ok) {
            const errorText = await response.text();
            return {
                success: false,
                provider,
                model,
                error: redactImageConfigError(`Connection test failed: ${response.status} ${errorText}`, normalized)
            };
        }

        return { success: true, provider, model };
    } catch (error) {
        return {
            success: false,
            provider,
            model,
            error: redactImageConfigError(error instanceof Error ? error.message : String(error), normalized)
        };
    }
}

export async function readReferenceImage(imgPath: string): Promise<ReferenceImage | null> {
    const uri = resolveUri(imgPath);
    if (!uri) {
        return null;
    }

    try {
        const content = await vscode.workspace.fs.readFile(uri);
        const ext = path.extname(imgPath).toLowerCase();
        let mimeType = 'image/png';
        if (ext === '.jpg' || ext === '.jpeg') {
            mimeType = 'image/jpeg';
        } else if (ext === '.webp') {
            mimeType = 'image/webp';
        }

        return {
            data: Buffer.from(content).toString('base64'),
            mimeType
        };
    } catch {
        return null;
    }
}

export async function callGeminiImageApi(
    prompt: string,
    referenceImages: ReferenceImage[],
    aspectRatio: string | undefined,
    imageSize: string | undefined,
    config: GenerateImageConfig,
    abortSignal?: AbortSignal
): Promise<GeminiImageResponse> {
    const apiKey = config.apiKey;
    if (!apiKey) {
        throw new Error('API Key not configured. Please configure generate_image tool in settings.');
    }

    const model = config.model || 'gemini-3-pro-image-preview';
    const baseUrl = config.url || 'https://generativelanguage.googleapis.com/v1beta';
    const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;

    const parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [];
    parts.push({ text: prompt });

    if (referenceImages && referenceImages.length > 0) {
        for (const img of referenceImages) {
            parts.push({
                inline_data: {
                    mime_type: img.mimeType,
                    data: img.data
                }
            });
        }
    }

    const requestBody: Record<string, unknown> = {
        contents: [{
            parts
        }],
        generationConfig: {
            responseModalities: ['TEXT', 'IMAGE']
        }
    };

    if (aspectRatio || imageSize) {
        const imageConfig: Record<string, string> = {};
        if (aspectRatio) {
            imageConfig.aspectRatio = aspectRatio;
        }
        if (imageSize) {
            imageConfig.imageSize = imageSize;
        }
        if (Object.keys(imageConfig).length > 0) {
            (requestBody.generationConfig as Record<string, unknown>).imageConfig = imageConfig;
        }
    }

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

    return await response.json() as GeminiImageResponse;
}

export async function callTogetherImagesApi(
    prompt: string,
    config: GenerateImageConfig,
    abortSignal?: AbortSignal
): Promise<TogetherImageResponse> {
    const apiKey = config.apiKey;
    if (!apiKey) {
        throw new Error('API Key not configured. Please configure generate_image tool in settings.');
    }

    const model = config.model || 'google/flash-image-2.5';
    const url = getTogetherImagesEndpoint(config.url);

    if (abortSignal?.aborted) {
        throw new Error('Request cancelled');
    }

    const fetchFn = createProxyFetch(config.proxyUrl);

    const requestHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    };

    const requestBodyWithFormat = {
        model,
        prompt,
        response_format: 'b64_json'
    };

    let response = await fetchFn(url, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(requestBodyWithFormat),
        signal: abortSignal
    });

    if (!response.ok) {
        const errorText = await response.text();
        const maybeUnsupportedResponseFormat =
            response.status === 400 &&
            /response_format/i.test(errorText) &&
            /(unsupported|unknown|unrecognized|invalid)/i.test(errorText);

        if (maybeUnsupportedResponseFormat) {
            response = await fetchFn(url, {
                method: 'POST',
                headers: requestHeaders,
                body: JSON.stringify({ model, prompt }),
                signal: abortSignal
            });
        } else {
            throw new Error(`API request failed: ${response.status} ${errorText}`);
        }
    }

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${errorText}`);
    }

    return await response.json() as TogetherImageResponse;
}

function parseImageDimensionsFromBase64(base64Data: string, mimeType: string): { width: number; height: number } | null {
    try {
        const buffer = Buffer.from(base64Data, 'base64');

        if (mimeType === 'image/png') {
            if (buffer.length >= 24 &&
                buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
                const width = (buffer[16] << 24) | (buffer[17] << 16) | (buffer[18] << 8) | buffer[19];
                const height = (buffer[20] << 24) | (buffer[21] << 16) | (buffer[22] << 8) | buffer[23];
                if (width > 0 && height > 0) {
                    return { width, height };
                }
            }
        } else if (mimeType === 'image/jpeg') {
            let offset = 2;
            while (offset < buffer.length - 9) {
                if (buffer[offset] !== 0xFF) {
                    offset++;
                    continue;
                }
                const marker = buffer[offset + 1];
                if (marker === 0xC0 || marker === 0xC2) {
                    const height = (buffer[offset + 5] << 8) | buffer[offset + 6];
                    const width = (buffer[offset + 7] << 8) | buffer[offset + 8];
                    if (width > 0 && height > 0) {
                        return { width, height };
                    }
                    break;
                }
                const length = (buffer[offset + 2] << 8) | buffer[offset + 3];
                offset += 2 + length;
            }
        } else if (mimeType === 'image/webp') {
            if (buffer.length >= 30 &&
                buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
                buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
                if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38 && buffer[15] === 0x58) {
                    const width = ((buffer[24] | (buffer[25] << 8) | (buffer[26] << 16)) + 1);
                    const height = ((buffer[27] | (buffer[28] << 8) | (buffer[29] << 16)) + 1);
                    if (width > 0 && height > 0) {
                        return { width, height };
                    }
                } else if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38 && buffer[15] === 0x20) {
                    const width = (buffer[26] | (buffer[27] << 8)) & 0x3FFF;
                    const height = (buffer[28] | (buffer[29] << 8)) & 0x3FFF;
                    if (width > 0 && height > 0) {
                        return { width, height };
                    }
                }
            }
        }
    } catch {
        // ignore
    }
    return null;
}

export function extractFromResponse(response: GeminiImageResponse): { images: GeneratedImage[]; texts: string[] } {
    const images: GeneratedImage[] = [];
    const texts: string[] = [];

    if (response.candidates) {
        for (const candidate of response.candidates) {
            if (candidate.content?.parts) {
                for (const part of candidate.content.parts) {
                    if (part.inlineData) {
                        const dimensions = parseImageDimensionsFromBase64(part.inlineData.data, part.inlineData.mimeType);
                        images.push({
                            data: part.inlineData.data,
                            mimeType: part.inlineData.mimeType,
                            dimensions: dimensions || undefined
                        });
                    }
                    if (part.text) {
                        texts.push(part.text);
                    }
                }
            }
        }
    }

    return { images, texts };
}

export function extractFromTogetherResponse(response: TogetherImageResponse): { images: GeneratedImage[]; texts: string[] } {
    const images: GeneratedImage[] = [];
    const texts: string[] = [];

    const data = response.data || [];
    for (const item of data) {
        if (item.b64_json) {
            const mimeType = 'image/png';
            const dimensions = parseImageDimensionsFromBase64(item.b64_json, mimeType);
            images.push({ data: item.b64_json, mimeType, dimensions: dimensions || undefined });
        }
    }

    if (images.length === 0) {
        if (data.some(d => d.url)) {
            texts.push('Together API returned image URLs, but this tool only supports base64 (b64_json) responses.');
        }
    }

    return { images, texts };
}

export async function saveImage(base64Data: string, outputPath: string): Promise<void> {
    const uri = resolveUri(outputPath);
    if (!uri) {
        throw new Error('No workspace folder open');
    }

    const dirUri = vscode.Uri.joinPath(uri, '..');
    try {
        await vscode.workspace.fs.createDirectory(dirUri);
    } catch {
        // ignore
    }

    const buffer = Buffer.from(base64Data, 'base64');
    await vscode.workspace.fs.writeFile(uri, buffer);
}

export function getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
        'image/png': '.png',
        'image/jpeg': '.jpg',
        'image/webp': '.webp'
    };
    return mimeToExt[mimeType] || '.png';
}

