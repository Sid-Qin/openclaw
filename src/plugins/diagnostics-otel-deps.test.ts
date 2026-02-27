import fs from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("diagnostics-otel bundled dependency coverage", () => {
  it("keeps diagnostics-otel runtime deps in root package dependencies", async () => {
    const rootPackagePath = new URL("../../package.json", import.meta.url);
    const extensionPackagePath = new URL("../../extensions/diagnostics-otel/package.json", import.meta.url);

    const rootPackage = JSON.parse(await fs.readFile(rootPackagePath, "utf8")) as {
      dependencies?: Record<string, string>;
    };
    const extensionPackage = JSON.parse(await fs.readFile(extensionPackagePath, "utf8")) as {
      dependencies?: Record<string, string>;
    };

    const rootDeps = rootPackage.dependencies ?? {};
    const extensionDeps = extensionPackage.dependencies ?? {};
    const missingDeps = Object.keys(extensionDeps).filter((name) => !(name in rootDeps));

    expect(missingDeps).toEqual([]);
  });
});
