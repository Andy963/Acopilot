import * as path from 'path';
import { t } from '../i18n';
import {
    MULTIMODAL_SUPPORTED_TYPES,
    canReadFile,
    isBinaryFile,
    isImageFile,
    isPdfFile
} from './multimodalFileUtils';

// ==================== 渠道类型多模态支持 ====================

/**
 * 渠道类型
 */
export type ChannelType = 'gemini' | 'openai' | 'anthropic' | 'openai-responses';

/**
 * 工具模式
 */
export type ToolMode = 'function_call' | 'xml' | 'json';

/**
 * 多模态能力
 */
export interface MultimodalCapability {
    /** 是否支持图片 */
    supportsImages: boolean;
    /** 是否支持文档（PDF） */
    supportsDocuments: boolean;
    /** 是否支持回传多模态数据到历史记录 */
    supportsHistoryMultimodal: boolean;
}

/**
 * 获取渠道的多模态能力
 * 
 * 根据渠道类型和工具模式，定义不同的多模态支持级别：
 * - gemini: 全面支持所有多模态功能
 * - openai: 
 *   - function_call 模式不支持多模态工具
 *   - xml/json 模式只支持图片，不支持文档
 * - anthropic: 全部支持
 * - custom: 保守处理，假设全部支持
 * 
 * @param channelType 渠道类型
 * @param toolMode 工具模式
 * @param multimodalEnabled 是否启用多模态工具
 * @returns 多模态能力
 */
export function getMultimodalCapability(
    channelType: ChannelType,
    toolMode: ToolMode,
    multimodalEnabled: boolean
): MultimodalCapability {
    // 如果未启用多模态工具，不支持任何多模态功能
    if (!multimodalEnabled) {
        return {
            supportsImages: false,
            supportsDocuments: false,
            supportsHistoryMultimodal: false,
        };
    }
    
    switch (channelType) {
        case 'gemini':
            // Gemini 全面支持
            return {
                supportsImages: true,
                supportsDocuments: true,
                supportsHistoryMultimodal: true,
            };
            
        case 'openai':
            if (toolMode === 'function_call') {
                // OpenAI function_call 模式：工具响应不能包含图片数据
                // （OpenAI API 要求 tool result 必须是字符串）
                return {
                    supportsImages: false,
                    supportsDocuments: false,
                    supportsHistoryMultimodal: false,
                };
            } else {
                // OpenAI xml/json 模式：
                // - 支持图片（作为 user 消息附件发送）
                // - 不支持文档（PDF）
                // - 历史中的图片可以正常发送（作为 user 消息的 image_url 类型）
                return {
                    supportsImages: true,
                    supportsDocuments: false,
                    supportsHistoryMultimodal: true, // 历史中的图片可以作为 user 消息发送
                };
            }
            
        case 'openai-responses':
            // OpenAI Responses API 全面支持多模态（图片和文档）
            return {
                supportsImages: true,
                supportsDocuments: true,
                supportsHistoryMultimodal: true,
            };
            
        case 'anthropic':
            // Anthropic 全面支持多模态（图片和文档）
            return {
                supportsImages: true,
                supportsDocuments: true,
                supportsHistoryMultimodal: true,
            };
            
        default:
            return {
                supportsImages: false,
                supportsDocuments: false,
                supportsHistoryMultimodal: false,
            };
    }
}

/**
 * 根据渠道能力检查文件是否允许读取
 * 
 * @param filePath 文件路径
 * @param capability 多模态能力
 * @returns 是否允许读取
 */
export function canReadFileWithCapability(filePath: string, capability: MultimodalCapability): boolean {
    // 文本文件总是允许读取
    if (!isBinaryFile(filePath)) {
        return true;
    }
    
    // 检查图片支持
    if (isImageFile(filePath)) {
        return capability.supportsImages;
    }
    
    // 检查文档支持（PDF）
    if (isPdfFile(filePath)) {
        return capability.supportsDocuments;
    }
    
    return false;
}

/**
 * 获取不支持读取的详细原因（带渠道能力信息）
 *
 * @param filePath 文件路径
 * @param multimodalEnabled 是否启用多模态工具
 * @param capability 多模态能力（可选）
 * @returns 错误消息，如果允许读取则返回 null
 */
export function getReadFileErrorWithCapability(
    filePath: string,
    multimodalEnabled: boolean,
    capability?: MultimodalCapability
): string | null {
    // 如果有能力信息，使用能力检查
    if (capability) {
        if (canReadFileWithCapability(filePath, capability)) {
            return null;
        }
    } else {
        if (canReadFile(filePath, multimodalEnabled)) {
            return null;
        }
    }
    
    const ext = path.extname(filePath).toLowerCase();
    
    if (!multimodalEnabled) {
        if (isImageFile(filePath) || isPdfFile(filePath)) {
            return t('multimodal.cannotReadFile', { ext });
        }
    } else if (capability) {
        if (isImageFile(filePath) && !capability.supportsImages) {
            return t('multimodal.cannotReadImage', { ext });
        }
        if (isPdfFile(filePath) && !capability.supportsDocuments) {
            return t('multimodal.cannotReadDocument', { ext });
        }
    }
    
    return t('multimodal.cannotReadBinaryFile', { ext });
}

/**
 * 检查 MIME 类型是否为图片
 */
export function isMimeTypeImage(mimeType: string): boolean {
    return MULTIMODAL_SUPPORTED_TYPES.images.includes(mimeType);
}

/**
 * 检查 MIME 类型是否为文档
 */
export function isMimeTypeDocument(mimeType: string): boolean {
    return MULTIMODAL_SUPPORTED_TYPES.documents.includes(mimeType);
}

