import { describe, expect, it } from "vitest";
import { normalizeAgentId } from "../routing/session-key.js";
import { listAgentIds } from "./agent-scope.js";

describe("spawnSubagentDirect — agent existence validation (unit)", () => {
  function validateAgentExistence(
    requestedAgentId: string | undefined,
    requesterAgentId: string,
    cfg: { agents?: { list?: Array<{ id: string }> } },
  ): { status: string; error?: string } | null {
    const targetAgentId = requestedAgentId ? normalizeAgentId(requestedAgentId) : requesterAgentId;

    if (requestedAgentId && targetAgentId !== requesterAgentId) {
      const knownIds = new Set(listAgentIds(cfg as never).map((id) => id.toLowerCase()));
      if (!knownIds.has(targetAgentId.toLowerCase())) {
        return {
          status: "error",
          error: `Unknown agentId "${targetAgentId}". Available agents: ${Array.from(knownIds).join(", ")}.`,
        };
      }
    }
    return null;
  }

  const cfg = { agents: { list: [{ id: "main" }, { id: "research" }] } };

  it("rejects non-existent agentId", () => {
    const result = validateAgentExistence("does-not-exist", "main", cfg);
    expect(result).not.toBeNull();
    expect(result!.status).toBe("error");
    expect(result!.error).toContain("Unknown agentId");
    expect(result!.error).toContain("does-not-exist");
  });

  it("lists available agents in error message", () => {
    const result = validateAgentExistence("ghost", "main", cfg);
    expect(result!.error).toContain("main");
    expect(result!.error).toContain("research");
  });

  it("allows an agent that exists in config", () => {
    const result = validateAgentExistence("research", "main", cfg);
    expect(result).toBeNull();
  });

  it("skips validation when agentId matches requester", () => {
    const result = validateAgentExistence("main", "main", cfg);
    expect(result).toBeNull();
  });

  it("skips validation when no agentId is requested", () => {
    const result = validateAgentExistence(undefined, "main", cfg);
    expect(result).toBeNull();
  });

  it("is case-insensitive", () => {
    const result = validateAgentExistence("RESEARCH", "main", cfg);
    expect(result).toBeNull();
  });

  it("rejects error-message-like strings as agentId", () => {
    const result = validateAgentExistence("Agent not found: xyz", "main", cfg);
    expect(result).not.toBeNull();
    expect(result!.status).toBe("error");
  });
});
