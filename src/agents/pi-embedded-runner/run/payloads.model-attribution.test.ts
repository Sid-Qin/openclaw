import { describe, expect, it } from "vitest";
import { buildPayloads } from "./payloads.test-helpers.js";
import { resolveModelAttributionSuffix } from "./payloads.js";
import type { OpenClawConfig } from "../../../config/config.js";

describe("resolveModelAttributionSuffix", () => {
  it("returns undefined when config is missing", () => {
    expect(resolveModelAttributionSuffix(undefined, "openai", "gpt-5.2")).toBeUndefined();
  });

  it("returns undefined when modelAttribution is not set", () => {
    const config = { agents: { defaults: {} } } as OpenClawConfig;
    expect(resolveModelAttributionSuffix(config, "openai", "gpt-5.2")).toBeUndefined();
  });

  it("returns undefined when modelAttribution is false", () => {
    const config = { agents: { defaults: { modelAttribution: false } } } as OpenClawConfig;
    expect(resolveModelAttributionSuffix(config, "openai", "gpt-5.2")).toBeUndefined();
  });

  it("returns default template when modelAttribution is true", () => {
    const config = { agents: { defaults: { modelAttribution: true } } } as OpenClawConfig;
    expect(resolveModelAttributionSuffix(config, "openai", "gpt-5.2")).toBe(
      "⚡ via openai/gpt-5.2",
    );
  });

  it("supports custom template string", () => {
    const config = {
      agents: { defaults: { modelAttribution: "Model: {model} ({provider})" } },
    } as OpenClawConfig;
    expect(resolveModelAttributionSuffix(config, "anthropic", "claude-opus-4-6")).toBe(
      "Model: claude-opus-4-6 (anthropic)",
    );
  });

  it("replaces multiple occurrences of placeholders", () => {
    const config = {
      agents: { defaults: { modelAttribution: "{model} | {model} via {provider}" } },
    } as OpenClawConfig;
    expect(resolveModelAttributionSuffix(config, "openai", "gpt-5.2")).toBe(
      "gpt-5.2 | gpt-5.2 via openai",
    );
  });

  it("uses 'unknown' when provider/model are undefined", () => {
    const config = { agents: { defaults: { modelAttribution: true } } } as OpenClawConfig;
    expect(resolveModelAttributionSuffix(config, undefined, undefined)).toBe(
      "⚡ via unknown/unknown",
    );
  });
});

describe("buildEmbeddedRunPayloads model attribution", () => {
  it("appends attribution to the last text payload", () => {
    const payloads = buildPayloads({
      assistantTexts: ["Hello world"],
      config: { agents: { defaults: { modelAttribution: true } } } as OpenClawConfig,
      provider: "openai",
      model: "gpt-5.2",
    });

    expect(payloads).toHaveLength(1);
    expect(payloads[0]?.text).toContain("Hello world");
    expect(payloads[0]?.text).toContain("⚡ via openai/gpt-5.2");
  });

  it("does not append attribution when disabled", () => {
    const payloads = buildPayloads({
      assistantTexts: ["Hello world"],
      config: { agents: { defaults: {} } } as OpenClawConfig,
      provider: "openai",
      model: "gpt-5.2",
    });

    expect(payloads).toHaveLength(1);
    expect(payloads[0]?.text).toBe("Hello world");
  });

  it("does not append attribution to error payloads", () => {
    const payloads = buildPayloads({
      assistantTexts: [],
      lastToolError: { toolName: "write", error: "fail", mutatingAction: true },
      config: { agents: { defaults: { modelAttribution: true } } } as OpenClawConfig,
      provider: "openai",
      model: "gpt-5.2",
      verboseLevel: "on",
    });

    for (const p of payloads) {
      if (p.isError) {
        expect(p.text).not.toContain("⚡ via");
      }
    }
  });

  it("appends attribution to the last non-error text item", () => {
    const payloads = buildPayloads({
      assistantTexts: ["First message", "Second message"],
      config: { agents: { defaults: { modelAttribution: true } } } as OpenClawConfig,
      provider: "anthropic",
      model: "claude-opus-4-6",
    });

    expect(payloads.length).toBeGreaterThanOrEqual(2);
    const lastNonError = [...payloads].reverse().find((p) => !p.isError && p.text);
    expect(lastNonError?.text).toContain("⚡ via anthropic/claude-opus-4-6");
  });

  it("uses custom template when provided as string", () => {
    const payloads = buildPayloads({
      assistantTexts: ["Hello"],
      config: {
        agents: { defaults: { modelAttribution: "Powered by {model}" } },
      } as OpenClawConfig,
      provider: "openai",
      model: "gpt-5.2",
    });

    expect(payloads).toHaveLength(1);
    expect(payloads[0]?.text).toContain("Powered by gpt-5.2");
  });
});
