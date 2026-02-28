/**
 * LLM-based slug generator for session memory filenames
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  resolveDefaultAgentId,
  resolveAgentWorkspaceDir,
  resolveAgentDir,
  resolveAgentEffectiveModelPrimary,
} from "../agents/agent-scope.js";
import { DEFAULT_PROVIDER, DEFAULT_MODEL } from "../agents/defaults.js";
import { parseModelRef } from "../agents/model-selection.js";
import { runEmbeddedPiAgent } from "../agents/pi-embedded.js";
import type { OpenClawConfig } from "../config/config.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("llm-slug-generator");

const SLUG_ERROR_RESPONSE_RE =
  /\b(request timed out|timed out before a response|gateway timeout|validation failed|internal error|must have required property)\b/i;

function extractSlugCandidate(text: string): string | null {
  const firstLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstLine) {
    return null;
  }
  const withoutLabel = firstLine.replace(/^slug\s*[:=-]\s*/i, "").trim();
  if (!withoutLabel || SLUG_ERROR_RESPONSE_RE.test(withoutLabel)) {
    return null;
  }
  const words = withoutLabel
    .replace(/^[`"'([{]+/, "")
    .replace(/[`"')\]}.,:;!?]+$/, "")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0 || words.length > 2) {
    return null;
  }
  const slug = words
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
  return slug || null;
}

/**
 * Generate a short 1-2 word filename slug from session content using LLM
 */
export async function generateSlugViaLLM(params: {
  sessionContent: string;
  cfg: OpenClawConfig;
}): Promise<string | null> {
  let tempSessionFile: string | null = null;

  try {
    const agentId = resolveDefaultAgentId(params.cfg);
    const workspaceDir = resolveAgentWorkspaceDir(params.cfg, agentId);
    const agentDir = resolveAgentDir(params.cfg, agentId);

    // Create a temporary session file for this one-off LLM call
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-slug-"));
    tempSessionFile = path.join(tempDir, "session.jsonl");

    const prompt = `Based on this conversation, generate a short 1-2 word filename slug (lowercase, hyphen-separated, no file extension).

Conversation summary:
${params.sessionContent.slice(0, 2000)}

Reply with ONLY the slug, nothing else. Examples: "vendor-pitch", "api-design", "bug-fix"`;

    // Resolve model from agent config instead of using hardcoded defaults
    const modelRef = resolveAgentEffectiveModelPrimary(params.cfg, agentId);
    const parsed = modelRef ? parseModelRef(modelRef, DEFAULT_PROVIDER) : null;
    const provider = parsed?.provider ?? DEFAULT_PROVIDER;
    const model = parsed?.model ?? DEFAULT_MODEL;

    const result = await runEmbeddedPiAgent({
      sessionId: `slug-generator-${Date.now()}`,
      sessionKey: "temp:slug-generator",
      agentId,
      sessionFile: tempSessionFile,
      workspaceDir,
      agentDir,
      config: params.cfg,
      prompt,
      provider,
      model,
      timeoutMs: 15_000, // 15 second timeout
      runId: `slug-gen-${Date.now()}`,
    });

    // Extract text from payloads
    if (result.payloads && result.payloads.length > 0) {
      const text = result.payloads[0]?.text;
      if (text) {
        // Keep only strict 1-2 word slug responses and ignore timeout/error text.
        return extractSlugCandidate(text);
      }
    }

    return null;
  } catch (err) {
    const message = err instanceof Error ? (err.stack ?? err.message) : String(err);
    log.error(`Failed to generate slug: ${message}`);
    return null;
  } finally {
    // Clean up temporary session file
    if (tempSessionFile) {
      try {
        await fs.rm(path.dirname(tempSessionFile), { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
