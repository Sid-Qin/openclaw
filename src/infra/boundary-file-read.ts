import fs from "node:fs";
import path from "node:path";
import { resolveBoundaryPath, resolveBoundaryPathSync } from "./boundary-path.js";
import type { PathAliasPolicy } from "./path-alias-guards.js";
import { openVerifiedFileSync, type SafeOpenSyncFailureReason } from "./safe-open-sync.js";

/**
 * Package managers like pnpm and bun use content-addressable stores where
 * every file is a hardlink (nlink > 1).  These are read-only store paths
 * controlled by the package manager, not user-writable plugin directories,
 * so the hardlink-escape attack vector does not apply.
 */
function isPackageManagerStorePath(canonicalPath: string): boolean {
  const normalized = canonicalPath.split(path.sep).join("/");
  return (
    normalized.includes("/node_modules/.pnpm/") ||
    normalized.includes("/.bun/install/cache/")
  );
}

type BoundaryReadFs = Pick<
  typeof fs,
  | "closeSync"
  | "constants"
  | "fstatSync"
  | "lstatSync"
  | "openSync"
  | "readFileSync"
  | "realpathSync"
>;

export type BoundaryFileOpenFailureReason = SafeOpenSyncFailureReason | "validation";

export type BoundaryFileOpenResult =
  | { ok: true; path: string; fd: number; stat: fs.Stats; rootRealPath: string }
  | { ok: false; reason: BoundaryFileOpenFailureReason; error?: unknown };

export type OpenBoundaryFileSyncParams = {
  absolutePath: string;
  rootPath: string;
  boundaryLabel: string;
  rootRealPath?: string;
  maxBytes?: number;
  rejectHardlinks?: boolean;
  skipLexicalRootCheck?: boolean;
  ioFs?: BoundaryReadFs;
};

export type OpenBoundaryFileParams = OpenBoundaryFileSyncParams & {
  aliasPolicy?: PathAliasPolicy;
};

export function canUseBoundaryFileOpen(ioFs: typeof fs): boolean {
  return (
    typeof ioFs.openSync === "function" &&
    typeof ioFs.closeSync === "function" &&
    typeof ioFs.fstatSync === "function" &&
    typeof ioFs.lstatSync === "function" &&
    typeof ioFs.realpathSync === "function" &&
    typeof ioFs.readFileSync === "function" &&
    typeof ioFs.constants === "object" &&
    ioFs.constants !== null
  );
}

export function openBoundaryFileSync(params: OpenBoundaryFileSyncParams): BoundaryFileOpenResult {
  const ioFs = params.ioFs ?? fs;
  const absolutePath = path.resolve(params.absolutePath);

  let resolvedPath: string;
  let rootRealPath: string;
  try {
    const resolved = resolveBoundaryPathSync({
      absolutePath,
      rootPath: params.rootPath,
      rootCanonicalPath: params.rootRealPath,
      boundaryLabel: params.boundaryLabel,
      skipLexicalRootCheck: params.skipLexicalRootCheck,
    });
    resolvedPath = resolved.canonicalPath;
    rootRealPath = resolved.rootCanonicalPath;
  } catch (error) {
    return { ok: false, reason: "validation", error };
  }

  const rejectHardlinks =
    (params.rejectHardlinks ?? true) &&
    !isPackageManagerStorePath(resolvedPath) &&
    process.env.OPENCLAW_PLUGIN_ALLOW_HARDLINKS !== "true";

  const opened = openVerifiedFileSync({
    filePath: absolutePath,
    resolvedPath,
    rejectHardlinks,
    maxBytes: params.maxBytes,
    ioFs,
  });
  if (!opened.ok) {
    return opened;
  }
  return {
    ok: true,
    path: opened.path,
    fd: opened.fd,
    stat: opened.stat,
    rootRealPath,
  };
}

export async function openBoundaryFile(
  params: OpenBoundaryFileParams,
): Promise<BoundaryFileOpenResult> {
  try {
    await resolveBoundaryPath({
      absolutePath: params.absolutePath,
      rootPath: params.rootPath,
      rootCanonicalPath: params.rootRealPath,
      boundaryLabel: params.boundaryLabel,
      policy: params.aliasPolicy,
      skipLexicalRootCheck: params.skipLexicalRootCheck,
    });
  } catch (error) {
    return { ok: false, reason: "validation", error };
  }
  return openBoundaryFileSync(params);
}
