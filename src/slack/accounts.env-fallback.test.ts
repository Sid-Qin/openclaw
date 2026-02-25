import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { resolveSlackAccount } from "./accounts.js";

describe("resolveSlackAccount SLACK_USER_TOKEN env fallback", () => {
  let savedUserToken: string | undefined;

  beforeEach(() => {
    savedUserToken = process.env.SLACK_USER_TOKEN;
  });

  afterEach(() => {
    if (savedUserToken === undefined) {
      delete process.env.SLACK_USER_TOKEN;
    } else {
      process.env.SLACK_USER_TOKEN = savedUserToken;
    }
  });

  it("uses SLACK_USER_TOKEN from env when config.userToken is absent", () => {
    process.env.SLACK_USER_TOKEN = "xoxp-env-token";

    const account = resolveSlackAccount({
      cfg: {
        channels: {
          slack: { botToken: "xoxb-bot" },
        },
      } as OpenClawConfig,
    });

    expect(account.config.userToken).toBe("xoxp-env-token");
  });

  it("prefers config.userToken over SLACK_USER_TOKEN env var", () => {
    process.env.SLACK_USER_TOKEN = "xoxp-env-token";

    const account = resolveSlackAccount({
      cfg: {
        channels: {
          slack: { botToken: "xoxb-bot", userToken: "xoxp-config-token" },
        },
      } as OpenClawConfig,
    });

    expect(account.config.userToken).toBe("xoxp-config-token");
  });

  it("does not use SLACK_USER_TOKEN for non-default accounts", () => {
    process.env.SLACK_USER_TOKEN = "xoxp-env-token";

    const account = resolveSlackAccount({
      cfg: {
        channels: {
          slack: {
            botToken: "xoxb-bot",
            accounts: {
              work: { botToken: "xoxb-work" },
            },
          },
        },
      } as OpenClawConfig,
      accountId: "work",
    });

    expect(account.config.userToken).toBeUndefined();
  });

  it("does not inject userToken when SLACK_USER_TOKEN is unset", () => {
    delete process.env.SLACK_USER_TOKEN;

    const account = resolveSlackAccount({
      cfg: {
        channels: {
          slack: { botToken: "xoxb-bot" },
        },
      } as OpenClawConfig,
    });

    expect(account.config.userToken).toBeUndefined();
  });
});
