import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { CronService } from "./service.js";
import { loadCronStore } from "./store.js";

const noopLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  trace: () => {},
};

describe("CronService.flush", () => {
  let fixtureRoot: string;

  beforeAll(async () => {
    fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cron-flush-"));
  });

  afterAll(async () => {
    await fs.rm(fixtureRoot, { recursive: true, force: true });
  });

  it("persists newly added jobs before stop", async () => {
    const storePath = path.join(fixtureRoot, "flush-test.json");
    const cron = new CronService({
      cronEnabled: true,
      storePath,
      log: noopLogger,
      enqueueSystemEvent: vi.fn() as never,
      requestHeartbeatNow: vi.fn() as never,
      runIsolatedAgentJob: vi.fn().mockResolvedValue({ status: "ok", summary: "ok" }) as never,
    });
    await cron.start();

    await cron.add({
      name: "flush-test-job",
      schedule: { kind: "at", at: new Date(Date.now() + 3_600_000).toISOString() },
      sessionTarget: "isolated",
      payload: { kind: "agentTurn", message: "hello" },
      delivery: { mode: "none" },
    });

    await cron.flush();
    cron.stop();

    const loaded = await loadCronStore(storePath);
    const job = loaded.jobs.find((j) => j.name === "flush-test-job");
    expect(job).toBeDefined();
    expect(job?.name).toBe("flush-test-job");
  });
});
