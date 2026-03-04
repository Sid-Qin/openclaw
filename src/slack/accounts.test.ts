import { describe, expect, it } from "vitest";
import { resolveSlackAccount } from "./accounts.js";

describe("resolveSlackAccount allowFrom precedence", () => {
  it("prefers accounts.default.allowFrom over top-level for default account", () => {
    const resolved = resolveSlackAccount({
      cfg: {
        channels: {
          slack: {
            allowFrom: ["top"],
            accounts: {
              default: {
                botToken: "xoxb-default",
                appToken: "xapp-default",
                allowFrom: ["default"],
              },
            },
          },
        },
      },
      accountId: "default",
    });

    expect(resolved.config.allowFrom).toEqual(["default"]);
  });

  it("falls back to top-level allowFrom for named account without override", () => {
    const resolved = resolveSlackAccount({
      cfg: {
        channels: {
          slack: {
            allowFrom: ["top"],
            accounts: {
              work: { botToken: "xoxb-work", appToken: "xapp-work" },
            },
          },
        },
      },
      accountId: "work",
    });

    expect(resolved.config.allowFrom).toEqual(["top"]);
  });

  it("does not inherit default account allowFrom for named account when top-level is absent", () => {
    const resolved = resolveSlackAccount({
      cfg: {
        channels: {
          slack: {
            accounts: {
              default: {
                botToken: "xoxb-default",
                appToken: "xapp-default",
                allowFrom: ["default"],
              },
              work: { botToken: "xoxb-work", appToken: "xapp-work" },
            },
          },
        },
      },
      accountId: "work",
    });

    expect(resolved.config.allowFrom).toBeUndefined();
  });

  it("falls back to top-level dm.allowFrom when allowFrom alias is unset", () => {
    const resolved = resolveSlackAccount({
      cfg: {
        channels: {
          slack: {
            dm: { allowFrom: ["U123"] },
            accounts: {
              work: { botToken: "xoxb-work", appToken: "xapp-work" },
            },
          },
        },
      },
      accountId: "work",
    });

    expect(resolved.config.allowFrom).toBeUndefined();
    expect(resolved.config.dm?.allowFrom).toEqual(["U123"]);
  });
});

describe("resolveSlackAccount unfurl config", () => {
  it("resolves unfurlLinks and unfurlMedia from account config", () => {
    const resolved = resolveSlackAccount({
      cfg: {
        channels: {
          slack: {
            unfurlLinks: false,
            unfurlMedia: false,
            accounts: {
              default: { botToken: "xoxb-1", appToken: "xapp-1" },
            },
          },
        },
      },
      accountId: "default",
    });

    expect(resolved.config.unfurlLinks).toBe(false);
    expect(resolved.config.unfurlMedia).toBe(false);
  });

  it("defaults unfurl to undefined when not configured", () => {
    const resolved = resolveSlackAccount({
      cfg: {
        channels: {
          slack: {
            accounts: {
              default: { botToken: "xoxb-1", appToken: "xapp-1" },
            },
          },
        },
      },
      accountId: "default",
    });

    expect(resolved.config.unfurlLinks).toBeUndefined();
    expect(resolved.config.unfurlMedia).toBeUndefined();
  });
});
