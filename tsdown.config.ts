import { defineConfig } from "tsdown";

const env = {
  NODE_ENV: "production",
};

// Merge small chunks into larger ones to reduce total file count.
// Windows NTFS + Node module loader has ~5× higher per-file overhead than
// Linux ext4, causing cold-start regressions when the chunk count grows.
// A 50 KB floor keeps the total well below the pre-regression baseline
// while still allowing the bundler to share code between entry points.
// See #30072.
const sharedOutputOptions = {
  advancedChunks: {
    minSize: 50_000,
    groups: [
      {
        name: "shared",
        minSize: 50_000,
      },
    ],
  },
};

export default defineConfig([
  {
    entry: "src/index.ts",
    env,
    fixedExtension: false,
    platform: "node",
    outputOptions: sharedOutputOptions,
  },
  {
    entry: "src/entry.ts",
    env,
    fixedExtension: false,
    platform: "node",
    outputOptions: sharedOutputOptions,
  },
  {
    // Ensure this module is bundled as an entry so legacy CLI shims can resolve its exports.
    entry: "src/cli/daemon-cli.ts",
    env,
    fixedExtension: false,
    platform: "node",
  },
  {
    entry: "src/infra/warning-filter.ts",
    env,
    fixedExtension: false,
    platform: "node",
  },
  {
    entry: "src/plugin-sdk/index.ts",
    outDir: "dist/plugin-sdk",
    env,
    fixedExtension: false,
    platform: "node",
  },
  {
    entry: "src/plugin-sdk/account-id.ts",
    outDir: "dist/plugin-sdk",
    env,
    fixedExtension: false,
    platform: "node",
  },
  {
    entry: "src/extensionAPI.ts",
    env,
    fixedExtension: false,
    platform: "node",
  },
  {
    entry: ["src/hooks/bundled/*/handler.ts", "src/hooks/llm-slug-generator.ts"],
    env,
    fixedExtension: false,
    platform: "node",
  },
]);
