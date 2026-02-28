import fs from "node:fs";
import path from "node:path";

const DAILY_MEMORY_FILE_PATTERN = /memory\/\d{4}-\d{2}-\d{2}\.md/;

// Default required files — constants, extensible to config later
const DEFAULT_REQUIRED_READS: Array<string | RegExp> = [
  "WORKFLOW_AUTO.md",
  DAILY_MEMORY_FILE_PATTERN, // daily memory files
];

function formatLocalDateIso(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function resolveDailyMemoryRelativePath(now: Date): string {
  return `memory/${formatLocalDateIso(now)}.md`;
}

function resolveMissingPatternLabel(params: { required: string | RegExp; now: Date }): string {
  const { required, now } = params;
  if (typeof required === "string") {
    return required;
  }
  if (required.source === DAILY_MEMORY_FILE_PATTERN.source) {
    return resolveDailyMemoryRelativePath(now);
  }
  return required.source;
}

/**
 * Audit whether agent read required startup files after compaction.
 * Returns list of missing file patterns.
 */
export function auditPostCompactionReads(
  readFilePaths: string[],
  workspaceDir: string,
  requiredReads: Array<string | RegExp> = DEFAULT_REQUIRED_READS,
  options?: { now?: Date },
): { passed: boolean; missingPatterns: string[] } {
  const now = options?.now ?? new Date();
  const normalizedReads = readFilePaths.map((p) => path.resolve(workspaceDir, p));
  const missingPatterns: string[] = [];

  for (const required of requiredReads) {
    if (typeof required === "string") {
      const requiredResolved = path.resolve(workspaceDir, required);
      const found = normalizedReads.some((r) => r === requiredResolved);
      if (!found) {
        missingPatterns.push(required);
      }
    } else {
      // RegExp — match against relative paths from workspace
      const strictPattern = new RegExp(`^(?:${required.source})$`, required.flags);
      const found = readFilePaths.some((p) => {
        const rel = path.relative(workspaceDir, path.resolve(workspaceDir, p));
        // Normalize to forward slashes for cross-platform RegExp matching
        const normalizedRel = rel.split(path.sep).join("/");
        return strictPattern.test(normalizedRel);
      });
      if (!found) {
        missingPatterns.push(resolveMissingPatternLabel({ required, now }));
      }
    }
  }

  return { passed: missingPatterns.length === 0, missingPatterns };
}

/**
 * Read messages from a session JSONL file.
 * Returns messages from the last N lines (default 100).
 */
export function readSessionMessages(
  sessionFile: string,
  maxLines = 100,
): Array<{ role?: string; content?: unknown }> {
  if (!fs.existsSync(sessionFile)) {
    return [];
  }

  try {
    const content = fs.readFileSync(sessionFile, "utf-8");
    const lines = content.trim().split("\n");
    const recentLines = lines.slice(-maxLines);

    const messages: Array<{ role?: string; content?: unknown }> = [];
    for (const line of recentLines) {
      try {
        const entry = JSON.parse(line);
        if (entry.type === "message" && entry.message) {
          messages.push(entry.message);
        }
      } catch {
        // Skip malformed lines
      }
    }
    return messages;
  } catch {
    return [];
  }
}

/**
 * Extract file paths from Read tool calls in agent messages.
 * Looks for tool_use blocks with name="read" and extracts path/file_path args.
 */
export function extractReadPaths(messages: Array<{ role?: string; content?: unknown }>): string[] {
  const paths: string[] = [];
  for (const msg of messages) {
    if (msg.role !== "assistant" || !Array.isArray(msg.content)) {
      continue;
    }
    for (const block of msg.content) {
      if (block.type === "tool_use" && block.name === "read") {
        const filePath = block.input?.file_path ?? block.input?.path;
        if (typeof filePath === "string") {
          paths.push(filePath);
        }
      }
    }
  }
  return paths;
}

/** Format the audit warning message */
export function formatAuditWarning(
  missingPatterns: string[],
  options?: { workspaceDir?: string },
): string {
  const workspaceDir = options?.workspaceDir;
  const fileList = missingPatterns
    .map((p) => {
      if (!workspaceDir || path.isAbsolute(p)) {
        return `  - ${p}`;
      }
      const expectedPath = path.resolve(workspaceDir, p);
      return `  - ${p} (expected: ${expectedPath})`;
    })
    .join("\n");
  const memoryPath = missingPatterns.find((p) => p.startsWith("memory/"));
  const memoryHint =
    workspaceDir && memoryPath
      ? `\n\nExpected path: ${path.resolve(workspaceDir, memoryPath)}`
      : "";
  return (
    "⚠️ Post-Compaction Audit: The following required startup files were not read after context reset:\n" +
    fileList +
    "\n\nPlease read them now using the Read tool before continuing. " +
    "This ensures your operating protocols are restored after memory compaction." +
    memoryHint
  );
}
