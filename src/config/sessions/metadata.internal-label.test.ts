import { describe, expect, it, vi } from "vitest";

vi.mock("../../channels/dock.js", () => ({
  getChannelDock: vi.fn(() => null),
}));

vi.mock("../../channels/plugins/index.js", () => ({
  normalizeChannelId: vi.fn((id: string) => id),
}));

vi.mock("../../utils/message-channel.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
  };
});

import type { MsgContext } from "../../auto-reply/templating.js";
import { deriveSessionOrigin, deriveSessionMetaPatch } from "./metadata.js";

function buildCtx(overrides: Partial<MsgContext>): MsgContext {
  return {
    Provider: "webchat",
    Surface: "webchat",
    ChatType: "direct",
    ...overrides,
  } as MsgContext;
}

describe("deriveSessionOrigin skips label for internal channels", () => {
  it("does not use client displayName as label when originating from webchat", () => {
    const ctx = buildCtx({
      OriginatingChannel: "webchat",
      SenderName: "openclaw-tui",
      ChatType: "direct",
    });

    const origin = deriveSessionOrigin(ctx);

    expect(origin?.label).toBeUndefined();
    expect(origin?.provider).toBe("webchat");
  });

  it("preserves label for external channels (telegram)", () => {
    const ctx = buildCtx({
      OriginatingChannel: "telegram",
      Provider: "telegram",
      Surface: "telegram",
      SenderName: "John",
      ChatType: "direct",
    });

    const origin = deriveSessionOrigin(ctx);

    expect(origin?.label).toBe("John");
    expect(origin?.provider).toBe("telegram");
  });

  it("preserves label for discord channels", () => {
    const ctx = buildCtx({
      OriginatingChannel: "discord",
      Provider: "discord",
      Surface: "discord",
      SenderName: "Alice",
      ChatType: "direct",
    });

    const origin = deriveSessionOrigin(ctx);

    expect(origin?.label).toBe("Alice");
    expect(origin?.provider).toBe("discord");
  });

  it("mergeOrigin does not overwrite existing label with internal channel label", () => {
    const existingEntry = {
      sessionId: "s1",
      updatedAt: Date.now(),
      origin: {
        label: "John",
        provider: "telegram",
      },
    };

    const ctx = buildCtx({
      OriginatingChannel: "webchat",
      SenderName: "openclaw-tui",
      ChatType: "direct",
    });

    const patch = deriveSessionMetaPatch({
      ctx,
      sessionKey: "agent:main:telegram:direct:12345",
      existing: existingEntry,
    });

    expect(patch?.origin?.label).toBe("John");
  });

  it("allows external channel to update existing label via merge", () => {
    const existingEntry = {
      sessionId: "s1",
      updatedAt: Date.now(),
      origin: {
        label: "John",
        provider: "telegram",
      },
    };

    const ctx = buildCtx({
      OriginatingChannel: "telegram",
      Provider: "telegram",
      Surface: "telegram",
      SenderName: "John Doe",
      ChatType: "direct",
    });

    const patch = deriveSessionMetaPatch({
      ctx,
      sessionKey: "agent:main:telegram:direct:12345",
      existing: existingEntry,
    });

    expect(patch?.origin?.label).toBe("John Doe");
  });
});
