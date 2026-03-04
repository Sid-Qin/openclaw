import { beforeEach, describe, expect, it, vi } from "vitest";
import { classifySignalCliLogLine } from "./daemon.js";
import { probeSignal } from "./probe.js";

const signalCheckMock = vi.fn();
const signalRpcRequestMock = vi.fn();

vi.mock("./client.js", () => ({
  signalCheck: (...args: unknown[]) => signalCheckMock(...args),
  signalRpcRequest: (...args: unknown[]) => signalRpcRequestMock(...args),
}));

describe("probeSignal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts version from {version} result", async () => {
    signalCheckMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      error: null,
    });
    signalRpcRequestMock.mockResolvedValueOnce({ version: "0.13.22" });

    const res = await probeSignal("http://127.0.0.1:8080", 1000);

    expect(res.ok).toBe(true);
    expect(res.version).toBe("0.13.22");
    expect(res.status).toBe(200);
  });

  it("returns ok=true when /check fails but JSON-RPC version succeeds", async () => {
    signalCheckMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      error: "HTTP 404",
    });
    signalRpcRequestMock.mockResolvedValueOnce({ version: "0.13.24" });

    const res = await probeSignal("http://127.0.0.1:8080", 1000);

    expect(res.ok).toBe(true);
    expect(res.version).toBe("0.13.24");
  });

  it("returns ok=false when both /check and JSON-RPC fail", async () => {
    signalCheckMock.mockResolvedValueOnce({
      ok: false,
      status: null,
      error: "fetch failed",
    });
    signalRpcRequestMock.mockRejectedValueOnce(new Error("connection refused"));

    const res = await probeSignal("http://127.0.0.1:8080", 1000);

    expect(res.ok).toBe(false);
    expect(res.error).toBe("fetch failed");
  });

  it("returns ok=true with error when /check passes but JSON-RPC fails", async () => {
    signalCheckMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      error: null,
    });
    signalRpcRequestMock.mockRejectedValueOnce(new Error("rpc timeout"));

    const res = await probeSignal("http://127.0.0.1:8080", 1000);

    expect(res.ok).toBe(true);
    expect(res.version).toBe(null);
    expect(res.error).toBe("rpc timeout");
  });
});

describe("classifySignalCliLogLine", () => {
  it("treats INFO/DEBUG as log (even if emitted on stderr)", () => {
    expect(classifySignalCliLogLine("INFO  DaemonCommand - Started")).toBe("log");
    expect(classifySignalCliLogLine("DEBUG Something")).toBe("log");
  });

  it("treats WARN/ERROR as error", () => {
    expect(classifySignalCliLogLine("WARN  Something")).toBe("error");
    expect(classifySignalCliLogLine("WARNING Something")).toBe("error");
    expect(classifySignalCliLogLine("ERROR Something")).toBe("error");
  });

  it("treats failures without explicit severity as error", () => {
    expect(classifySignalCliLogLine("Failed to initialize HTTP Server - oops")).toBe("error");
    expect(classifySignalCliLogLine('Exception in thread "main"')).toBe("error");
  });

  it("returns null for empty lines", () => {
    expect(classifySignalCliLogLine("")).toBe(null);
    expect(classifySignalCliLogLine("   ")).toBe(null);
  });
});
