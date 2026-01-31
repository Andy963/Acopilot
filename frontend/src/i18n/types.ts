/**
 * Acopilot - i18n types.
 *
 * `LanguageMessages` is derived from the English language pack to avoid maintaining
 * a large hand-written interface definition.
 */

export type SupportedLanguage = 'auto' | 'zh-CN' | 'en' | 'ja';

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
