import { describe, expect, it, vi } from "vitest";
import { sendMessageDiscord } from "./send.js";
import { makeDiscordRest } from "./send.test-harness.js";

vi.mock("../web/media.js", async () => {
  const { discordWebMediaMockFactory } = await import("./send.test-harness.js");
  return discordWebMediaMockFactory();
});

describe("sendMessageDiscord cfg threading", () => {
  it("accepts cfg in opts without error", async () => {
    const { rest, postMock } = makeDiscordRest();
    postMock.mockResolvedValue({ id: "msg1", channel_id: "789" });

    const resolvedCfg = {
      channels: { discord: { token: "resolved-secret", enabled: true } },
    };

    const result = await sendMessageDiscord("channel:789", "hello", {
      cfg: resolvedCfg as never,
      rest,
      token: "t",
    });

    expect(result.messageId).toBe("msg1");
    expect(result.channelId).toBe("789");
  });

  it("works without cfg (backward compatible)", async () => {
    const { rest, postMock } = makeDiscordRest();
    postMock.mockResolvedValue({ id: "msg2", channel_id: "456" });

    const result = await sendMessageDiscord("channel:456", "world", {
      rest,
      token: "t",
    });

    expect(result.messageId).toBe("msg2");
    expect(result.channelId).toBe("456");
  });
});
