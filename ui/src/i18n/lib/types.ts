export type TranslationMap = { [key: string]: string | TranslationMap };

export type Locale = "en" | "zh-Hans" | "zh-Hant" | "pt-BR";

export interface I18nConfig {
  locale: Locale;
  fallbackLocale: Locale;
  translations: Record<Locale, TranslationMap>;
}
