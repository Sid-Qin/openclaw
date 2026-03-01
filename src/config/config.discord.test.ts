import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig, validateConfigObject } from "./config.js";
import { withTempHomeConfig } from "./test-helpers.js";

describe("config discord", () => {
  let previousHome: string | undefined;

  beforeEach(() => {
    previousHome = process.env.HOME;
  });

  afterEach(() => {
    process.env.HOME = previousHome;
  });

  it("loads discord guild map + dm group settings", async () => {
    await withTempHomeConfig(
      {
        channels: {
          discord: {
            enabled: true,
            dm: {
              enabled: true,
              allowFrom: ["steipete"],
              groupEnabled: true,
              groupChannels: ["openclaw-dm"],
            },
            actions: {
              emojiUploads: true,
              stickerUploads: false,
              channels: true,
            },
            guilds: {
              "123": {
                slug: "friends-of-openclaw",
                requireMention: false,
                users: ["steipete"],
                channels: {
                  general: { allow: true },
                },
              },
            },
          },
        },
      },
      async () => {
        const cfg = loadConfig();

        expect(cfg.channels?.discord?.enabled).toBe(true);
        expect(cfg.channels?.discord?.dm?.groupEnabled).toBe(true);
        expect(cfg.channels?.discord?.dm?.groupChannels).toEqual(["openclaw-dm"]);
        expect(cfg.channels?.discord?.actions?.emojiUploads).toBe(true);
        expect(cfg.channels?.discord?.actions?.stickerUploads).toBe(false);
        expect(cfg.channels?.discord?.actions?.channels).toBe(true);
        expect(cfg.channels?.discord?.guilds?.["123"]?.slug).toBe("friends-of-openclaw");
        expect(cfg.channels?.discord?.guilds?.["123"]?.channels?.general?.allow).toBe(true);
      },
    );
  });

  it("rejects numeric discord allowlist entries", () => {
    const res = validateConfigObject({
      channels: {
        discord: {
          allowFrom: [123],
          dm: { allowFrom: [456], groupChannels: [789] },
          guilds: {
            "123": {
              users: [111],
              roles: [222],
              channels: {
                general: { users: [333], roles: [444] },
              },
            },
          },
          execApprovals: { approvers: [555] },
        },
      },
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(
        res.issues.some((issue) => issue.message.includes("Discord IDs must be strings")),
      ).toBe(true);
    }
  });

  it("strips unsupported discord channel keys from legacy config writes", async () => {
    await withTempHomeConfig(
      {
        channels: {
          discord: {
            guilds: {
              "123": {
                channels: {
                  general: {
                    allow: true,
                    model: "anthropic/claude-sonnet-4-5",
                    groupPolicy: "open",
                    allowFrom: ["user:123"],
                  },
                },
              },
            },
            accounts: {
              work: {
                guilds: {
                  "999": {
                    channels: {
                      ops: {
                        allow: true,
                        model: "anthropic/claude-opus-4-5",
                        groupPolicy: "allowlist",
                        allowFrom: ["user:999"],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      async () => {
        const cfg = loadConfig();
        const baseChannel = cfg.channels?.discord?.guilds?.["123"]?.channels?.general as
          | Record<string, unknown>
          | undefined;
        expect(baseChannel?.allow).toBe(true);
        expect(baseChannel && "model" in baseChannel).toBe(false);
        expect(baseChannel && "groupPolicy" in baseChannel).toBe(false);
        expect(baseChannel && "allowFrom" in baseChannel).toBe(false);

        const accountChannel = cfg.channels?.discord?.accounts?.work?.guilds?.["999"]?.channels
          ?.ops as Record<string, unknown> | undefined;
        expect(accountChannel?.allow).toBe(true);
        expect(accountChannel && "model" in accountChannel).toBe(false);
        expect(accountChannel && "groupPolicy" in accountChannel).toBe(false);
        expect(accountChannel && "allowFrom" in accountChannel).toBe(false);
      },
    );
  });
});
