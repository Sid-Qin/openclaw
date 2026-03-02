import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearInternalHooks,
  registerInternalHook,
  type AgentBootstrapHookContext,
} from "../hooks/internal-hooks.js";
import { applyBootstrapHookOverrides } from "./bootstrap-hooks.js";
import { DEFAULT_SOUL_FILENAME, type WorkspaceBootstrapFile } from "./workspace.js";

function makeFile(
  name: WorkspaceBootstrapFile["name"] = DEFAULT_SOUL_FILENAME,
): WorkspaceBootstrapFile {
  return {
    name,
    path: `/tmp/${name}`,
    content: "base",
    missing: false,
  };
}

describe("applyBootstrapHookOverrides", () => {
  beforeEach(() => clearInternalHooks());
  afterEach(() => clearInternalHooks());

  it("returns updated files when a hook mutates the context", async () => {
    registerInternalHook("agent:bootstrap", (event) => {
      const context = event.context as AgentBootstrapHookContext;
      context.bootstrapFiles = [
        ...context.bootstrapFiles,
        {
          name: "EXTRA.md",
          path: "/tmp/EXTRA.md",
          content: "extra",
          missing: false,
        } as unknown as WorkspaceBootstrapFile,
      ];
    });

    const updated = await applyBootstrapHookOverrides({
      files: [makeFile()],
      workspaceDir: "/tmp",
    });

    expect(updated).toHaveLength(2);
    expect(updated[1]?.path).toBe("/tmp/EXTRA.md");
  });

  it("passes provider and modelId to hook context", async () => {
    let capturedContext: AgentBootstrapHookContext | undefined;
    registerInternalHook("agent:bootstrap", (event) => {
      capturedContext = event.context as AgentBootstrapHookContext;
    });

    await applyBootstrapHookOverrides({
      files: [makeFile()],
      workspaceDir: "/tmp",
      provider: "anthropic",
      modelId: "claude-opus-4-6",
    });

    expect(capturedContext?.provider).toBe("anthropic");
    expect(capturedContext?.modelId).toBe("claude-opus-4-6");
  });

  it("leaves provider and modelId undefined when not supplied", async () => {
    let capturedContext: AgentBootstrapHookContext | undefined;
    registerInternalHook("agent:bootstrap", (event) => {
      capturedContext = event.context as AgentBootstrapHookContext;
    });

    await applyBootstrapHookOverrides({
      files: [makeFile()],
      workspaceDir: "/tmp",
    });

    expect(capturedContext?.provider).toBeUndefined();
    expect(capturedContext?.modelId).toBeUndefined();
  });

  it("allows hook to filter files based on provider", async () => {
    registerInternalHook("agent:bootstrap", (event) => {
      const ctx = event.context as AgentBootstrapHookContext;
      if (ctx.provider === "anthropic" && ctx.modelId?.includes("haiku")) {
        ctx.bootstrapFiles = ctx.bootstrapFiles.filter((f) => f.name !== DEFAULT_SOUL_FILENAME);
      }
    });

    const result = await applyBootstrapHookOverrides({
      files: [makeFile()],
      workspaceDir: "/tmp",
      provider: "anthropic",
      modelId: "claude-3-5-haiku",
    });

    expect(result).toHaveLength(0);
  });
});
