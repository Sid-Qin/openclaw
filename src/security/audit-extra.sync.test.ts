import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { collectAttackSurfaceSummaryFindings, hasWebSearchKey } from "./audit-extra.sync.js";
import { safeEqualSecret } from "./secret-equal.js";

describe("collectAttackSurfaceSummaryFindings", () => {
  it("distinguishes external webhooks from internal hooks when only internal hooks are enabled", () => {
    const cfg: OpenClawConfig = {
      hooks: { internal: { enabled: true } },
    };

    const [finding] = collectAttackSurfaceSummaryFindings(cfg);
    expect(finding.checkId).toBe("summary.attack_surface");
    expect(finding.detail).toContain("hooks.webhooks: disabled");
    expect(finding.detail).toContain("hooks.internal: enabled");
  });

  it("reports both hook systems as enabled when both are configured", () => {
    const cfg: OpenClawConfig = {
      hooks: { enabled: true, internal: { enabled: true } },
    };

    const [finding] = collectAttackSurfaceSummaryFindings(cfg);
    expect(finding.detail).toContain("hooks.webhooks: enabled");
    expect(finding.detail).toContain("hooks.internal: enabled");
  });

  it("reports both hook systems as disabled when neither is configured", () => {
    const cfg: OpenClawConfig = {};

    const [finding] = collectAttackSurfaceSummaryFindings(cfg);
    expect(finding.detail).toContain("hooks.webhooks: disabled");
    expect(finding.detail).toContain("hooks.internal: disabled");
  });
});

describe("hasWebSearchKey", () => {
  const empty: NodeJS.ProcessEnv = {};

  it("detects Brave API key in config", () => {
    const cfg: OpenClawConfig = { tools: { web: { search: { apiKey: "brave-key" } } } };
    expect(hasWebSearchKey(cfg, empty)).toBe(true);
  });

  it("detects Perplexity API key in config", () => {
    const cfg: OpenClawConfig = {
      tools: { web: { search: { perplexity: { apiKey: "pplx-key" } } } },
    };
    expect(hasWebSearchKey(cfg, empty)).toBe(true);
  });

  it("detects Gemini API key in config", () => {
    const cfg: OpenClawConfig = {
      tools: { web: { search: { gemini: { apiKey: "gemini-key" } } } },
    };
    expect(hasWebSearchKey(cfg, empty)).toBe(true);
  });

  it("detects Grok API key in config", () => {
    const cfg: OpenClawConfig = {
      tools: { web: { search: { grok: { apiKey: "grok-key" } } } },
    };
    expect(hasWebSearchKey(cfg, empty)).toBe(true);
  });

  it("detects Kimi API key in config", () => {
    const cfg: OpenClawConfig = {
      tools: { web: { search: { kimi: { apiKey: "kimi-key" } } } },
    };
    expect(hasWebSearchKey(cfg, empty)).toBe(true);
  });

  it.each([
    ["BRAVE_API_KEY"],
    ["PERPLEXITY_API_KEY"],
    ["GEMINI_API_KEY"],
    ["XAI_API_KEY"],
    ["KIMI_API_KEY"],
    ["MOONSHOT_API_KEY"],
    ["OPENROUTER_API_KEY"],
  ])("detects %s environment variable", (envVar) => {
    expect(hasWebSearchKey({}, { [envVar]: "key-value" })).toBe(true);
  });

  it("returns false when no keys are configured", () => {
    expect(hasWebSearchKey({}, empty)).toBe(false);
  });
});

describe("safeEqualSecret", () => {
  it("matches identical secrets", () => {
    expect(safeEqualSecret("secret-token", "secret-token")).toBe(true);
  });

  it("rejects mismatched secrets", () => {
    expect(safeEqualSecret("secret-token", "secret-tokEn")).toBe(false);
  });

  it("rejects different-length secrets", () => {
    expect(safeEqualSecret("short", "much-longer")).toBe(false);
  });

  it("rejects missing values", () => {
    expect(safeEqualSecret(undefined, "secret")).toBe(false);
    expect(safeEqualSecret("secret", undefined)).toBe(false);
    expect(safeEqualSecret(null, "secret")).toBe(false);
  });
});
