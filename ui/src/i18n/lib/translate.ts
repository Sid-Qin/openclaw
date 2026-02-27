import { en } from "../locales/en.ts";
import type { Locale, TranslationMap } from "./types.ts";

type Subscriber = (locale: Locale) => void;

export const SUPPORTED_LOCALES: ReadonlyArray<Locale> = ["en", "zh-Hans", "zh-Hant", "pt-BR"];

const LEGACY_LOCALE_MAP: Record<string, Locale> = {
  "zh-CN": "zh-Hans",
  "zh-TW": "zh-Hant",
};

export function isSupportedLocale(value: string | null | undefined): value is Locale {
  return value !== null && value !== undefined && SUPPORTED_LOCALES.includes(value as Locale);
}

function migrateLegacyLocale(value: string | null | undefined): Locale | undefined {
  if (value && value in LEGACY_LOCALE_MAP) {
    return LEGACY_LOCALE_MAP[value];
  }
  return undefined;
}

class I18nManager {
  private locale: Locale = "en";
  private translations: Record<Locale, TranslationMap> = { en } as Record<Locale, TranslationMap>;
  private subscribers: Set<Subscriber> = new Set();

  constructor() {
    this.loadLocale();
  }

  private resolveInitialLocale(): Locale {
    const saved = localStorage.getItem("openclaw.i18n.locale");
    if (isSupportedLocale(saved)) {
      return saved;
    }
    const migrated = migrateLegacyLocale(saved);
    if (migrated) {
      return migrated;
    }
    const navLang = navigator.language;
    if (navLang.startsWith("zh")) {
      return navLang === "zh-TW" || navLang === "zh-HK" ? "zh-Hant" : "zh-Hans";
    }
    if (navLang.startsWith("pt")) {
      return "pt-BR";
    }
    return "en";
  }

  private loadLocale() {
    const initialLocale = this.resolveInitialLocale();
    if (initialLocale === "en") {
      this.locale = "en";
      return;
    }
    // Use the normal locale setter so startup locale loading follows the same
    // translation-loading + notify path as manual locale changes.
    void this.setLocale(initialLocale);
  }

  public getLocale(): Locale {
    return this.locale;
  }

  public async setLocale(locale: Locale) {
    const needsTranslationLoad = !this.translations[locale];
    if (this.locale === locale && !needsTranslationLoad) {
      return;
    }

    // Lazy load translations if needed
    if (needsTranslationLoad) {
      try {
        let module: Record<string, TranslationMap>;
        if (locale === "zh-Hans") {
          module = await import("../locales/zh-Hans.ts");
        } else if (locale === "zh-Hant") {
          module = await import("../locales/zh-Hant.ts");
        } else if (locale === "pt-BR") {
          module = await import("../locales/pt-BR.ts");
        } else {
          return;
        }
        this.translations[locale] = module[locale.replace("-", "_")];
      } catch (e) {
        console.error(`Failed to load locale: ${locale}`, e);
        return;
      }
    }

    this.locale = locale;
    localStorage.setItem("openclaw.i18n.locale", locale);
    this.notify();
  }

  public registerTranslation(locale: Locale, map: TranslationMap) {
    this.translations[locale] = map;
  }

  public subscribe(sub: Subscriber) {
    this.subscribers.add(sub);
    return () => this.subscribers.delete(sub);
  }

  private notify() {
    this.subscribers.forEach((sub) => sub(this.locale));
  }

  public t(key: string, params?: Record<string, string>): string {
    const keys = key.split(".");
    let value: unknown = this.translations[this.locale] || this.translations["en"];

    for (const k of keys) {
      if (value && typeof value === "object") {
        value = (value as Record<string, unknown>)[k];
      } else {
        value = undefined;
        break;
      }
    }

    // Fallback to English
    if (value === undefined && this.locale !== "en") {
      value = this.translations["en"];
      for (const k of keys) {
        if (value && typeof value === "object") {
          value = (value as Record<string, unknown>)[k];
        } else {
          value = undefined;
          break;
        }
      }
    }

    if (typeof value !== "string") {
      return key;
    }

    if (params) {
      return value.replace(/\{(\w+)\}/g, (_, k) => params[k] || `{${k}}`);
    }

    return value;
  }
}

export const i18n = new I18nManager();
export const t = (key: string, params?: Record<string, string>) => i18n.t(key, params);
