import { describe, expect, it } from "vitest";
import { normalizeToolParams } from "./pi-tools.read.js";

describe("normalizeToolParams", () => {
  it("normalizes markdown-linked file paths for edit-style params", () => {
    const normalized = normalizeToolParams({
      file_path: "`~/.openclaw/workspace/SELF_LEARNING_LOOP_[CRON.md](http://cron.md/)`",
      old_string: "before",
      new_string: "after",
    });

    const normalizedPath = typeof normalized?.path === "string" ? normalized.path : "";
    expect(normalizedPath).toContain("SELF_LEARNING_LOOP_CRON.md");
    expect(normalizedPath).not.toContain("[CRON.md]");
    expect(normalizedPath).not.toContain("(http://cron.md/)");
    expect(normalized?.oldText).toBe("before");
    expect(normalized?.newText).toBe("after");
  });

  it("converts file URLs into filesystem paths", () => {
    const normalized = normalizeToolParams({
      path: "file:///tmp/my%20doc.md",
    });

    expect(normalized?.path).toBe("/tmp/my doc.md");
  });
});
