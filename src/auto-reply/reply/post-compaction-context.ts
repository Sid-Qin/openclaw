import fs from "node:fs";
import path from "node:path";

const MAX_CONTEXT_CHARS = 3000;
const STARTUP_MARKDOWN_TOKEN_RE = /[A-Za-z0-9_./\\{}()[\]\-+?*|]+\.md\b/g;

function normalizeWorkspacePath(filePath: string): string {
  return path.resolve(filePath);
}

function extractMarkdownPathTokens(line: string): string[] {
  const normalized = line.replace(/`([^`]+)`/g, "$1");
  return normalized.match(STARTUP_MARKDOWN_TOKEN_RE) ?? [];
}

function normalizeMarkdownPathToken(token: string): string {
  return token.trim().replace(/\\\//g, "/");
}

function isLiteralWorkspaceRelativePath(token: string): boolean {
  if (!token || token.startsWith("/") || token.includes("..")) {
    return false;
  }
  // Reject regex/wildcard-like references (e.g. memory/\d{4}-\d{2}-\d{2}.md).
  if (/[*?[\]{}()|+\\]/.test(token)) {
    return false;
  }
  return /^[A-Za-z0-9._/-]+$/.test(token);
}

async function workspaceFileExists(workspaceDir: string, relPath: string): Promise<boolean> {
  const root = normalizeWorkspacePath(workspaceDir);
  const candidate = normalizeWorkspacePath(path.join(root, relPath));
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
    return false;
  }
  try {
    const stat = await fs.promises.stat(candidate);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function shouldKeepSessionStartupLine(line: string, workspaceDir: string): Promise<boolean> {
  const tokens = extractMarkdownPathTokens(line).map(normalizeMarkdownPathToken);
  if (tokens.length === 0) {
    return true;
  }
  for (const token of tokens) {
    if (!isLiteralWorkspaceRelativePath(token)) {
      return false;
    }
    if (!(await workspaceFileExists(workspaceDir, token))) {
      return false;
    }
  }
  return true;
}

async function sanitizeSessionStartupSections(
  sections: string[],
  workspaceDir: string,
): Promise<string[]> {
  const sanitized: string[] = [];
  for (const section of sections) {
    const lines = section.split("\n");
    const kept: string[] = [];
    for (const line of lines) {
      if (await shouldKeepSessionStartupLine(line, workspaceDir)) {
        kept.push(line);
      }
    }
    const compacted = kept
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (compacted) {
      sanitized.push(compacted);
    }
  }
  return sanitized;
}

/**
 * Read critical sections from workspace AGENTS.md for post-compaction injection.
 * Returns formatted system event text, or null if no AGENTS.md or no relevant sections.
 */
export async function readPostCompactionContext(workspaceDir: string): Promise<string | null> {
  const agentsPath = path.join(workspaceDir, "AGENTS.md");

  try {
    if (!fs.existsSync(agentsPath)) {
      return null;
    }

    const content = await fs.promises.readFile(agentsPath, "utf-8");

    // Extract startup-related sections and remove startup lines that reference
    // non-literal or missing markdown files to avoid injecting stale paths.
    const startupSections = extractSections(content, ["Session Startup"]);
    const redLineSections = extractSections(content, ["Red Lines"]);
    const sections = [
      ...(await sanitizeSessionStartupSections(startupSections, workspaceDir)),
      ...redLineSections,
    ];

    if (sections.length === 0) {
      return null;
    }

    const combined = sections.join("\n\n");
    const safeContent =
      combined.length > MAX_CONTEXT_CHARS
        ? combined.slice(0, MAX_CONTEXT_CHARS) + "\n...[truncated]..."
        : combined;

    return (
      "[Post-compaction context refresh]\n\n" +
      "Session was just compacted. The conversation summary above is a hint, NOT a substitute for your startup sequence. " +
      "Execute your Session Startup sequence now — read the required files before responding to the user.\n\n" +
      "Critical rules from AGENTS.md:\n\n" +
      safeContent
    );
  } catch {
    return null;
  }
}

/**
 * Extract named sections from markdown content.
 * Matches H2 (##) or H3 (###) headings case-insensitively.
 * Skips content inside fenced code blocks.
 * Captures until the next heading of same or higher level, or end of string.
 */
export function extractSections(content: string, sectionNames: string[]): string[] {
  const results: string[] = [];
  const lines = content.split("\n");

  for (const name of sectionNames) {
    let sectionLines: string[] = [];
    let inSection = false;
    let sectionLevel = 0;
    let inCodeBlock = false;

    for (const line of lines) {
      // Track fenced code blocks
      if (line.trimStart().startsWith("```")) {
        inCodeBlock = !inCodeBlock;
        if (inSection) {
          sectionLines.push(line);
        }
        continue;
      }

      // Skip heading detection inside code blocks
      if (inCodeBlock) {
        if (inSection) {
          sectionLines.push(line);
        }
        continue;
      }

      // Check if this line is a heading
      const headingMatch = line.match(/^(#{2,3})\s+(.+?)\s*$/);

      if (headingMatch) {
        const level = headingMatch[1].length; // 2 or 3
        const headingText = headingMatch[2];

        if (!inSection) {
          // Check if this is our target section (case-insensitive)
          if (headingText.toLowerCase() === name.toLowerCase()) {
            inSection = true;
            sectionLevel = level;
            sectionLines = [line];
            continue;
          }
        } else {
          // We're in section — stop if we hit a heading of same or higher level
          if (level <= sectionLevel) {
            break;
          }
          // Lower-level heading (e.g., ### inside ##) — include it
          sectionLines.push(line);
          continue;
        }
      }

      if (inSection) {
        sectionLines.push(line);
      }
    }

    if (sectionLines.length > 0) {
      results.push(sectionLines.join("\n").trim());
    }
  }

  return results;
}
