import { describe, expect, it, vi } from "vitest";
import { wrapStreamFnWithModelApiLogging } from "./model-api-logging.js";
import type { StreamFn } from "@mariozechner/pi-agent-core";
import { createAssistantMessageEventStream } from "@mariozechner/pi-ai";

vi.mock("./logging/subsystem.js", () => ({
  createSubsystemLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

function createMockStream(events: Array<{ type: string; [key: string]: unknown }>) {
  const stream = createAssistantMessageEventStream();
  for (const event of events) {
    stream.push(event as never);
  }
  return stream;
}

describe("wrapStreamFnWithModelApiLogging", () => {
  it("intercepts onPayload to capture request size", async () => {
    const payloadSpy = vi.fn();
    const mockStream = createMockStream([
      { type: "start", partial: { role: "assistant", content: [] } },
      { type: "done", reason: "stop", message: { role: "assistant", content: [] } },
    ]);

    const baseFn: StreamFn = (_model, _context, options) => {
      options?.onPayload?.({ messages: [{ role: "user", content: "hello" }] });
      return mockStream;
    };

    const wrapped = wrapStreamFnWithModelApiLogging(baseFn, {
      modelId: "test-model",
      provider: "test-provider",
    });

    const stream = wrapped(
      { id: "test", api: "openai-responses" } as never,
      { systemPrompt: "", messages: [] } as never,
      { onPayload: payloadSpy },
    );

    expect(payloadSpy).toHaveBeenCalledWith({ messages: [{ role: "user", content: "hello" }] });

    const resolvedStream = stream instanceof Promise ? await stream : stream;
    const events: unknown[] = [];
    for await (const event of resolvedStream) {
      events.push(event);
    }
    expect(events).toHaveLength(2);
    expect((events[0] as { type: string }).type).toBe("start");
    expect((events[1] as { type: string }).type).toBe("done");
  });

  it("handles async streamFn (Promise return)", async () => {
    const mockStream = createMockStream([
      { type: "start", partial: { role: "assistant", content: [] } },
      { type: "done", reason: "stop", message: { role: "assistant", content: [] } },
    ]);

    const baseFn: StreamFn = async () => mockStream;

    const wrapped = wrapStreamFnWithModelApiLogging(baseFn, {
      modelId: "async-model",
      provider: "async-provider",
    });

    const maybeStream = wrapped(
      { id: "test", api: "openai-responses" } as never,
      { systemPrompt: "", messages: [] } as never,
    );

    expect(maybeStream).toBeInstanceOf(Promise);
    const resolvedStream = await maybeStream;
    const events: unknown[] = [];
    for await (const event of resolvedStream) {
      events.push(event);
    }
    expect(events).toHaveLength(2);
  });

  it("forwards original onPayload callback", () => {
    const originalOnPayload = vi.fn();
    const mockStream = createMockStream([
      { type: "done", reason: "stop", message: { role: "assistant", content: [] } },
    ]);

    const baseFn: StreamFn = (_model, _context, options) => {
      options?.onPayload?.({ test: true });
      return mockStream;
    };

    const wrapped = wrapStreamFnWithModelApiLogging(baseFn, { modelId: "m" });
    wrapped(
      { id: "test", api: "openai-responses" } as never,
      { systemPrompt: "", messages: [] } as never,
      { onPayload: originalOnPayload },
    );

    expect(originalOnPayload).toHaveBeenCalledWith({ test: true });
  });

  it("tracks text_delta characters for response size", async () => {
    const mockStream = createMockStream([
      { type: "start", partial: { role: "assistant", content: [] } },
      { type: "text_delta", contentIndex: 0, delta: "Hello", partial: { role: "assistant", content: [] } },
      { type: "text_delta", contentIndex: 0, delta: " world!", partial: { role: "assistant", content: [] } },
      { type: "done", reason: "stop", message: { role: "assistant", content: [{ type: "text", text: "Hello world!" }] } },
    ]);

    const baseFn: StreamFn = () => mockStream;
    const wrapped = wrapStreamFnWithModelApiLogging(baseFn, { modelId: "m" });

    const stream = wrapped(
      { id: "test", api: "openai-responses" } as never,
      { systemPrompt: "", messages: [] } as never,
    );

    const resolvedStream = stream instanceof Promise ? await stream : stream;
    const events: unknown[] = [];
    for await (const event of resolvedStream) {
      events.push(event);
    }
    expect(events).toHaveLength(4);
  });
});
