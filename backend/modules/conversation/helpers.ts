/**
 * LimCode - 辅助工具函数
 * 
 * 提供便捷的消息构建和处理函数
 */

import type { Content, ContentPart } from './types';

/**
 * 构建包含多个 parts 的消息
 * 
 * Gemini 允许一个消息包含多个 parts，可以混合文本和多模态内容
 * 
 * @example
 * ```typescript
 * const message = buildMessage('user', [
 *     createImagePart('image/jpeg', imageData1),
 *     { text: '第一张图片的描述' },
 *     createImagePart('image/jpeg', imageData2),
 *     { text: '第二张图片的描述' },
 *     createVideoPart('video/mp4', videoData),
 *     { text: '请分析这些内容' }
 * ]);
 * ```
 */
export function buildMessage(
    role: 'user' | 'model',
    parts: ContentPart[]
): Content {
    return {
        role,
        parts: [...parts]
    };
}

/**
 * 创建用户消息
 */
export function buildUserMessage(parts: ContentPart[]): Content {
    return buildMessage('user', parts);
}

/**
 * 创建模型消息
 */
export function buildModelMessage(parts: ContentPart[]): Content {
    return buildMessage('model', parts);
}

/**
 * 合并多个 parts 到现有消息
 * 
 * @example
 * ```typescript
 * let message = buildUserMessage([{ text: '初始文本' }]);
 * message = appendParts(message, [
 *     createImagePart('image/jpeg', imageData),
 *     { text: '追加的文本' }
 * ]);
 * ```
 */
export function appendParts(message: Content, additionalParts: ContentPart[]): Content {
    return {
        ...message,
        parts: [...message.parts, ...additionalParts]
    };
}

/**
 * 在消息开头插入 parts
 */
export function prependParts(message: Content, newParts: ContentPart[]): Content {
    return {
        ...message,
        parts: [...newParts, ...message.parts]
    };
}

/**
 * 获取消息中的所有文本内容
 * 
 * @param message 消息对象
 * @param separator 多个文本之间的分隔符，默认为空格
 * @returns 合并后的文本
 */
export function getMessageText(message: Content, separator: string = ' '): string {
    return message.parts
        .filter(part => part.text)
        .map(part => part.text!)
        .join(separator);
}

/**
 * 获取消息中的所有文本 parts
 */
export function getTextParts(message: Content): ContentPart[] {
    return message.parts.filter(part => part.text !== undefined);
}

/**
 * 获取消息中的所有多模态 parts（inlineData 或 fileData）
 */
export function getMultimediaParts(message: Content): ContentPart[] {
    return message.parts.filter(part => part.inlineData || part.fileData);
}

/**
 * 检查消息是否包含多模态内容
 */
export function hasMultimedia(message: Content): boolean {
    return message.parts.some(part => part.inlineData || part.fileData);
}

/**
 * 检查历史记录中是否有连续的相同 role
 * 
 * Gemini API 允许连续的相同 role，这在某些场景下很有用
 * 例如：用户连续发送多条消息，或模型分多次回答
 */
export function hasConsecutiveSameRole(history: Content[]): boolean {
    for (let i = 1; i < history.length; i++) {
        if (history[i].role === history[i - 1].role) {
            return true;
        }
    }
    return false;
}

/**
 * 获取连续相同 role 的消息组
 * 
 * @returns 消息组数组，每组包含连续的相同 role 消息
 * 
 * @example
 * ```typescript
 * const history = [
 *     { role: 'user', parts: [{ text: 'A' }] },
 *     { role: 'user', parts: [{ text: 'B' }] },
 *     { role: 'model', parts: [{ text: 'C' }] },
 *     { role: 'user', parts: [{ text: 'D' }] }
 * ];
 * 
 * const groups = groupByConsecutiveRole(history);
 * // 返回: [
 * //   [{ role: 'user', ... }, { role: 'user', ... }],
 * //   [{ role: 'model', ... }],
 * //   [{ role: 'user', ... }]
 * // ]
 * ```
 */
export function groupByConsecutiveRole(history: Content[]): Content[][] {
    if (history.length === 0) {
        return [];
    }

    const groups: Content[][] = [];
    let currentGroup: Content[] = [history[0]];

    for (let i = 1; i < history.length; i++) {
        if (history[i].role === history[i - 1].role) {
            currentGroup.push(history[i]);
        } else {
            groups.push(currentGroup);
            currentGroup = [history[i]];
        }
    }
    groups.push(currentGroup);

    return groups;
}

/**
 * 合并连续相同 role 的消息为单个消息
 * 
 * 注意：这会改变历史结构，谨慎使用！
 * 某些情况下连续相同 role 是有意义的，不应该合并
 * 
 * @example
 * ```typescript
 * const history = [
 *     { role: 'user', parts: [{ text: 'A' }] },
 *     { role: 'user', parts: [{ text: 'B' }] }
 * ];
 * 
 * const merged = mergeConsecutiveSameRole(history);
 * // 返回: [
 * //   { role: 'user', parts: [{ text: 'A' }, { text: 'B' }] }
 * // ]
 * ```
 */
export function mergeConsecutiveSameRole(history: Content[]): Content[] {
    if (history.length === 0) {
        return [];
    }

    const result: Content[] = [];
    let current: Content = {
        role: history[0].role,
        parts: [...history[0].parts]
    };

    for (let i = 1; i < history.length; i++) {
        if (history[i].role === current.role) {
            // 合并 parts
            current.parts.push(...history[i].parts);
        } else {
            result.push(current);
            current = {
                role: history[i].role,
                parts: [...history[i].parts]
            };
        }
    }
    result.push(current);

    return result;
}

/**
 * 统计消息中 parts 的数量
 */
export function countParts(message: Content): {
    total: number;
    text: number;
    inlineData: number;
    fileData: number;
    functionCall: number;
    functionResponse: number;
    thought: number;
} {
    const counts = {
        total: message.parts.length,
        text: 0,
        inlineData: 0,
        fileData: 0,
        functionCall: 0,
        functionResponse: 0,
        thought: 0
    };

    for (const part of message.parts) {
        if (part.text) counts.text++;
        if (part.inlineData) counts.inlineData++;
        if (part.fileData) counts.fileData++;
        if (part.functionCall) counts.functionCall++;
        if (part.functionResponse) counts.functionResponse++;
        if (part.thought === true) counts.thought++;
    }

    return counts;
}

/**
 * 创建纯文本消息
 */
export function createTextMessage(role: 'user' | 'model', text: string): Content {
    return {
        role,
        parts: [{ text }]
    };
}

/**
 * 创建包含多个文本的消息
 * 
 * @example
 * ```typescript
 * const message = createMultiTextMessage('user', [
 *     '第一段文本',
 *     '第二段文本',
 *     '第三段文本'
 * ]);
 * ```
 */
export function createMultiTextMessage(
    role: 'user' | 'model',
    texts: string[]
): Content {
    return {
        role,
        parts: texts.map(text => ({ text }))
    };
}