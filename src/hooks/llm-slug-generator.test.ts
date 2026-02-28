import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";

const mocks = vi.hoisted(() => ({
  runEmbeddedPiAgent: vi.fn(),
  resolveAgentEffectiveModelPrimary: vi.fn(),
}));

vi.mock("../agents/agent-scope.js", () => ({
  resolveDefaultAgentId: () => "main",
  resolveAgentWorkspaceDir: () => "/tmp/openclaw-workspace",
  resolveAgentDir: () => "/tmp/openclaw-agent",
  resolveAgentEffectiveModelPrimary: (...args: unknown[]) =>
    mocks.resolveAgentEffectiveModelPrimary(...args),
}));

vi.mock("../agents/pi-embedded.js", () => ({
  runEmbeddedPiAgent: (...args: unknown[]) => mocks.runEmbeddedPiAgent(...args),
}));

const { generateSlugViaLLM } = await import("./llm-slug-generator.js");

describe("generateSlugViaLLM", () => {
  beforeEach(() => {
    mocks.runEmbeddedPiAgent.mockReset();
    mocks.resolveAgentEffectiveModelPrimary.mockReset();
    mocks.resolveAgentEffectiveModelPrimary.mockReturnValue(undefined);
  });

  const cfg = {} as OpenClawConfig;

  it("normalizes a short model response into slug format", async () => {
    mocks.runEmbeddedPiAgent.mockResolvedValueOnce({
      payloads: [{ text: "Vendor Pitch" }],
    });

    const slug = await generateSlugViaLLM({
      sessionContent: "conversation",
      cfg,
    });

    expect(slug).toBe("vendor-pitch");
  });

  it("ignores timeout/error text responses from the model", async () => {
    mocks.runEmbeddedPiAgent.mockResolvedValueOnce({
      payloads: [{ text: "request timed out before a response" }],
    });

    const slug = await generateSlugViaLLM({
      sessionContent: "conversation",
      cfg,
    });

    expect(slug).toBeNull();
  });

  it("accepts prefixed slug labels and strips the prefix", async () => {
    mocks.runEmbeddedPiAgent.mockResolvedValueOnce({
      payloads: [{ text: "slug: bug-fix" }],
    });

    const slug = await generateSlugViaLLM({
      sessionContent: "conversation",
      cfg,
    });

    expect(slug).toBe("bug-fix");
  });
});
