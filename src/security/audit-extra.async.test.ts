import { describe, expect, it } from "vitest";
import { collectLinuxUfwFindings } from "./audit-extra.js";

const FILE_STAT = {
  ok: true,
  isSymlink: false,
  isDir: false,
  mode: 0o755,
  uid: 0,
  gid: 0,
} as const;

const MISSING_STAT = {
  ok: false,
  isSymlink: false,
  isDir: false,
  mode: null,
  uid: null,
  gid: null,
  error: "ENOENT",
} as const;

describe("collectLinuxUfwFindings", () => {
  it("returns no findings on non-linux platforms", async () => {
    const findings = await collectLinuxUfwFindings({
      platform: "darwin",
      statFn: async () => FILE_STAT,
      readFileFn: async () => "ENABLED=yes\n",
    });

    expect(findings).toEqual([]);
  });

  it("reports enabled ufw when binary is detected but not on PATH", async () => {
    const findings = await collectLinuxUfwFindings({
      platform: "linux",
      env: { PATH: "/usr/bin:/bin" },
      ufwBinaryCandidates: ["/usr/sbin/ufw"],
      ufwConfigPath: "/etc/ufw/ufw.conf",
      statFn: async () => FILE_STAT,
      readFileFn: async () => "ENABLED=yes\n",
    });

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkId: "host.firewall.ufw.enabled_not_on_path",
          severity: "info",
        }),
      ]),
    );
  });

  it("reports enabled ufw when binary directory is already on PATH", async () => {
    const findings = await collectLinuxUfwFindings({
      platform: "linux",
      env: { PATH: "/usr/sbin:/usr/bin:/bin" },
      ufwBinaryCandidates: ["/usr/sbin/ufw"],
      statFn: async () => FILE_STAT,
      readFileFn: async () => "ENABLED=yes\n",
    });

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkId: "host.firewall.ufw.enabled",
          severity: "info",
        }),
      ]),
    );
  });

  it("warns when config says enabled but ufw binary cannot be found", async () => {
    const findings = await collectLinuxUfwFindings({
      platform: "linux",
      env: { PATH: "/usr/bin:/bin" },
      ufwBinaryCandidates: ["/usr/sbin/ufw", "/sbin/ufw"],
      statFn: async () => MISSING_STAT,
      readFileFn: async () => "ENABLED=yes\n",
    });

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkId: "host.firewall.ufw.config_enabled_binary_missing",
          severity: "warn",
        }),
      ]),
    );
  });
});
