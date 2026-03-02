import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CURRENT_SESSION_VERSION } from "@mariozechner/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appendInjectedUserMessageToTranscript } from "./chat-transcript-inject.js";

function readTranscriptEntries(filePath: string) {
  const lines = fs.readFileSync(filePath, "utf-8").split("\n").filter(Boolean);
  return lines.map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe("appendInjectedUserMessageToTranscript", () => {
  let tmpDir: string;
  let transcriptPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "webchat-test-"));
    transcriptPath = path.join(tmpDir, "session.jsonl");
    const header = {
      type: "session",
      version: CURRENT_SESSION_VERSION,
      id: "test-session",
      timestamp: new Date().toISOString(),
      cwd: tmpDir,
    };
    fs.writeFileSync(transcriptPath, `${JSON.stringify(header)}\n`, "utf-8");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("persists user message to transcript file", () => {
    const result = appendInjectedUserMessageToTranscript({
      transcriptPath,
      message: "Hello from webchat",
    });
    expect(result.ok).toBe(true);
    expect(result.message).toBeDefined();
    expect(result.message!.role).toBe("user");

    const entries = readTranscriptEntries(transcriptPath);
    const userEntries = entries.filter((e) => e.role === "user");
    expect(userEntries.length).toBe(1);
    const content = userEntries[0].content as Array<{ type: string; text: string }>;
    expect(content[0].text).toBe("Hello from webchat");
  });

  it("user message entry persists when no assistant message follows", () => {
    appendInjectedUserMessageToTranscript({
      transcriptPath,
      message: "User prompt that should persist",
    });

    const entries = readTranscriptEntries(transcriptPath);
    expect(entries.some((e) => e.role === "user")).toBe(true);
    expect(entries.some((e) => e.role === "assistant")).toBe(false);
  });

  it("returns error for invalid transcript path", () => {
    const result = appendInjectedUserMessageToTranscript({
      transcriptPath: "/nonexistent/path/session.jsonl",
      message: "test",
    });
    expect(result.ok).toBe(false);
  });

  it("includes timestamp and provider metadata", () => {
    const now = Date.now();
    const result = appendInjectedUserMessageToTranscript({
      transcriptPath,
      message: "timestamped message",
      now,
    });
    expect(result.ok).toBe(true);
    expect(result.message!.timestamp).toBe(now);
    expect(result.message!.provider).toBe("openclaw");
    expect(result.message!.model).toBe("gateway-injected");
  });
});
