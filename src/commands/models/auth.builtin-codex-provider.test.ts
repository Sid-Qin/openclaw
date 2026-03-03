import { describe, expect, it } from "vitest";
import type { ProviderPlugin } from "../../plugins/types.js";
import { resolveProviderMatch } from "../provider-auth-helpers.js";

function fakeProvider(id: string, aliases?: string[]): ProviderPlugin {
  return {
    id,
    label: id,
    aliases,
    auth: [],
  };
}

describe("resolveProviderMatch openai-codex built-in provider (#32892)", () => {
  it("matches openai-codex by id", () => {
    const providers = [fakeProvider("google-gemini-cli"), fakeProvider("openai-codex", ["codex"])];
    const result = resolveProviderMatch(providers, "openai-codex");
    expect(result).not.toBeNull();
    expect(result?.id).toBe("openai-codex");
  });

  it("matches codex alias to openai-codex provider", () => {
    const providers = [fakeProvider("openai-codex", ["codex"])];
    const result = resolveProviderMatch(providers, "codex");
    expect(result).not.toBeNull();
    expect(result?.id).toBe("openai-codex");
  });

  it("returns null for unknown provider", () => {
    const providers = [fakeProvider("openai-codex")];
    const result = resolveProviderMatch(providers, "nonexistent");
    expect(result).toBeNull();
  });

  it("returns null when no provider requested", () => {
    const providers = [fakeProvider("openai-codex")];
    const result = resolveProviderMatch(providers, undefined);
    expect(result).toBeNull();
  });

  it("case-insensitive matching for openai-codex", () => {
    const providers = [fakeProvider("openai-codex", ["codex"])];
    const result = resolveProviderMatch(providers, "OpenAI-Codex");
    expect(result).not.toBeNull();
    expect(result?.id).toBe("openai-codex");
  });
});
