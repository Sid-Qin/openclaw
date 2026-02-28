import { afterEach, describe, expect, it, vi } from "vitest";

const sendMessageSlackMock = vi.hoisted(() =>
  vi.fn(async () => ({ messageId: "123.456", channelId: "C123" })),
);

vi.mock("../send.js", () => ({
  sendMessageSlack: sendMessageSlackMock,
}));

import { deliverReplies } from "./replies.js";

describe("deliverReplies identity forwarding", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("forwards identity for text-only replies", async () => {
    await deliverReplies({
      replies: [{ text: "hello from agent" }],
      target: "channel:C123",
      token: "xoxb-test",
      accountId: "default",
      runtime: { log: vi.fn() } as any,
      textLimit: 4000,
      replyThreadTs: "1700000000.000001",
      replyToMode: "all",
      identity: {
        name: "Agent Lobster",
        avatarUrl: "https://example.com/avatar.png",
        emoji: ":lobster:",
      },
    });

    expect(sendMessageSlackMock).toHaveBeenCalledTimes(1);
    expect(sendMessageSlackMock).toHaveBeenCalledWith("channel:C123", "hello from agent", {
      token: "xoxb-test",
      threadTs: "1700000000.000001",
      accountId: "default",
      identity: {
        username: "Agent Lobster",
        iconUrl: "https://example.com/avatar.png",
        iconEmoji: ":lobster:",
      },
    });
  });

  it("forwards identity for media replies (caption and media sends)", async () => {
    await deliverReplies({
      replies: [
        {
          text: "media caption",
          mediaUrls: ["https://example.com/a.png", "https://example.com/b.png"],
        },
      ],
      target: "channel:C123",
      token: "xoxb-test",
      accountId: "default",
      runtime: { log: vi.fn() } as any,
      textLimit: 4000,
      replyThreadTs: "1700000000.000002",
      replyToMode: "all",
      identity: {
        name: "Agent Lobster",
        avatarUrl: "https://example.com/avatar.png",
        emoji: ":lobster:",
      },
    });

    expect(sendMessageSlackMock).toHaveBeenCalledTimes(2);
    expect(sendMessageSlackMock).toHaveBeenNthCalledWith(1, "channel:C123", "media caption", {
      token: "xoxb-test",
      mediaUrl: "https://example.com/a.png",
      threadTs: "1700000000.000002",
      accountId: "default",
      identity: {
        username: "Agent Lobster",
        iconUrl: "https://example.com/avatar.png",
        iconEmoji: ":lobster:",
      },
    });
    expect(sendMessageSlackMock).toHaveBeenNthCalledWith(2, "channel:C123", "", {
      token: "xoxb-test",
      mediaUrl: "https://example.com/b.png",
      threadTs: "1700000000.000002",
      accountId: "default",
      identity: {
        username: "Agent Lobster",
        iconUrl: "https://example.com/avatar.png",
        iconEmoji: ":lobster:",
      },
    });
  });
});
