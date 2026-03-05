import { describe, expect, it } from "vitest";
import { resolveSilentReplyFallbackText } from "./pi-embedded-subscribe.handlers.messages.js";

describe("resolveSilentReplyFallbackText", () => {
  it("replaces NO_REPLY with latest messaging tool text when available", () => {
    expect(
      resolveSilentReplyFallbackText({
        text: "NO_REPLY",
        messagingToolSentTexts: ["first", "final delivered text"],
      }),
    ).toBe("final delivered text");
  });

  it("keeps original text when response is not NO_REPLY", () => {
    expect(
      resolveSilentReplyFallbackText({
        text: "normal assistant reply",
        messagingToolSentTexts: ["final delivered text"],
      }),
    ).toBe("normal assistant reply");
  });

  it("keeps NO_REPLY when there is no messaging tool text to mirror", () => {
    expect(
      resolveSilentReplyFallbackText({
        text: "NO_REPLY",
        messagingToolSentTexts: [],
      }),
    ).toBe("NO_REPLY");
  });
});

describe("handleMessageStart cross-turn separator", () => {
  it("does not inject separator on the first assistant message", async () => {
    const { vi } = await import("vitest");
    const { createStubSessionHarness, emitAssistantTextDelta } = await import(
      "./pi-embedded-subscribe.e2e-harness.js"
    );
    const { subscribeEmbeddedPiSession } = await import("./pi-embedded-subscribe.js");

    const { session, emit } = createStubSessionHarness();
    const onBlockReply = vi.fn();

    subscribeEmbeddedPiSession({
      session: session as Parameters<typeof subscribeEmbeddedPiSession>[0]["session"],
      runId: "run-separator-test",
      onBlockReply,
      blockReplyBreak: "message_end",
    });

    emit({ type: "message_start", message: { role: "assistant" } });
    emitAssistantTextDelta({ emit, delta: "First turn text" });
    emit({
      type: "message_end",
      message: { role: "assistant", content: [{ type: "text", text: "First turn text" }] },
    });

    expect(onBlockReply).toHaveBeenCalledTimes(1);
    expect(onBlockReply.mock.calls[0][0].text).toBe("First turn text");
  });

  it("injects \\n\\n separator at the start of a cross-turn assistant message", async () => {
    const { vi } = await import("vitest");
    const { createStubSessionHarness, emitAssistantTextDelta } = await import(
      "./pi-embedded-subscribe.e2e-harness.js"
    );
    const { subscribeEmbeddedPiSession } = await import("./pi-embedded-subscribe.js");

    const { session, emit } = createStubSessionHarness();
    const onBlockReply = vi.fn();

    subscribeEmbeddedPiSession({
      session: session as Parameters<typeof subscribeEmbeddedPiSession>[0]["session"],
      runId: "run-cross-turn",
      onBlockReply,
      blockReplyBreak: "message_end",
    });

    emit({ type: "message_start", message: { role: "assistant" } });
    emitAssistantTextDelta({ emit, delta: "Pre-tool text" });
    emit({
      type: "message_end",
      message: { role: "assistant", content: [{ type: "text", text: "Pre-tool text" }] },
    });

    emit({
      type: "tool_execution_start",
      toolName: "bash",
      toolCallId: "tc1",
      args: { command: "echo test" },
    });
    emit({
      type: "tool_execution_end",
      toolName: "bash",
      toolCallId: "tc1",
      isError: false,
      result: "test",
    });

    emit({ type: "message_start", message: { role: "assistant" } });
    emitAssistantTextDelta({ emit, delta: "Post-tool text" });
    emit({
      type: "message_end",
      message: { role: "assistant", content: [{ type: "text", text: "Post-tool text" }] },
    });

    expect(onBlockReply).toHaveBeenCalledTimes(2);
    expect(onBlockReply.mock.calls[0][0].text).toBe("Pre-tool text");
    expect(onBlockReply.mock.calls[1][0].text).toBe("Post-tool text");
  });
});
