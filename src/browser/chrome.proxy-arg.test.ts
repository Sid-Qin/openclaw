import { describe, expect, it } from "vitest";
import { resolveProxyArg } from "./chrome.js";

describe("resolveProxyArg (#35346)", () => {
  it("returns --proxy-server from HTTPS_PROXY", () => {
    expect(resolveProxyArg([], { HTTPS_PROXY: "http://proxy:8080" })).toBe(
      "--proxy-server=http://proxy:8080",
    );
  });

  it("prefers HTTPS_PROXY over HTTP_PROXY", () => {
    expect(
      resolveProxyArg([], {
        HTTPS_PROXY: "http://secure:8443",
        HTTP_PROXY: "http://plain:8080",
      }),
    ).toBe("--proxy-server=http://secure:8443");
  });

  it("falls back to http_proxy (lowercase)", () => {
    expect(resolveProxyArg([], { http_proxy: "socks5://proxy:1080" })).toBe(
      "--proxy-server=socks5://proxy:1080",
    );
  });

  it("falls back to ALL_PROXY", () => {
    expect(resolveProxyArg([], { ALL_PROXY: "http://all:3128" })).toBe(
      "--proxy-server=http://all:3128",
    );
  });

  it("returns undefined when no proxy env vars set", () => {
    expect(resolveProxyArg([], {})).toBeUndefined();
  });

  it("returns undefined when user already has --proxy-server in extraArgs", () => {
    expect(
      resolveProxyArg(["--proxy-server=http://custom:9090"], {
        HTTPS_PROXY: "http://proxy:8080",
      }),
    ).toBeUndefined();
  });

  it("returns undefined when user has --proxy-server= prefix in extraArgs", () => {
    expect(
      resolveProxyArg(["--proxy-server=socks5://custom:1080"], {
        HTTP_PROXY: "http://proxy:8080",
      }),
    ).toBeUndefined();
  });
});
