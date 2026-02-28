import { describe, expect, it } from "vitest";
import { resolveMarkdownTableMode } from "./markdown-tables.js";

describe("resolveMarkdownTableMode defaults", () => {
  it("defaults matrix to off", () => {
    expect(resolveMarkdownTableMode({ channel: "matrix" })).toBe("off");
  });

  it("keeps signal and whatsapp defaults as bullets", () => {
    expect(resolveMarkdownTableMode({ channel: "signal" })).toBe("bullets");
    expect(resolveMarkdownTableMode({ channel: "whatsapp" })).toBe("bullets");
  });

  it("falls back to code for channels without explicit defaults", () => {
    expect(resolveMarkdownTableMode({ channel: "telegram" })).toBe("code");
  });
});

describe("resolveMarkdownTableMode config overrides", () => {
  it("respects explicit matrix markdown.tables override", () => {
    const cfg = {
      channels: {
        matrix: {
          markdown: {
            tables: "code",
          },
        },
      },
    };
    expect(resolveMarkdownTableMode({ cfg, channel: "matrix" })).toBe("code");
  });
});
