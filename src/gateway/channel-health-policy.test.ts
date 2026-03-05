import { describe, expect, it } from "vitest";
import {
  DEFAULT_BUSY_ACTIVITY_STALE_THRESHOLD_MS,
  evaluateChannelHealth,
  resolveChannelRestartReason,
} from "./channel-health-policy.js";

const BUSY_STALE_MS = DEFAULT_BUSY_ACTIVITY_STALE_THRESHOLD_MS;

describe("evaluateChannelHealth", () => {
  it("treats disabled accounts as healthy unmanaged", () => {
    const evaluation = evaluateChannelHealth(
      {
        running: false,
        enabled: false,
        configured: true,
      },
      {
        now: 100_000,
        channelConnectGraceMs: 10_000,
        staleEventThresholdMs: 30_000,
        busyActivityStaleThresholdMs: BUSY_STALE_MS,
      },
    );
    expect(evaluation).toEqual({ healthy: true, reason: "unmanaged" });
  });

  it("uses channel connect grace before flagging disconnected", () => {
    const evaluation = evaluateChannelHealth(
      {
        running: true,
        connected: false,
        enabled: true,
        configured: true,
        lastStartAt: 95_000,
      },
      {
        now: 100_000,
        channelConnectGraceMs: 10_000,
        staleEventThresholdMs: 30_000,
        busyActivityStaleThresholdMs: BUSY_STALE_MS,
      },
    );
    expect(evaluation).toEqual({ healthy: true, reason: "startup-connect-grace" });
  });

  it("treats active runs as busy even when disconnected", () => {
    const now = 100_000;
    const evaluation = evaluateChannelHealth(
      {
        running: true,
        connected: false,
        enabled: true,
        configured: true,
        activeRuns: 1,
        lastRunActivityAt: now - 30_000,
      },
      {
        now,
        channelConnectGraceMs: 10_000,
        staleEventThresholdMs: 30_000,
        busyActivityStaleThresholdMs: BUSY_STALE_MS,
      },
    );
    expect(evaluation).toEqual({ healthy: true, reason: "busy" });
  });

  it("flags stale busy channels as stuck when run activity exceeds threshold", () => {
    const now = 100_000;
    const evaluation = evaluateChannelHealth(
      {
        running: true,
        connected: false,
        enabled: true,
        configured: true,
        activeRuns: 1,
        lastRunActivityAt: now - BUSY_STALE_MS - 1,
      },
      {
        now,
        channelConnectGraceMs: 10_000,
        staleEventThresholdMs: 30_000,
        busyActivityStaleThresholdMs: BUSY_STALE_MS,
      },
    );
    expect(evaluation).toEqual({ healthy: false, reason: "stuck" });
  });

  it("ignores inherited busy flags until current lifecycle reports run activity", () => {
    const now = 100_000;
    const evaluation = evaluateChannelHealth(
      {
        running: true,
        connected: false,
        enabled: true,
        configured: true,
        lastStartAt: now - 30_000,
        busy: true,
        activeRuns: 1,
        lastRunActivityAt: now - 31_000,
      },
      {
        now,
        channelConnectGraceMs: 10_000,
        staleEventThresholdMs: 30_000,
        busyActivityStaleThresholdMs: BUSY_STALE_MS,
      },
    );
    expect(evaluation).toEqual({ healthy: false, reason: "disconnected" });
  });

  it("flags stale sockets when no events arrive beyond threshold", () => {
    const evaluation = evaluateChannelHealth(
      {
        running: true,
        connected: true,
        enabled: true,
        configured: true,
        lastStartAt: 0,
        lastEventAt: null,
      },
      {
        now: 100_000,
        channelConnectGraceMs: 10_000,
        staleEventThresholdMs: 30_000,
        busyActivityStaleThresholdMs: BUSY_STALE_MS,
      },
    );
    expect(evaluation).toEqual({ healthy: false, reason: "stale-socket" });
  });

  it("allows custom busyActivityStaleThresholdMs to extend tolerance (#36017)", () => {
    const now = 100_000;
    const customThreshold = 60 * 60_000;
    const evaluation = evaluateChannelHealth(
      {
        running: true,
        connected: true,
        enabled: true,
        configured: true,
        activeRuns: 1,
        lastRunActivityAt: now - 50 * 60_000,
      },
      {
        now,
        channelConnectGraceMs: 10_000,
        staleEventThresholdMs: 30_000,
        busyActivityStaleThresholdMs: customThreshold,
      },
    );
    expect(evaluation).toEqual({ healthy: true, reason: "busy" });
  });
});

describe("resolveChannelRestartReason", () => {
  it("maps not-running + high reconnect attempts to gave-up", () => {
    const reason = resolveChannelRestartReason(
      {
        running: false,
        reconnectAttempts: 10,
      },
      { healthy: false, reason: "not-running" },
    );
    expect(reason).toBe("gave-up");
  });
});
