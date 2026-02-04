import { t } from '../../i18n';
import type { GeminiConfig } from './types';

export function validateGeminiConfig(config: GeminiConfig, errors: string[], warnings: string[]): void {
  if (!config.url || !isValidUrl(config.url)) {
    errors.push(t('modules.config.validation.invalidUrl'));
  }

  if (!config.apiKey || config.apiKey.trim().length === 0) {
    warnings.push(t('modules.config.validation.apiKeyEmpty'));
  }

  const models = (config as any).models || [];
  if (models.length > 0 && (!config.model || config.model.trim().length === 0)) {
    warnings.push(t('modules.config.validation.modelNotSelected'));
  }

  if (config.options) {
    const opts = config.options;

    if (opts.temperature !== undefined) {
      if (opts.temperature < 0 || opts.temperature > 2) {
        errors.push(t('modules.config.validation.temperatureRange'));
      }
    }

    if (opts.maxOutputTokens !== undefined) {
      if (opts.maxOutputTokens < 1) {
        errors.push(t('modules.config.validation.maxOutputTokensMin'));
      }

      if (opts.maxOutputTokens > 8192) {
        warnings.push(t('modules.config.validation.maxOutputTokensHigh'));
      }
    }
  }
}

export function validateOpenAIConfig(config: any, errors: string[], warnings: string[]): void {
  if (!config.url || !isValidUrl(config.url)) {
    errors.push(t('modules.config.validation.invalidUrl'));
  }

  if (!config.apiKey || config.apiKey.trim().length === 0) {
    warnings.push(t('modules.config.validation.apiKeyEmpty'));
  }

  const models = config.models || [];
  if (models.length > 0 && (!config.model || config.model.trim().length === 0)) {
    warnings.push(t('modules.config.validation.modelNotSelected'));
  }
}

export function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

