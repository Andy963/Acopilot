import { t } from '../../i18n';
import type {
  ConversationHistory,
  ConversationStats,
  MessageFilter,
  MessagePosition
} from './types';

export function findMessagesInHistory(history: ConversationHistory, filter: MessageFilter): MessagePosition[] {
  const results: MessagePosition[] = [];

  for (let i = 0; i < history.length; i++) {
    const message = history[i];
    let matches = true;

    if (filter.role && message.role !== filter.role) {
      matches = false;
    }

    if (filter.hasFunctionCall !== undefined) {
      const hasFunctionCall = message.parts.some(p => p.functionCall !== undefined);
      if (hasFunctionCall !== filter.hasFunctionCall) {
        matches = false;
      }
    }

    if (filter.hasText !== undefined) {
      const hasText = message.parts.some(p => p.text !== undefined && p.text.trim() !== '');
      if (hasText !== filter.hasText) {
        matches = false;
      }
    }

    if (filter.isThought !== undefined) {
      const isThought = message.parts.some(p => p.thought === true);
      if (isThought !== filter.isThought) {
        matches = false;
      }
    }

    if (filter.indexRange) {
      const { start, end } = filter.indexRange;
      if (i < start || i >= end) {
        matches = false;
      }
    }

    if (matches) {
      results.push({ index: i, role: message.role });
    }
  }

  return results;
}

export function computeConversationStats(history: ConversationHistory): ConversationStats {
  let userMessages = 0;
  let modelMessages = 0;
  let functionCalls = 0;
  let hasThoughtSignatures = false;
  let hasThoughts = false;
  let hasFileData = false;
  let hasInlineData = false;
  let inlineDataSize = 0;
  const multimedia = {
    images: 0,
    audio: 0,
    video: 0,
    documents: 0
  };

  let totalThoughtsTokens = 0;
  let totalCandidatesTokens = 0;
  let messagesWithThoughtsTokens = 0;
  let messagesWithCandidatesTokens = 0;

  for (const message of history) {
    if (message.role === 'user') {
      userMessages++;
    } else {
      modelMessages++;
    }

    const thoughtsTokens = message.usageMetadata?.thoughtsTokenCount ?? message.thoughtsTokenCount;
    const candidatesTokens = message.usageMetadata?.candidatesTokenCount ?? message.candidatesTokenCount;

    if (thoughtsTokens !== undefined) {
      totalThoughtsTokens += thoughtsTokens;
      messagesWithThoughtsTokens++;
    }
    if (candidatesTokens !== undefined) {
      totalCandidatesTokens += candidatesTokens;
      messagesWithCandidatesTokens++;
    }

    for (const part of message.parts) {
      if (part.functionCall) {
        functionCalls++;
      }

      if (part.thoughtSignatures) {
        hasThoughtSignatures = true;
      }

      if (part.thought === true) {
        hasThoughts = true;
      }

      if (part.fileData) {
        hasFileData = true;
      }

      if (part.inlineData) {
        hasInlineData = true;

        const base64Length = part.inlineData.data.length;
        inlineDataSize += Math.ceil((base64Length * 3) / 4);

        const mimeType = part.inlineData.mimeType;
        if (mimeType.startsWith('image/')) {
          multimedia.images++;
        } else if (mimeType.startsWith('audio/')) {
          multimedia.audio++;
        } else if (mimeType.startsWith('video/')) {
          multimedia.video++;
        } else if (mimeType === 'application/pdf' || mimeType === 'text/plain') {
          multimedia.documents++;
        }
      }
    }
  }

  return {
    totalMessages: history.length,
    userMessages,
    modelMessages,
    functionCalls,
    hasThoughtSignatures,
    hasThoughts,
    hasFileData,
    hasInlineData,
    inlineDataSize,
    multimedia,
    tokens: {
      totalThoughtsTokens,
      totalCandidatesTokens,
      totalTokens: totalThoughtsTokens + totalCandidatesTokens,
      messagesWithThoughtsTokens,
      messagesWithCandidatesTokens
    }
  };
}

export function rejectToolCallsInHistory(params: {
  history: ConversationHistory;
  conversationId: string;
  messageIndex: number;
  toolCallIds?: string[];
}): boolean {
  const { history, conversationId, messageIndex, toolCallIds } = params;

  if (messageIndex < 0 || messageIndex >= history.length) {
    throw new Error(t('modules.conversation.errors.messageIndexOutOfBounds', { index: messageIndex }));
  }

  const message = history[messageIndex];
  let modified = false;

  const respondedToolIds = new Set<string>();
  for (let i = messageIndex + 1; i < history.length; i++) {
    const msg = history[i];
    for (const part of msg.parts) {
      if (part.functionResponse?.id) {
        respondedToolIds.add(part.functionResponse.id);
      }
    }
  }

  for (const part of message.parts) {
    if (part.functionCall && part.functionCall.id) {
      const shouldReject = toolCallIds
        ? toolCallIds.includes(part.functionCall.id)
        : !respondedToolIds.has(part.functionCall.id);

      if (shouldReject && !part.functionCall.rejected) {
        part.functionCall.rejected = true;
        modified = true;
      }
    }
  }

  return modified;
}

