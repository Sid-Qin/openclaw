import { describe, expect, it, vi } from "vitest";
import { collectConfigConflicts, logGatewayStartup } from "./server-startup-log.js";

describe("gateway startup log", () => {
  it("warns when dangerous config flags are enabled", () => {
    const info = vi.fn();
    const warn = vi.fn();

    logGatewayStartup({
      cfg: {
        gateway: {
          controlUi: {
            dangerouslyDisableDeviceAuth: true,
          },
        },
      },
      bindHost: "127.0.0.1",
      port: 18789,
      log: { info, warn },
      isNixMode: false,
    });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("dangerous config flags enabled"));
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("gateway.controlUi.dangerouslyDisableDeviceAuth=true"),
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("openclaw security audit"));
  });

  it("does not warn when dangerous config flags are disabled", () => {
    const info = vi.fn();
    const warn = vi.fn();

    logGatewayStartup({
      cfg: {},
      bindHost: "127.0.0.1",
      port: 18789,
      log: { info, warn },
      isNixMode: false,
    });

    expect(warn).not.toHaveBeenCalled();
  });

  it("warns on exec/sandbox config conflicts", () => {
    const info = vi.fn();
    const warn = vi.fn();

    logGatewayStartup({
      cfg: {
        tools: {
          exec: { ask: "off" },
        },
        agents: {
          defaults: {
            sandbox: { mode: "non-main" },
          },
        },
      },
      bindHost: "127.0.0.1",
      port: 18789,
      log: { info, warn },
      isNixMode: false,
    });

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('tools.exec.ask is "off" but agents.defaults.sandbox.mode is'),
    );
  });

  it("logs all listen endpoints on a single line", () => {
    const info = vi.fn();
    const warn = vi.fn();

    logGatewayStartup({
      cfg: {},
      bindHost: "127.0.0.1",
      bindHosts: ["127.0.0.1", "::1"],
      port: 18789,
      log: { info, warn },
      isNixMode: false,
    });

    const listenMessages = info.mock.calls
      .map((call) => call[0])
      .filter((message) => message.startsWith("listening on "));
    expect(listenMessages).toEqual([
      `listening on ws://127.0.0.1:18789, ws://[::1]:18789 (PID ${process.pid})`,
    ]);
  });
});

describe("collectConfigConflicts", () => {
  it("detects exec.ask=off with sandbox.mode=non-main", () => {
    const conflicts = collectConfigConflicts({
      tools: { exec: { ask: "off" } },
      agents: { defaults: { sandbox: { mode: "non-main" } } },
    });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toContain("tools.exec.ask");
    expect(conflicts[0]).toContain("non-main");
  });

  it("detects exec.security=full with sandbox.mode=non-main", () => {
    const conflicts = collectConfigConflicts({
      tools: { exec: { security: "full" } },
      agents: { defaults: { sandbox: { mode: "non-main" } } },
    });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toContain("tools.exec.security");
  });

  it("detects exec.host=gateway with sandbox.mode=non-main", () => {
    const conflicts = collectConfigConflicts({
      tools: { exec: { host: "gateway" } },
      agents: { defaults: { sandbox: { mode: "non-main" } } },
    });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toContain("tools.exec.host");
  });

  it("returns no conflicts when sandbox.mode=off", () => {
    const conflicts = collectConfigConflicts({
      tools: { exec: { ask: "off", security: "full" } },
      agents: { defaults: { sandbox: { mode: "off" } } },
    });
    expect(conflicts).toHaveLength(0);
  });

  it("returns no conflicts when exec config is default", () => {
    const conflicts = collectConfigConflicts({});
    expect(conflicts).toHaveLength(0);
  });
});
