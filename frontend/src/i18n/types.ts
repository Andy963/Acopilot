/**
 * Acopilot - i18n types.
 *
 * `LanguageMessages` is derived from the English language pack to avoid maintaining
 * a large hand-written interface definition.
 */

export const SUPPORTED_LANGUAGE_VALUES = ['auto', 'zh-CN', 'en', 'ja'] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGE_VALUES)[number];

export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return typeof value === 'string' && SUPPORTED_LANGUAGE_VALUES.includes(value as SupportedLanguage);
}

export interface LanguageOption {
  value: SupportedLanguage;
  label: string;
  nativeLabel: string;
}

type DeepStringify<T> = T extends string
  ? string
  : T extends (infer U)[]
    ? DeepStringify<U>[]
    : T extends object
      ? { -readonly [K in keyof T]-?: DeepStringify<T[K]> }
      : string;

export type LanguageMessages = DeepStringify<typeof import('./langs/en').default>;
