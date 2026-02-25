import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadCronStore, resolveCronStorePath } from "./store.js";

async function makeStorePath() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-cron-store-"));
  return {
    dir,
    storePath: path.join(dir, "jobs.json"),
    cleanup: async () => {
      await fs.rm(dir, { recursive: true, force: true });
    },
  };
}

describe("resolveCronStorePath", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses OPENCLAW_HOME for tilde expansion", () => {
    vi.stubEnv("OPENCLAW_HOME", "/srv/openclaw-home");
    vi.stubEnv("HOME", "/home/other");

    const result = resolveCronStorePath("~/cron/jobs.json");
    expect(result).toBe(path.resolve("/srv/openclaw-home", "cron", "jobs.json"));
  });
});

describe("cron store", () => {
  it("returns empty store when file does not exist", async () => {
    const store = await makeStorePath();
    const loaded = await loadCronStore(store.storePath);
    expect(loaded).toEqual({ version: 1, jobs: [] });
    await store.cleanup();
  });

  it("throws when store contains invalid JSON", async () => {
    const store = await makeStorePath();
    await fs.writeFile(store.storePath, "{ not json", "utf-8");
    await expect(loadCronStore(store.storePath)).rejects.toThrow(/Failed to parse cron store/i);
    await store.cleanup();
  });

  it("normalizes legacy jobId field to id", async () => {
    const store = await makeStorePath();
    await fs.writeFile(
      store.storePath,
      JSON.stringify({
        version: 1,
        jobs: [{ jobId: "legacy-job-1", name: "Legacy", enabled: true }],
      }),
      "utf-8",
    );
    const loaded = await loadCronStore(store.storePath);
    expect(loaded.jobs).toHaveLength(1);
    const job = loaded.jobs[0] as Record<string, unknown>;
    expect(job.id).toBe("legacy-job-1");
    expect(job.jobId).toBeUndefined();
    await store.cleanup();
  });

  it("preserves id when both id and jobId are present", async () => {
    const store = await makeStorePath();
    await fs.writeFile(
      store.storePath,
      JSON.stringify({
        version: 1,
        jobs: [{ id: "canonical-id", jobId: "legacy-id", name: "Both", enabled: true }],
      }),
      "utf-8",
    );
    const loaded = await loadCronStore(store.storePath);
    const job = loaded.jobs[0] as Record<string, unknown>;
    expect(job.id).toBe("canonical-id");
    await store.cleanup();
  });
});
