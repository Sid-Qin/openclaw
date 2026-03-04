import { describe, expect, it, vi } from "vitest";
import { DiscordMessageListener } from "./listeners.js";

function createLogger() {
  return {
    error: vi.fn(),
    warn: vi.fn(),
  };
}

function fakeEvent(channelId: string) {
  return { channel_id: channelId } as never;
}

describe("DiscordMessageListener", () => {
  it("awaits handler completion before returning", async () => {
    let handlerFinished = false;
    const handler = vi.fn(async () => {
      await new Promise<void>((r) => setTimeout(r, 10));
      handlerFinished = true;
    });
    const logger = createLogger();
    const listener = new DiscordMessageListener(handler as never, logger as never);

    await listener.handle(fakeEvent("ch-1"), {} as never);
    expect(handlerFinished).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("serializes queued handler runs for the same channel", async () => {
    const order: string[] = [];
    let firstResolve: (() => void) | undefined;
    const firstDone = new Promise<void>((resolve) => {
      firstResolve = resolve;
    });
    let runCount = 0;
    const handler = vi.fn(async () => {
      runCount += 1;
      const n = runCount;
      order.push(`start:${n}`);
      if (n === 1) {
        await firstDone;
      }
      order.push(`end:${n}`);
    });
    const listener = new DiscordMessageListener(handler as never, createLogger() as never);

    const p1 = listener.handle(fakeEvent("ch-1"), {} as never);
    const p2 = listener.handle(fakeEvent("ch-1"), {} as never);

    await vi.waitFor(() => {
      expect(order).toContain("start:1");
    });
    expect(order).not.toContain("start:2");

    firstResolve?.();
    await Promise.all([p1, p2]);
    expect(order).toEqual(["start:1", "end:1", "start:2", "end:2"]);
  });

  it("runs handlers for different channels in parallel", async () => {
    let resolveA: (() => void) | undefined;
    let resolveB: (() => void) | undefined;
    const doneA = new Promise<void>((r) => {
      resolveA = r;
    });
    const doneB = new Promise<void>((r) => {
      resolveB = r;
    });
    const order: string[] = [];
    const handler = vi.fn(async (data: { channel_id: string }) => {
      order.push(`start:${data.channel_id}`);
      if (data.channel_id === "ch-a") {
        await doneA;
      } else {
        await doneB;
      }
      order.push(`end:${data.channel_id}`);
    });
    const listener = new DiscordMessageListener(handler as never, createLogger() as never);

    const pA = listener.handle(fakeEvent("ch-a"), {} as never);
    const pB = listener.handle(fakeEvent("ch-b"), {} as never);

    await vi.waitFor(() => {
      expect(handler).toHaveBeenCalledTimes(2);
    });
    expect(order).toContain("start:ch-a");
    expect(order).toContain("start:ch-b");

    resolveB?.();
    await vi.waitFor(() => {
      expect(order).toContain("end:ch-b");
    });
    expect(order).not.toContain("end:ch-a");

    resolveA?.();
    await Promise.all([pA, pB]);
    expect(order).toContain("end:ch-a");
  });

  it("logs handler failures without throwing", async () => {
    const handler = vi.fn(async () => {
      throw new Error("boom");
    });
    const logger = createLogger();
    const listener = new DiscordMessageListener(handler as never, logger as never);

    await expect(listener.handle(fakeEvent("ch-1"), {} as never)).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("discord handler failed: Error: boom"),
    );
  });

  it("processes the next message after a handler error on the same channel", async () => {
    let callCount = 0;
    const handler = vi.fn(async () => {
      callCount += 1;
      if (callCount === 1) {
        throw new Error("transient failure");
      }
    });
    const logger = createLogger();
    const listener = new DiscordMessageListener(handler as never, logger as never);

    await listener.handle(fakeEvent("ch-1"), {} as never);
    expect(logger.error).toHaveBeenCalledTimes(1);

    await listener.handle(fakeEvent("ch-1"), {} as never);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
