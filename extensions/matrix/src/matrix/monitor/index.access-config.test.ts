import { describe, expect, it } from "vitest";
import type { MatrixConfig } from "../../types.js";
import { resolveMatrixDmAccessConfig } from "./index.js";

describe("resolveMatrixDmAccessConfig", () => {
  it("supports legacy dmPolicy + allowFrom fields", () => {
    const cfg = {
      dmPolicy: "allowlist",
      allowFrom: ["@alice:example.org"],
    } as unknown as MatrixConfig;

    const resolved = resolveMatrixDmAccessConfig(cfg);

    expect(resolved.dmPolicyRaw).toBe("allowlist");
    expect(resolved.allowFrom).toEqual(["@alice:example.org"]);
    expect(resolved.groupAllowFrom).toEqual(["@alice:example.org"]);
  });

  it("falls back group allowlist to dm allowlist when groupAllowFrom is unset", () => {
    const cfg = {
      dm: { policy: "allowlist", allowFrom: ["@bob:example.org"] },
    } as MatrixConfig;

    const resolved = resolveMatrixDmAccessConfig(cfg);

    expect(resolved.allowFrom).toEqual(["@bob:example.org"]);
    expect(resolved.groupAllowFrom).toEqual(["@bob:example.org"]);
  });

  it("keeps explicit groupAllowFrom when provided", () => {
    const cfg = {
      dm: { policy: "allowlist", allowFrom: ["@bob:example.org"] },
      groupAllowFrom: ["@carol:example.org"],
    } as MatrixConfig;

    const resolved = resolveMatrixDmAccessConfig(cfg);

    expect(resolved.allowFrom).toEqual(["@bob:example.org"]);
    expect(resolved.groupAllowFrom).toEqual(["@carol:example.org"]);
  });
});
