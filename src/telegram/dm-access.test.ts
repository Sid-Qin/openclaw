import type { Message } from "@grammyjs/types";
import { describe, expect, it, vi } from "vitest";
import type { NormalizedAllowFrom } from "./bot-access.js";
import { enforceTelegramDmAccess } from "./dm-access.js";

vi.mock("../globals.js", () => ({ logVerbose: vi.fn() }));
vi.mock("../pairing/pairing-store.js", () => ({
  upsertChannelPairingRequest: vi.fn(async () => ({ code: "ABC123", created: true })),
}));

function makeMsg(userId: number): Message {
  return {
    message_id: 1,
    date: Date.now(),
    chat: { id: userId, type: "private" },
    from: { id: userId, is_bot: false, first_name: "Test" },
  } as Message;
}

const emptyAllow: NormalizedAllowFrom = {
  entries: [],
  hasWildcard: false,
  hasEntries: false,
  invalidEntries: [],
};

const withEntries: NormalizedAllowFrom = {
  entries: ["999"],
  hasWildcard: false,
  hasEntries: true,
  invalidEntries: [],
};

const botStub = {
  api: { sendMessage: vi.fn(async () => ({})) },
} as unknown as Parameters<typeof enforceTelegramDmAccess>[0]["bot"];

const loggerStub = { info: vi.fn() };

describe("enforceTelegramDmAccess", () => {
  it("falls back to pairing when allowlist policy has no entries", async () => {
    const result = await enforceTelegramDmAccess({
      isGroup: false,
      dmPolicy: "allowlist",
      msg: makeMsg(12345),
      chatId: 12345,
      effectiveDmAllow: emptyAllow,
      accountId: "bot1",
      bot: botStub,
      logger: loggerStub,
    });

    expect(result).toBe(false);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(botStub.api.sendMessage).toHaveBeenCalled();
  });

  it("blocks when allowlist policy has entries but sender is not listed", async () => {
    const result = await enforceTelegramDmAccess({
      isGroup: false,
      dmPolicy: "allowlist",
      msg: makeMsg(12345),
      chatId: 12345,
      effectiveDmAllow: withEntries,
      accountId: "bot1",
      bot: botStub,
      logger: loggerStub,
    });

    expect(result).toBe(false);
  });
});
