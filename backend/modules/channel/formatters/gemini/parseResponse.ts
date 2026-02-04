import { t } from '../../../../i18n';
import type { Content } from '../../../conversation/types';
import type { GenerateResponse } from '../../types';

export function parseGeminiResponse(response: any): GenerateResponse {
  if (!response || !response.candidates || response.candidates.length === 0) {
    throw new Error(t('modules.channel.formatters.gemini.errors.invalidResponse'));
  }

  const candidate = response.candidates[0];

  const rawContent = candidate.content || {};
  const content: Content = {
    ...rawContent,
    role: 'model',
    parts: Array.isArray(rawContent.parts) ? rawContent.parts : [],
  };

  if (content.parts) {
    content.parts = content.parts.map((part) => {
      const { thoughtSignature, ...rest } = part as any;
      if (thoughtSignature) {
        return {
          ...rest,
          thoughtSignatures: { gemini: thoughtSignature },
        };
      }
      return part;
    });
  }

  if (response.usageMetadata) {
    content.usageMetadata = {
      promptTokenCount: response.usageMetadata.promptTokenCount,
      cachedPromptTokenCount: response.usageMetadata.cachedContentTokenCount,
      candidatesTokenCount: response.usageMetadata.candidatesTokenCount,
      totalTokenCount: response.usageMetadata.totalTokenCount,
      thoughtsTokenCount: response.usageMetadata.thoughtsTokenCount,
      promptTokensDetails: response.usageMetadata.promptTokensDetails,
      candidatesTokensDetails: response.usageMetadata.candidatesTokensDetails,
    };
  }

  if (response.modelVersion) {
    content.modelVersion = response.modelVersion;
  }

  const finishReason = candidate.finishReason;
  const model = response.modelVersion;

  return {
    content,
    finishReason,
    model,
    raw: response,
  };
}

