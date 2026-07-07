import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getGlobalSettingsManager } from '../../../../core/settingsContext';
import type { SettingsManager } from '../../../settings/SettingsManager';
import type {
    Content,
    ContentPart,
    ContextInjectedAttachment,
    ContextInjectedAttachments,
    ContextInjectedPinnedFile,
    ContextInjectedPinnedFiles
} from '../../../conversation/types';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function base64ByteLength(base64: string): number {
    const s = String(base64 || '').trim();
    if (!s) return 0;
    const padding = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor((s.length * 3) / 4) - padding);
}

function normalizeAttachmentType(mimeType: string): string | undefined {
    const mt = String(mimeType || '').toLowerCase();
    if (!mt) return undefined;
    if (mt.startsWith('image/')) return 'image';
    if (mt.startsWith('video/')) return 'video';
    if (mt.startsWith('audio/')) return 'audio';
    return undefined;
}

const MAX_TEXT_ATTACHMENT_CHARS = 200_000;

function isTextAttachment(mimeType: string): boolean {
    const mt = String(mimeType || '').toLowerCase();
    return mt.startsWith('text/') ||
        mt === 'application/json' ||
        mt === 'application/xml' ||
        mt === 'application/javascript' ||
        mt === 'application/x-javascript' ||
        mt === 'application/sql' ||
        mt.endsWith('+json') ||
        mt.endsWith('+xml');
}

function getTextCharCount(base64?: string): number | undefined {
    if (!base64) return undefined;
    try {
        return Buffer.from(base64, 'base64').toString('utf8').length;
    } catch {
        return undefined;
    }
}

function estimateAttachmentTokens(mimeType: string, size?: number, base64?: string): number | undefined {
    if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) return undefined;
    const mt = String(mimeType || '').toLowerCase();

    if (mt.startsWith('image/')) return 500;
    if (mt.startsWith('audio/')) return Math.max(100, Math.min(Math.ceil((size / (10 * 1024)) * 32), 50000));
    if (mt.startsWith('video/')) return Math.max(500, Math.min(Math.ceil((size / (17 * 1024)) * 295), 200000));
    if (mt === 'application/pdf') return Math.max(500, Math.min(Math.ceil(size / (75 * 1024)) * 500, 100000));
    if (isTextAttachment(mt)) {
        const charCount = getTextCharCount(base64);
        const estimatedChars = typeof charCount === 'number' ? charCount : size;
        return Math.max(1, Math.ceil(Math.min(estimatedChars, MAX_TEXT_ATTACHMENT_CHARS) / 4));
    }
    return 1000;
}

function getAttachmentInclusionMode(mimeType: string): 'inline' | 'text' | 'unsupported' {
    const mt = String(mimeType || '').toLowerCase();
    if (!mt) return 'unsupported';
    if (isTextAttachment(mt)) return 'text';
    if (mt.startsWith('image/') || mt.startsWith('audio/') || mt.startsWith('video/') || mt === 'application/pdf') return 'inline';
    return 'unsupported';
}

function isAttachmentTruncated(mimeType: string, base64?: string): boolean | undefined {
    if (!isTextAttachment(mimeType)) return undefined;
    const charCount = getTextCharCount(base64);
    if (typeof charCount !== 'number') return undefined;
    return charCount > MAX_TEXT_ATTACHMENT_CHARS;
}

export function buildPinnedFilesInjectedInfo(settingsManager?: SettingsManager): ContextInjectedPinnedFiles | undefined {
    const mgr = settingsManager || getGlobalSettingsManager();
    if (!mgr) return undefined;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) return undefined;

    const files: ContextInjectedPinnedFile[] = [];
    let totalEnabled = 0;
    let included = 0;

    for (const workspaceFolder of workspaceFolders) {
        const workspaceUri = workspaceFolder.uri.toString();
        const pinnedFiles = mgr.getEnabledPinnedFilesForWorkspace(workspaceUri);

        for (const pinnedFile of pinnedFiles) {
            totalEnabled++;

            const displayPath = workspaceFolders.length > 1
                ? `${workspaceFolder.name}/${pinnedFile.path}`
                : pinnedFile.path;

            let exists = false;
            try {
                const fullPath = path.isAbsolute(pinnedFile.path)
                    ? pinnedFile.path
                    : path.join(workspaceFolder.uri.fsPath, pinnedFile.path);
                exists = fs.existsSync(fullPath);
            } catch {
                exists = false;
            }

            if (exists) included++;

            files.push({
                id: pinnedFile.id,
                path: displayPath,
                workspace: workspaceFolder.name,
                exists,
                included: exists
            });
        }
    }

    if (totalEnabled === 0) return undefined;

    return { totalEnabled, included, files };
}

export type PreviewAttachmentMeta = {
    id?: string;
    name?: string;
    type?: string;
    size?: number;
    mimeType?: string;
    url?: string;
};

export function buildPreviewAttachmentsInjectedInfo(raw: unknown): ContextInjectedAttachments | undefined {
    if (!Array.isArray(raw)) return undefined;

    const items: ContextInjectedAttachment[] = [];
    for (const entry of raw) {
        if (!isRecord(entry)) continue;

        const name = typeof entry.name === 'string' ? entry.name.trim() : '';
        const mimeType = typeof entry.mimeType === 'string' ? entry.mimeType.trim() : '';

        if (!name && !mimeType) continue;

        const id = typeof entry.id === 'string' ? entry.id.trim() : undefined;
        const type = typeof entry.type === 'string' ? entry.type.trim() : (normalizeAttachmentType(mimeType) || undefined);
        const size = typeof entry.size === 'number' && Number.isFinite(entry.size) ? entry.size : undefined;
        const url = typeof entry.url === 'string' ? entry.url.trim() : undefined;

        items.push({
            id,
            name: name || (mimeType ? mimeType : 'attachment'),
            type,
            mimeType: mimeType || undefined,
            size,
            url,
            estimatedTokens: estimateAttachmentTokens(mimeType, size),
            truncated: isAttachmentTruncated(mimeType),
            inclusionMode: getAttachmentInclusionMode(mimeType)
        });
    }

    if (items.length === 0) return undefined;
    return { count: items.length, items };
}

function collectAttachmentsFromParts(parts: ContentPart[], out: ContextInjectedAttachment[]): void {
    for (const part of parts) {
        if (part.inlineData) {
            const mimeType = String(part.inlineData.mimeType || '').trim();
            const name = String(part.inlineData.name || part.inlineData.displayName || '').trim();
            const size = part.inlineData.data ? base64ByteLength(part.inlineData.data) : undefined;

            out.push({
                id: part.inlineData.id,
                name: name || (mimeType ? mimeType : 'inlineData'),
                type: normalizeAttachmentType(mimeType),
                mimeType: mimeType || undefined,
                size,
                estimatedTokens: estimateAttachmentTokens(mimeType, size, part.inlineData.data),
                truncated: isAttachmentTruncated(mimeType, part.inlineData.data),
                inclusionMode: getAttachmentInclusionMode(mimeType)
            });
        }

        if (part.fileData) {
            const mimeType = String(part.fileData.mimeType || '').trim();
            const name = String(part.fileData.displayName || '').trim();
            const url = String(part.fileData.fileUri || '').trim();

            out.push({
                name: name || (url ? url : (mimeType ? mimeType : 'fileData')),
                type: normalizeAttachmentType(mimeType),
                mimeType: mimeType || undefined,
                url: url || undefined,
                inclusionMode: 'inline'
            });
        }

        if (part.functionResponse?.parts && Array.isArray(part.functionResponse.parts)) {
            collectAttachmentsFromParts(part.functionResponse.parts, out);
        }
    }
}

export function buildLastMessageAttachmentsInjectedInfo(history: Content[]): ContextInjectedAttachments | undefined {
    if (!Array.isArray(history) || history.length === 0) return undefined;

    const last = history[history.length - 1];
    if (!last || !Array.isArray(last.parts) || last.parts.length === 0) return undefined;

    const items: ContextInjectedAttachment[] = [];
    collectAttachmentsFromParts(last.parts, items);

    if (items.length === 0) return undefined;
    return { count: items.length, items };
}

