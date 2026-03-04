import type { BaseProbeResult } from "../channels/plugins/types.js";
import { signalCheck, signalRpcRequest } from "./client.js";

export type SignalProbe = BaseProbeResult & {
  status?: number | null;
  elapsedMs: number;
  version?: string | null;
};

function parseSignalVersion(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "object" && value !== null) {
    const version = (value as { version?: unknown }).version;
    if (typeof version === "string" && version.trim()) {
      return version.trim();
    }
  }
  return null;
}

export async function probeSignal(baseUrl: string, timeoutMs: number): Promise<SignalProbe> {
  const started = Date.now();
  const result: SignalProbe = {
    ok: false,
    status: null,
    error: null,
    elapsedMs: 0,
    version: null,
  };

  const check = await signalCheck(baseUrl, timeoutMs);
  const restOk = check.ok;

  try {
    const version = await signalRpcRequest("version", undefined, {
      baseUrl,
      timeoutMs,
    });
    result.version = parseSignalVersion(version);
    return {
      ...result,
      ok: true,
      status: check.status ?? 200,
      elapsedMs: Date.now() - started,
    };
  } catch (rpcErr) {
    if (restOk) {
      return {
        ...result,
        ok: true,
        status: check.status ?? null,
        error: rpcErr instanceof Error ? rpcErr.message : String(rpcErr),
        elapsedMs: Date.now() - started,
      };
    }
    return {
      ...result,
      status: check.status ?? null,
      error: check.error ?? "unreachable",
      elapsedMs: Date.now() - started,
    };
  }
}
