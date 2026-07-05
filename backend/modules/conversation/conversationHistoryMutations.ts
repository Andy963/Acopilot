import { t } from '../../i18n';

import type { ConversationHistory, Content, ContentPart } from './types';

function cloneConversationValue<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
}

function requireMessageIndex(history: ConversationHistory, messageIndex: number): void {
    if (messageIndex < 0 || messageIndex >= history.length) {
        throw new Error(t('modules.conversation.errors.messageIndexOutOfBounds', { index: messageIndex }));
    }
}

function clampInsertIndex(position: number, historyLength: number): number {
    return Math.max(0, Math.min(position, historyLength));
}

export function cloneConversationHistory(history: ConversationHistory): ConversationHistory {
    return cloneConversationValue(history);
}

export function cloneConversationContent(content: Content): Content {
    return cloneConversationValue(content);
}

export function addMessageToHistory(
    history: ConversationHistory,
    role: 'user' | 'model' | 'system',
    parts: ContentPart[]
): void {
    history.push({
        role,
        parts: cloneConversationValue(parts),
        timestamp: Date.now()
    });
}

export function addContentToHistory(history: ConversationHistory, content: Content): void {
    const contentCopy = cloneConversationContent(content);
    if (!contentCopy.timestamp) {
        contentCopy.timestamp = Date.now();
    }
    history.push(contentCopy);
}

export function addBatchToHistory(history: ConversationHistory, contents: Content[]): void {
    const now = Date.now();
    const contentsCopy = cloneConversationValue(contents).map((content: Content, index: number) => {
        if (!content.timestamp) {
            content.timestamp = now + index;
        }
        return content;
    });

    history.push(...contentsCopy);
}

export function getMessagesWithIndex(history: ConversationHistory): Content[] {
    return history.map((message, index) => ({
        ...cloneConversationContent(message),
        index
    }));
}

export function getMessageAt(history: ConversationHistory, messageIndex: number): Content | undefined {
    if (messageIndex < 0 || messageIndex >= history.length) {
        return undefined;
    }

    return cloneConversationContent(history[messageIndex]);
}

export function updateMessageInHistory(
    history: ConversationHistory,
    messageIndex: number,
    updates: Partial<Content>
): void {
    requireMessageIndex(history, messageIndex);
    Object.assign(history[messageIndex], updates);
}

export function deleteMessageFromHistory(history: ConversationHistory, messageIndex: number): void {
    requireMessageIndex(history, messageIndex);
    history.splice(messageIndex, 1);
}

export function insertMessageIntoHistory(
    history: ConversationHistory,
    position: number,
    role: 'user' | 'model' | 'system',
    parts: ContentPart[]
): void {
    history.splice(clampInsertIndex(position, history.length), 0, {
        role,
        parts: cloneConversationValue(parts),
        timestamp: Date.now()
    });
}

export function insertContentIntoHistory(
    history: ConversationHistory,
    position: number,
    content: Content
): void {
    const contentCopy = cloneConversationContent(content);
    if (!contentCopy.timestamp) {
        contentCopy.timestamp = Date.now();
    }

    history.splice(clampInsertIndex(position, history.length), 0, contentCopy);
}

export function deleteMessagesInRangeFromHistory(
    history: ConversationHistory,
    startIndex: number,
    endIndex: number
): void {
    const start = Math.max(0, startIndex);
    const end = Math.min(history.length, endIndex + 1);
    history.splice(start, end - start);
}

export function deleteToMessageInHistory(history: ConversationHistory, targetIndex: number): number {
    requireMessageIndex(history, targetIndex);

    const deleteCount = history.length - targetIndex;
    history.splice(targetIndex, deleteCount);
    return deleteCount;
}
