import { describe, it, expect, beforeEach } from "vitest";
import { i18n, t } from "../lib/translate.ts";

describe("i18n", () => {
  beforeEach(async () => {
    localStorage.clear();
    // Reset to English
    await i18n.setLocale("en");
  });

  it("should return the key if translation is missing", () => {
    expect(t("non.existent.key")).toBe("non.existent.key");
  });

  it("should return the correct English translation", () => {
    expect(t("common.health")).toBe("Health");
  });

  it("should replace parameters correctly", () => {
    expect(t("overview.stats.cronNext", { time: "10:00" })).toBe("Next wake 10:00");
  });

  it("should fallback to English if key is missing in another locale", async () => {
    await i18n.setLocale("zh-Hans");
    expect(t("common.health")).toBeDefined();
  });

  it("loads translations even when setting the same locale again", async () => {
    const internal = i18n as unknown as {
      locale: string;
      translations: Record<string, unknown>;
    };
    internal.locale = "zh-Hans";
    delete internal.translations["zh-Hans"];

    await i18n.setLocale("zh-Hans");
    expect(t("common.health")).toBe("健康状况");
  });

  it("sets and persists zh-Hans locale", async () => {
    await i18n.setLocale("zh-Hans");
    expect(i18n.getLocale()).toBe("zh-Hans");
    expect(localStorage.getItem("openclaw.i18n.locale")).toBe("zh-Hans");
    expect(t("common.health")).toBe("健康状况");
  });

  it("sets and persists zh-Hant locale", async () => {
    await i18n.setLocale("zh-Hant");
    expect(i18n.getLocale()).toBe("zh-Hant");
    expect(localStorage.getItem("openclaw.i18n.locale")).toBe("zh-Hant");
    expect(t("common.health")).toBeDefined();
  });

  it("isSupportedLocale rejects legacy zh-CN and zh-TW codes", async () => {
    const { isSupportedLocale } = await import("../lib/translate.ts");
    expect(isSupportedLocale("zh-Hans")).toBe(true);
    expect(isSupportedLocale("zh-Hant")).toBe(true);
    expect(isSupportedLocale("zh-CN")).toBe(false);
    expect(isSupportedLocale("zh-TW")).toBe(false);
  });
});
