import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const spawnSyncMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({
  spawnSync: (...args: unknown[]) => spawnSyncMock(...args),
}));

vi.mock("./restart-stale-pids.js", () => ({
  cleanStaleGatewayProcessesSync: vi.fn(() => []),
  findGatewayPidsOnPortSync: vi.fn(() => []),
}));

vi.mock("../daemon/constants.js", () => ({
  resolveGatewayLaunchAgentLabel: () => "com.openclaw.gateway",
  resolveGatewaySystemdServiceName: () => "openclaw-gateway",
}));

vi.mock("../logging/subsystem.js", () => ({
  createSubsystemLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { triggerOpenClawRestart } from "./restart.js";

describe.runIf(process.platform === "darwin")("triggerOpenClawRestart (macOS)", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    spawnSyncMock.mockReset();
    delete process.env.VITEST;
    delete process.env.NODE_ENV;
    process.env.HOME = "/Users/test";
  });

  afterEach(() => {
    Object.assign(process.env, origEnv);
  });

  it("returns ok when kickstart succeeds", () => {
    spawnSyncMock.mockReturnValue({ error: undefined, status: 0, stdout: "", stderr: "" });

    const result = triggerOpenClawRestart();
    expect(result.ok).toBe(true);
    expect(result.method).toBe("launchctl");
  });

  it("returns ok when bootstrap succeeds even if retry kickstart times out", () => {
    let callIdx = 0;
    spawnSyncMock.mockImplementation((_cmd: string, args: string[]) => {
      callIdx++;
      if (callIdx === 1) {
        return { error: new Error("spawnSync launchctl ETIMEDOUT"), status: null };
      }
      if (args[0] === "bootstrap") {
        return { error: undefined, status: 0, stdout: "", stderr: "" };
      }
      return { error: new Error("spawnSync launchctl ETIMEDOUT"), status: null };
    });

    const result = triggerOpenClawRestart();
    expect(result.ok).toBe(true);
    expect(result.method).toBe("launchctl");
  });

  it("returns not-ok when both kickstart and bootstrap fail", () => {
    spawnSyncMock.mockReturnValue({
      error: new Error("spawnSync launchctl ETIMEDOUT"),
      status: null,
    });

    const result = triggerOpenClawRestart();
    expect(result.ok).toBe(false);
  });

  it("uses 15s timeout for spawnSync calls", () => {
    spawnSyncMock.mockReturnValue({ error: undefined, status: 0, stdout: "", stderr: "" });

    triggerOpenClawRestart();

    const timeoutArg = spawnSyncMock.mock.calls[0]?.[2]?.timeout;
    expect(timeoutArg).toBe(15_000);
  });
});
