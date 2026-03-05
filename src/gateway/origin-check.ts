import { isLoopbackHost, normalizeHostHeader } from "./net.js";

type OriginCheckResult =
  | {
      ok: true;
      matchedBy: "allowlist" | "host-header-fallback" | "local-loopback";
    }
  | { ok: false; reason: string };

function parseOrigin(
  originRaw?: string,
): { origin: string; host: string; hostname: string } | null {
  const trimmed = (originRaw ?? "").trim();
  if (!trimmed || trimmed === "null") {
    return null;
  }
  try {
    const url = new URL(trimmed);
    // Non-standard protocols (app://, tauri://, etc.) return "null" from
    // URL.origin. Reconstruct the origin from protocol + host so that
    // allowlist matching works for desktop-app origins like app://localhost.
    const origin =
      url.origin === "null"
        ? `${url.protocol}//${url.host}`.toLowerCase()
        : url.origin.toLowerCase();
    return {
      origin,
      host: url.host.toLowerCase(),
      hostname: url.hostname.toLowerCase(),
    };
  } catch {
    return null;
  }
}

export function checkBrowserOrigin(params: {
  requestHost?: string;
  origin?: string;
  allowedOrigins?: string[];
  allowHostHeaderOriginFallback?: boolean;
  isLocalClient?: boolean;
}): OriginCheckResult {
  const parsedOrigin = parseOrigin(params.origin);
  if (!parsedOrigin) {
    return { ok: false, reason: "origin missing or invalid" };
  }

  const allowlist = new Set(
    (params.allowedOrigins ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean),
  );
  if (allowlist.has("*") || allowlist.has(parsedOrigin.origin)) {
    return { ok: true, matchedBy: "allowlist" };
  }

  const requestHost = normalizeHostHeader(params.requestHost);
  if (
    params.allowHostHeaderOriginFallback === true &&
    requestHost &&
    parsedOrigin.host === requestHost
  ) {
    return { ok: true, matchedBy: "host-header-fallback" };
  }

  // Dev fallback only for genuinely local socket clients, not Host-header claims.
  if (params.isLocalClient && isLoopbackHost(parsedOrigin.hostname)) {
    return { ok: true, matchedBy: "local-loopback" };
  }

  return { ok: false, reason: "origin not allowed" };
}
