import { ProxyAgent, fetch as undiciFetch } from "undici";
import { danger } from "../../globals.js";
import { wrapFetchWithAbortSignal } from "../../infra/fetch.js";
import type { RuntimeEnv } from "../../runtime.js";

type ProxyFetchRouterState = {
  installed: boolean;
  originalFetch: typeof fetch;
  byAuthorization: Map<string, typeof fetch>;
};

let proxyFetchRouterState: ProxyFetchRouterState | null = null;

const normalizeAuthorization = (value: string): string => value.trim();

const readHeaderValue = (headers: HeadersInit | undefined, name: string): string | undefined => {
  if (!headers) {
    return undefined;
  }
  if (headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }
  if (Array.isArray(headers)) {
    const found = headers.find(([key]) => key.toLowerCase() === name.toLowerCase());
    return typeof found?.[1] === "string" ? found[1] : undefined;
  }
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== name.toLowerCase()) {
      continue;
    }
    if (Array.isArray(value)) {
      return typeof value[0] === "string" ? value[0] : undefined;
    }
    return typeof value === "string" ? value : undefined;
  }
  return undefined;
};

const resolveRequestAuthorization = (
  input: RequestInfo | URL,
  init?: RequestInit,
): string | undefined => {
  const initAuth = readHeaderValue(init?.headers, "authorization");
  if (initAuth?.trim()) {
    return normalizeAuthorization(initAuth);
  }
  if (typeof Request !== "undefined" && input instanceof Request) {
    const requestAuth = input.headers.get("authorization");
    if (requestAuth?.trim()) {
      return normalizeAuthorization(requestAuth);
    }
  }
  return undefined;
};

const resolveFetchUrl = (input: RequestInfo | URL): string | undefined => {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  if (typeof Request !== "undefined" && input instanceof Request) {
    return input.url;
  }
  return undefined;
};

const isDiscordRestUrl = (input: RequestInfo | URL): boolean => {
  const raw = resolveFetchUrl(input);
  if (!raw) {
    return false;
  }
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    return (
      host === "discord.com" ||
      host.endsWith(".discord.com") ||
      host === "discordapp.com" ||
      host.endsWith(".discordapp.com")
    );
  } catch {
    return false;
  }
};

const getProxyFetchRouterState = (): ProxyFetchRouterState => {
  if (!proxyFetchRouterState) {
    proxyFetchRouterState = {
      installed: false,
      originalFetch: fetch,
      byAuthorization: new Map<string, typeof fetch>(),
    };
  }
  return proxyFetchRouterState;
};

const ensureProxyFetchRouterInstalled = () => {
  const state = getProxyFetchRouterState();
  if (state.installed) {
    return;
  }
  const routedFetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (!isDiscordRestUrl(input)) {
      return state.originalFetch(input, init);
    }
    const authorization = resolveRequestAuthorization(input, init);
    if (authorization) {
      const proxiedFetch = state.byAuthorization.get(authorization);
      if (proxiedFetch) {
        return proxiedFetch(input, init);
      }
    }
    return state.originalFetch(input, init);
  }) as typeof fetch;
  state.originalFetch = fetch;
  state.installed = true;
  globalThis.fetch = routedFetch;
};

const createDiscordRestProxyFetch = (
  proxyUrl: string | undefined,
  runtime: RuntimeEnv,
): typeof fetch | null => {
  const proxy = proxyUrl?.trim();
  if (!proxy) {
    return null;
  }
  try {
    const agent = new ProxyAgent(proxy);
    const fetcher = ((input: RequestInfo | URL, init?: RequestInit) =>
      undiciFetch(input as string | URL, {
        ...(init as Record<string, unknown>),
        dispatcher: agent,
      }) as unknown as Promise<Response>) as typeof fetch;
    runtime.log?.("discord: rest proxy enabled");
    return wrapFetchWithAbortSignal(fetcher);
  } catch (err) {
    runtime.error?.(danger(`discord: invalid rest proxy: ${String(err)}`));
    return null;
  }
};

export function resolveDiscordRestFetch(
  proxyUrl: string | undefined,
  runtime: RuntimeEnv,
): typeof fetch {
  return createDiscordRestProxyFetch(proxyUrl, runtime) ?? fetch;
}

export function registerDiscordRestProxyFetch(params: {
  token: string;
  proxyUrl: string | undefined;
  runtime: RuntimeEnv;
}) {
  const token = params.token.trim();
  if (!token) {
    return;
  }
  const authorization = normalizeAuthorization(`Bot ${token}`);
  const state = getProxyFetchRouterState();
  const proxyFetch = createDiscordRestProxyFetch(params.proxyUrl, params.runtime);
  if (!proxyFetch) {
    state.byAuthorization.delete(authorization);
    return;
  }
  ensureProxyFetchRouterInstalled();
  state.byAuthorization.set(authorization, proxyFetch);
}

export function __resetDiscordRestProxyFetchRouterForTest() {
  if (!proxyFetchRouterState) {
    return;
  }
  if (proxyFetchRouterState.installed) {
    globalThis.fetch = proxyFetchRouterState.originalFetch;
  }
  proxyFetchRouterState.byAuthorization.clear();
  proxyFetchRouterState.installed = false;
  proxyFetchRouterState = null;
}
