import { describe, expect, it } from "vitest";
import { shouldRetryConnectWithoutDeviceAuth } from "../../ui/src/ui/gateway.ts";

describe("shouldRetryConnectWithoutDeviceAuth", () => {
  it("retries without device auth for stale signature when token is available", () => {
    expect(
      shouldRetryConnectWithoutDeviceAuth({
        detailCode: "device-signature-stale",
        hasSharedToken: true,
        alreadyRetriedWithoutDeviceAuth: false,
      }),
    ).toBe(true);
  });

  it("retries without device auth for invalid signature when token is available", () => {
    expect(
      shouldRetryConnectWithoutDeviceAuth({
        detailCode: "device-signature",
        hasSharedToken: true,
        alreadyRetriedWithoutDeviceAuth: false,
      }),
    ).toBe(true);
  });

  it("does not retry without token", () => {
    expect(
      shouldRetryConnectWithoutDeviceAuth({
        detailCode: "device-signature-stale",
        hasSharedToken: false,
        alreadyRetriedWithoutDeviceAuth: false,
      }),
    ).toBe(false);
  });

  it("does not retry more than once", () => {
    expect(
      shouldRetryConnectWithoutDeviceAuth({
        detailCode: "device-signature-stale",
        hasSharedToken: true,
        alreadyRetriedWithoutDeviceAuth: true,
      }),
    ).toBe(false);
  });

  it("ignores unrelated error detail codes", () => {
    expect(
      shouldRetryConnectWithoutDeviceAuth({
        detailCode: "AUTH_TOKEN_MISMATCH",
        hasSharedToken: true,
        alreadyRetriedWithoutDeviceAuth: false,
      }),
    ).toBe(false);
  });
});
