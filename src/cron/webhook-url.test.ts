import { describe, expect, it } from "vitest";
import { normalizeHttpWebhookUrl, validateHttpWebhookUrl } from "./webhook-url.js";

describe("validateHttpWebhookUrl", () => {
  it("accepts valid https URLs", () => {
    const result = validateHttpWebhookUrl("https://hooks.example.com/webhook");
    expect(result).toEqual({ url: "https://hooks.example.com/webhook" });
    expect(result.reason).toBeUndefined();
  });

  it("accepts valid http URLs", () => {
    const result = validateHttpWebhookUrl("http://localhost:3000/hook");
    expect(result).toEqual({ url: "http://localhost:3000/hook" });
  });

  it("rejects non-string values with not_a_string reason", () => {
    expect(validateHttpWebhookUrl(undefined)).toEqual({ url: null, reason: "not_a_string" });
    expect(validateHttpWebhookUrl(null)).toEqual({ url: null, reason: "not_a_string" });
    expect(validateHttpWebhookUrl(42)).toEqual({ url: null, reason: "not_a_string" });
    expect(validateHttpWebhookUrl(true)).toEqual({ url: null, reason: "not_a_string" });
  });

  it("rejects empty strings with empty reason", () => {
    expect(validateHttpWebhookUrl("")).toEqual({ url: null, reason: "empty" });
    expect(validateHttpWebhookUrl("   ")).toEqual({ url: null, reason: "empty" });
  });

  it("rejects blocked schemes with blocked_scheme reason", () => {
    const ftp = validateHttpWebhookUrl("ftp://files.example.com/data");
    expect(ftp).toEqual({ url: null, reason: "blocked_scheme:ftp" });

    const file = validateHttpWebhookUrl("file:///etc/passwd");
    expect(file).toEqual({ url: null, reason: "blocked_scheme:file" });

    const ws = validateHttpWebhookUrl("ws://realtime.example.com/stream");
    expect(ws).toEqual({ url: null, reason: "blocked_scheme:ws" });
  });

  it("rejects malformed URLs with malformed_url reason", () => {
    expect(validateHttpWebhookUrl("not-a-url")).toEqual({ url: null, reason: "malformed_url" });
    expect(validateHttpWebhookUrl("://missing-scheme")).toEqual({
      url: null,
      reason: "malformed_url",
    });
  });
});

describe("normalizeHttpWebhookUrl", () => {
  it("returns the URL string for valid URLs", () => {
    expect(normalizeHttpWebhookUrl("https://example.com/hook")).toBe(
      "https://example.com/hook",
    );
  });

  it("returns null for invalid URLs (backward compat)", () => {
    expect(normalizeHttpWebhookUrl("ftp://example.com")).toBeNull();
    expect(normalizeHttpWebhookUrl("")).toBeNull();
    expect(normalizeHttpWebhookUrl(undefined)).toBeNull();
    expect(normalizeHttpWebhookUrl("not-a-url")).toBeNull();
  });
});
