import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getLogger,
  getResolvedLoggerSettings,
  resetLogger,
  setLoggerOverride,
} from "../logging.js";

const DEFAULT_MAX_FILE_BYTES = 500 * 1024 * 1024;

describe("log file size cap", () => {
  let logPath = "";

  beforeEach(() => {
    logPath = path.join(os.tmpdir(), `openclaw-log-cap-${crypto.randomUUID()}.log`);
    resetLogger();
    setLoggerOverride(null);
  });

  afterEach(() => {
    resetLogger();
    setLoggerOverride(null);
    vi.restoreAllMocks();
    try {
      fs.rmSync(logPath, { force: true });
      fs.rmSync(`${logPath}.1`, { force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it("defaults maxFileBytes to 500 MB when unset", () => {
    setLoggerOverride({ level: "info", file: logPath });
    expect(getResolvedLoggerSettings().maxFileBytes).toBe(DEFAULT_MAX_FILE_BYTES);
  });

  it("uses configured maxFileBytes", () => {
    setLoggerOverride({ level: "info", file: logPath, maxFileBytes: 2048 });
    expect(getResolvedLoggerSettings().maxFileBytes).toBe(2048);
  });

  it("rotates log file when cap is reached and continues writing", () => {
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true as unknown as ReturnType<typeof process.stderr.write>);
    setLoggerOverride({ level: "info", file: logPath, maxFileBytes: 1024 });
    const logger = getLogger();

    for (let i = 0; i < 200; i++) {
      logger.error(`network-failure-${i}-${"x".repeat(80)}`);
    }

    // After multiple rotations, the current file stays bounded.
    const currentSize = fs.statSync(logPath).size;
    expect(currentSize).toBeLessThan(1024 + 512);

    // The rotated archive should exist.
    expect(fs.existsSync(`${logPath}.1`)).toBe(true);

    // Writes continue after rotation (not suppressed).
    logger.error("post-rotation-marker");
    const content = fs.readFileSync(logPath, "utf8");
    expect(content).toContain("post-rotation-marker");

    const rotationNotices = stderrSpy.mock.calls
      .map(([firstArg]) => String(firstArg))
      .filter((line) => line.includes("log file rotated"));
    expect(rotationNotices.length).toBeGreaterThanOrEqual(1);
  });
});
