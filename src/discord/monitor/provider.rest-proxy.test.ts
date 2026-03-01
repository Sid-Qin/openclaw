import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __resetDiscordRestProxyFetchRouterForTest,
  registerDiscordRestProxyFetch,
  resolveDiscordRestFetch,
} from "./rest-fetch.js";

const { undiciFetchMock, proxyAgentSpy } = vi.hoisted(() => ({
  undiciFetchMock: vi.fn(),
  proxyAgentSpy: vi.fn(),
}));

vi.mock("undici", () => {
  class ProxyAgent {
    proxyUrl: string;
    constructor(proxyUrl: string) {
      if (proxyUrl === "bad-proxy") {
        throw new Error("bad proxy");
      }
      this.proxyUrl = proxyUrl;
      proxyAgentSpy(proxyUrl);
    }
  }
  return {
    ProxyAgent,
    fetch: undiciFetchMock,
  };
});

describe("resolveDiscordRestFetch", () => {
  afterEach(() => {
    __resetDiscordRestProxyFetchRouterForTest();
    vi.unstubAllGlobals();
  });

  it("uses undici proxy fetch when a proxy URL is configured", async () => {
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn(),
    } as const;
    undiciFetchMock.mockClear().mockResolvedValue(new Response("ok", { status: 200 }));
    proxyAgentSpy.mockClear();
    const fetcher = resolveDiscordRestFetch("http://proxy.test:8080", runtime);

    await fetcher("https://discord.com/api/v10/oauth2/applications/@me");

    expect(proxyAgentSpy).toHaveBeenCalledWith("http://proxy.test:8080");
    expect(undiciFetchMock).toHaveBeenCalledWith(
      "https://discord.com/api/v10/oauth2/applications/@me",
      expect.objectContaining({
        dispatcher: expect.objectContaining({ proxyUrl: "http://proxy.test:8080" }),
      }),
    );
    expect(runtime.log).toHaveBeenCalledWith("discord: rest proxy enabled");
    expect(runtime.error).not.toHaveBeenCalled();
  });

  it("falls back to global fetch when proxy URL is invalid", async () => {
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn(),
    } as const;
    const fetcher = resolveDiscordRestFetch("bad-proxy", runtime);

    expect(fetcher).toBe(fetch);
    expect(runtime.error).toHaveBeenCalled();
    expect(runtime.log).not.toHaveBeenCalled();
  });

  it("routes discord REST requests through token-bound proxy fetch", async () => {
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn(),
    } as const;
    const fallbackFetch = vi.fn(async () => new Response("fallback", { status: 200 }));
    vi.stubGlobal("fetch", fallbackFetch as unknown as typeof fetch);
    undiciFetchMock.mockClear().mockResolvedValue(new Response("proxied", { status: 200 }));
    proxyAgentSpy.mockClear();

    registerDiscordRestProxyFetch({
      token: "bot-token-123",
      proxyUrl: "http://proxy.test:8080",
      runtime,
    });

    await fetch("https://discord.com/api/v10/channels/1/messages", {
      headers: { Authorization: "Bot bot-token-123" },
    });
    expect(proxyAgentSpy).toHaveBeenCalledWith("http://proxy.test:8080");
    expect(undiciFetchMock).toHaveBeenCalledWith(
      "https://discord.com/api/v10/channels/1/messages",
      expect.objectContaining({
        dispatcher: expect.objectContaining({ proxyUrl: "http://proxy.test:8080" }),
      }),
    );
    expect(fallbackFetch).not.toHaveBeenCalled();

    await fetch("https://discord.com/api/v10/channels/1/messages", {
      headers: { Authorization: "Bot other-token" },
    });
    expect(fallbackFetch).toHaveBeenCalledTimes(1);

    await fetch("https://example.com", {
      headers: { Authorization: "Bot bot-token-123" },
    });
    expect(fallbackFetch).toHaveBeenCalledTimes(2);
  });
});
