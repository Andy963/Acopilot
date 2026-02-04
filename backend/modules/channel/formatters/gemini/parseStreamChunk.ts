import { t } from '../../../../i18n';
import { ChannelError, ErrorType } from '../../types';
import type { StreamChunk } from '../../types';

export function parseGeminiStreamChunk(chunk: any): StreamChunk {
  if (chunk && typeof chunk === 'object' && (chunk as any).__acopilot_sse_done === true) {
    return {
      delta: [],
      done: true,
      finishReason: 'done',
    };
  }

  if (chunk.error) {
    throw new ChannelError(
      ErrorType.API_ERROR,
      t('modules.channel.formatters.gemini.errors.apiError', { code: chunk.error.code || 'UNKNOWN' }),
      chunk,
    );
  }

  const candidate = chunk.candidates?.[0];
  if (!candidate) {
    return {
      delta: [],
      done: false,
    };
  }

  const content = candidate.content;
  const parts = content?.parts || [];

  const processedParts = parts.map((part: any) => {
    const { thoughtSignature, ...rest } = part as any;
    if (thoughtSignature) {
      return {
        ...rest,
        thoughtSignatures: { gemini: thoughtSignature },
      };
    }
    return part;
  });

  const done = !!candidate.finishReason;

  const streamChunk: StreamChunk = {
    delta: processedParts,
    done,
  };

  if (done) {
    if (chunk.usageMetadata) {
      streamChunk.usage = {
        promptTokenCount: chunk.usageMetadata.promptTokenCount,
        cachedPromptTokenCount: chunk.usageMetadata.cachedContentTokenCount,
        candidatesTokenCount: chunk.usageMetadata.candidatesTokenCount,
        totalTokenCount: chunk.usageMetadata.totalTokenCount,
        thoughtsTokenCount: chunk.usageMetadata.thoughtsTokenCount,
        promptTokensDetails: chunk.usageMetadata.promptTokensDetails,
        candidatesTokensDetails: chunk.usageMetadata.candidatesTokensDetails,
      };
    }

    streamChunk.finishReason = candidate.finishReason;

    if (chunk.modelVersion) {
      streamChunk.modelVersion = chunk.modelVersion;
    }
  }

  return streamChunk;
}

