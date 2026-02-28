import type { MessageEvent } from "@line/bot-sdk";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  downloadLineMedia: vi.fn(),
  buildLineMessageContext: vi.fn(async () => ({
    ctxPayload: { From: "line:user:user-1" },
    replyToken: "reply-token",
    route: { agentId: "default" },
    isGroup: false,
    accountId: "default",
  })),
  buildLinePostbackContext: vi.fn(async () => null),
  readAllowFromStore: vi.fn(async () => [] as string[]),
  upsertPairingRequest: vi.fn(async () => ({ code: "CODE", created: true })),
}));

vi.mock("../globals.js", () => ({
  danger: (text: string) => text,
  logVerbose: () => {},
}));

vi.mock("../pairing/pairing-labels.js", () => ({
  resolvePairingIdLabel: () => "lineUserId",
}));

vi.mock("../pairing/pairing-messages.js", () => ({
  buildPairingReply: () => "pairing-reply",
}));

vi.mock("../pairing/pairing-store.js", () => ({
  readChannelAllowFromStore: (...args: unknown[]) =>
    mocks.readAllowFromStore(...(args as Parameters<typeof mocks.readAllowFromStore>)),
  upsertChannelPairingRequest: (...args: unknown[]) =>
    mocks.upsertPairingRequest(...(args as Parameters<typeof mocks.upsertPairingRequest>)),
}));

vi.mock("./send.js", () => ({
  pushMessageLine: async () => {
    throw new Error("pushMessageLine should not be called in media tests");
  },
  replyMessageLine: async () => {
    throw new Error("replyMessageLine should not be called in media tests");
  },
}));

vi.mock("./download.js", () => ({
  downloadLineMedia: (...args: unknown[]) =>
    mocks.downloadLineMedia(...(args as Parameters<typeof mocks.downloadLineMedia>)),
}));

vi.mock("./bot-message-context.js", () => ({
  buildLineMessageContext: (...args: unknown[]) =>
    mocks.buildLineMessageContext(...(args as Parameters<typeof mocks.buildLineMessageContext>)),
  buildLinePostbackContext: (...args: unknown[]) =>
    mocks.buildLinePostbackContext(...(args as Parameters<typeof mocks.buildLinePostbackContext>)),
  getLineSourceInfo: (source: {
    type?: string;
    userId?: string;
    groupId?: string;
    roomId?: string;
  }) => ({
    userId: source.userId,
    groupId: source.type === "group" ? source.groupId : undefined,
    roomId: source.type === "room" ? source.roomId : undefined,
    isGroup: source.type === "group" || source.type === "room",
  }),
}));

let handleLineWebhookEvents: typeof import("./bot-handlers.js").handleLineWebhookEvents;

const createRuntime = () => ({ log: vi.fn(), error: vi.fn(), exit: vi.fn() });

describe("handleLineWebhookEvents LINE media download", () => {
  beforeAll(async () => {
    ({ handleLineWebhookEvents } = await import("./bot-handlers.js"));
  });

  beforeEach(() => {
    mocks.downloadLineMedia.mockReset();
    mocks.buildLineMessageContext.mockClear();
    mocks.buildLinePostbackContext.mockClear();
    mocks.readAllowFromStore.mockClear();
    mocks.upsertPairingRequest.mockClear();
    mocks.downloadLineMedia.mockResolvedValue({
      path: "/tmp/line-file.pdf",
      contentType: "application/pdf",
    });
  });

  it("downloads LINE file messages and forwards media refs", async () => {
    const processMessage = vi.fn();
    const event = {
      type: "message",
      message: {
        id: "file-1",
        type: "file",
        fileName: "demo.pdf",
        fileSize: "123",
      },
      replyToken: "reply-token",
      timestamp: Date.now(),
      source: { type: "user", userId: "user-1" },
      mode: "active",
      webhookEventId: "evt-file-1",
      deliveryContext: { isRedelivery: false },
    } as MessageEvent;

    await handleLineWebhookEvents([event], {
      cfg: { channels: { line: { dmPolicy: "open" } } },
      account: {
        accountId: "default",
        enabled: true,
        channelAccessToken: "token",
        channelSecret: "secret",
        tokenSource: "config",
        config: { dmPolicy: "open" },
      },
      runtime: createRuntime(),
      mediaMaxBytes: 1024,
      processMessage,
    });

    expect(mocks.downloadLineMedia).toHaveBeenCalledWith("file-1", "token", 1024);
    const calls = mocks.buildLineMessageContext.mock.calls as unknown[][];
    const firstCallArg = calls[0]?.[0] as
      | { allMedia?: Array<{ path: string; contentType?: string }> }
      | undefined;
    expect(firstCallArg?.allMedia).toEqual([
      {
        path: "/tmp/line-file.pdf",
        contentType: "application/pdf",
      },
    ]);
    expect(processMessage).toHaveBeenCalledTimes(1);
  });
});
