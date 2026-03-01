import * as path from 'path';
import { t } from '../i18n';

/**
 * MIME 类型映射（仅限多模态工具调用支持的格式）
 *
 * 支持的类型：
 * - 图片：image/png, image/jpeg, image/webp
 * - 文档：application/pdf, text/plain
 */
const MULTIMODAL_MIME_TYPES: Record<string, string> = {
    // 图片（仅支持这 3 种）
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    // 文档（仅支持 PDF）
    '.pdf': 'application/pdf',
};

/**
 * 支持多模态返回的文件扩展名（图片和 PDF）
 */
const MULTIMODAL_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.webp',  // 图片
    '.pdf',                              // 文档
]);

/**
 * 多模态工具支持的 MIME 类型
 */
export const MULTIMODAL_SUPPORTED_TYPES = {
    /** 图片类型 */
    images: ['image/png', 'image/jpeg', 'image/webp'],
    /** 文档类型 */
    documents: ['application/pdf', 'text/plain'],
    /** 所有支持的类型 */
    all: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain']
};

/**
 * 所有已知的二进制文件扩展名
 */
const BINARY_EXTENSIONS = new Set([
    // 图片
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.heic', '.heif', '.bmp', '.svg', '.ico', '.tiff',
    // 音频
    '.mp3', '.wav', '.aiff', '.aac', '.ogg', '.flac', '.m4a', '.wma',
    // 视频
    '.mp4', '.mov', '.avi', '.wmv', '.webm', '.mkv', '.3gp', '.flv', '.m4v',
    // 文档
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    // 其他二进制
    '.zip', '.rar', '.7z', '.tar', '.gz', '.exe', '.dll', '.so', '.dylib',
    '.woff', '.woff2', '.ttf', '.otf', '.eot',
]);

/**
 * 获取文件的 MIME 类型
 */
export function getMultimodalMimeType(filePath: string): string | null {
    const ext = path.extname(filePath).toLowerCase();
    return MULTIMODAL_MIME_TYPES[ext] || null;
}

/**
 * 检查是否支持多模态返回
 */
export function isMultimodalSupported(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return MULTIMODAL_EXTENSIONS.has(ext);
}

/**
 * 检查是否是二进制文件
 */
export function isBinaryFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return BINARY_EXTENSIONS.has(ext);
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * 检查文件扩展名是否为图片
 */
export function isImageFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.webp'].includes(ext);
}

/**
 * 检查文件扩展名是否为 PDF
 */
export function isPdfFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.pdf';
}

/**
 * 检查是否支持多模态返回（根据配置）
 *
 * @param filePath 文件路径
 * @param multimodalEnabled 是否启用多模态工具
 * @returns 是否支持多模态返回
 */
export function isMultimodalSupportedWithConfig(filePath: string, multimodalEnabled: boolean): boolean {
    if (!multimodalEnabled) {
        // 禁用多模态时，不返回任何多模态数据
        return false;
    }
    return isMultimodalSupported(filePath);
}

/**
 * 检查文件是否允许读取（根据多模态配置）
 *
 * @param filePath 文件路径
 * @param multimodalEnabled 是否启用多模态工具
 * @returns 是否允许读取
 */
export function canReadFile(filePath: string, multimodalEnabled: boolean): boolean {
    // 文本文件总是允许读取
    if (!isBinaryFile(filePath)) {
        return true;
    }
    
    // 二进制文件只有在启用多模态且支持多模态返回时才允许读取
    if (multimodalEnabled && isMultimodalSupported(filePath)) {
        return true;
    }
    
    return false;
}

/**
 * 获取不支持读取的原因
 *
 * @param filePath 文件路径
 * @param multimodalEnabled 是否启用多模态工具
 * @returns 错误消息，如果允许读取则返回 null
 */
export function getReadFileError(filePath: string, multimodalEnabled: boolean): string | null {
    if (canReadFile(filePath, multimodalEnabled)) {
        return null;
    }
    
    const ext = path.extname(filePath).toLowerCase();
    
    if (isImageFile(filePath) || isPdfFile(filePath)) {
        return t('multimodal.cannotReadFile', { ext });
    }
    
    return t('multimodal.cannotReadBinaryFile', { ext });
}
