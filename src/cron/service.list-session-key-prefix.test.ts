import { describe, expect, it, vi } from "vitest";
import { CronService } from "./service.js";
import { setupCronServiceSuite } from "./service.test-harness.js";

const { logger, makeStorePath } = setupCronServiceSuite({
  prefix: "openclaw-cron-skprefix-",
  baseTimeIso: "2026-03-02T00:00:00.000Z",
});

function createCron(storePath: string) {
  return new CronService({
    storePath,
    cronEnabled: true,
    log: logger,
    enqueueSystemEvent: vi.fn(),
    requestHeartbeatNow: vi.fn(),
    runIsolatedAgentJob: vi.fn(async () => ({ status: "ok" as const })),
  });
}

describe("cron.listPage sessionKeyPrefix filter", () => {
  it("returns all jobs when sessionKeyPrefix is not provided", async () => {
    const store = await makeStorePath();
    const cron = createCron(store.storePath);
    await cron.start();

    await cron.add({
      name: "job-a",
      enabled: true,
      schedule: { kind: "cron", expr: "0 8 * * *" },
      sessionTarget: "main",
      wakeMode: "now",
      payload: { kind: "systemEvent", text: "a" },
      sessionKey: "agent:main:telegram:group:111",
    });
    await cron.add({
      name: "job-b",
      enabled: true,
      schedule: { kind: "cron", expr: "0 9 * * *" },
      sessionTarget: "main",
      wakeMode: "now",
      payload: { kind: "systemEvent", text: "b" },
      sessionKey: "agent:main:discord:channel:222",
    });

    const page = await cron.listPage({});
    expect(page.jobs).toHaveLength(2);

    cron.stop();
  });

  it("filters jobs by sessionKeyPrefix", async () => {
    const store = await makeStorePath();
    const cron = createCron(store.storePath);
    await cron.start();

    await cron.add({
      name: "telegram-job",
      enabled: true,
      schedule: { kind: "cron", expr: "0 8 * * *" },
      sessionTarget: "main",
      wakeMode: "now",
      payload: { kind: "systemEvent", text: "tg" },
      sessionKey: "agent:main:telegram:group:111",
    });
    await cron.add({
      name: "discord-job",
      enabled: true,
      schedule: { kind: "cron", expr: "0 9 * * *" },
      sessionTarget: "main",
      wakeMode: "now",
      payload: { kind: "systemEvent", text: "dc" },
      sessionKey: "agent:main:discord:channel:222",
    });
    await cron.add({
      name: "telegram-job-2",
      enabled: true,
      schedule: { kind: "cron", expr: "0 10 * * *" },
      sessionTarget: "main",
      wakeMode: "now",
      payload: { kind: "systemEvent", text: "tg2" },
      sessionKey: "agent:main:telegram:group:333",
    });

    const page = await cron.listPage({
      sessionKeyPrefix: "agent:main:telegram",
    });
    expect(page.jobs).toHaveLength(2);
    expect(page.jobs.map((j) => j.name).toSorted()).toEqual(["telegram-job", "telegram-job-2"]);

    const discordPage = await cron.listPage({
      sessionKeyPrefix: "agent:main:discord",
    });
    expect(discordPage.jobs).toHaveLength(1);
    expect(discordPage.jobs[0].name).toBe("discord-job");

    cron.stop();
  });

  it("sessionKeyPrefix matching is case-insensitive", async () => {
    const store = await makeStorePath();
    const cron = createCron(store.storePath);
    await cron.start();

    await cron.add({
      name: "mixed-case-job",
      enabled: true,
      schedule: { kind: "cron", expr: "0 8 * * *" },
      sessionTarget: "main",
      wakeMode: "now",
      payload: { kind: "systemEvent", text: "mc" },
      sessionKey: "Agent:Main:Telegram:Group:111",
    });

    const page = await cron.listPage({
      sessionKeyPrefix: "agent:main:telegram",
    });
    expect(page.jobs).toHaveLength(1);
    expect(page.jobs[0].name).toBe("mixed-case-job");

    cron.stop();
  });

  it("returns empty when no jobs match sessionKeyPrefix", async () => {
    const store = await makeStorePath();
    const cron = createCron(store.storePath);
    await cron.start();

    await cron.add({
      name: "telegram-only",
      enabled: true,
      schedule: { kind: "cron", expr: "0 8 * * *" },
      sessionTarget: "main",
      wakeMode: "now",
      payload: { kind: "systemEvent", text: "tg" },
      sessionKey: "agent:main:telegram:group:111",
    });

    const page = await cron.listPage({
      sessionKeyPrefix: "agent:main:slack",
    });
    expect(page.jobs).toHaveLength(0);
    expect(page.total).toBe(0);

    cron.stop();
  });
});
