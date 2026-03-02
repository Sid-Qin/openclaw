import { beforeEach, describe, expect, it } from "vitest";
import "./test-helpers/fast-core-tools.js";
import {
  getCallGatewayMock,
  getSessionsSpawnTool,
  resetSessionsSpawnConfigOverride,
  setSessionsSpawnConfigOverride,
} from "./openclaw-tools.subagents.sessions-spawn.test-harness.js";
import { resetSubagentRegistryForTests } from "./subagent-registry.js";

const callGatewayMock = getCallGatewayMock();

describe("openclaw-tools: subagents (sessions_spawn allowlist)", () => {
  function setAllowAgents(allowAgents: string[]) {
    setSessionsSpawnConfigOverride({
      session: {
        mainKey: "main",
        scope: "per-sender",
      },
      agents: {
        list: [
          {
            id: "main",
            subagents: {
              allowAgents,
            },
          },
        ],
      },
    });
  }

  function mockAcceptedSpawn(acceptedAt: number) {
    let childSessionKey: string | undefined;
    callGatewayMock.mockImplementation(async (opts: unknown) => {
      const request = opts as { method?: string; params?: unknown };
      if (request.method === "agent") {
        const params = request.params as { sessionKey?: string } | undefined;
        childSessionKey = params?.sessionKey;
        return { runId: "run-1", status: "accepted", acceptedAt };
      }
      if (request.method === "agent.wait") {
        return { status: "timeout" };
      }
      return {};
    });
    return () => childSessionKey;
  }

  async function executeSpawn(callId: string, agentId: string, sandbox?: "inherit" | "require") {
    const tool = await getSessionsSpawnTool({
      agentSessionKey: "main",
      agentChannel: "whatsapp",
    });
    return tool.execute(callId, { task: "do thing", agentId, sandbox });
  }

  async function expectAllowedSpawn(params: {
    allowAgents: string[];
    agentId: string;
    callId: string;
    acceptedAt: number;
  }) {
    setAllowAgents(params.allowAgents);
    const getChildSessionKey = mockAcceptedSpawn(params.acceptedAt);

    const result = await executeSpawn(params.callId, params.agentId);

    expect(result.details).toMatchObject({
      status: "accepted",
      runId: "run-1",
    });
    expect(getChildSessionKey()?.startsWith(`agent:${params.agentId}:subagent:`)).toBe(true);
  }

  beforeEach(() => {
    resetSessionsSpawnConfigOverride();
    resetSubagentRegistryForTests();
    callGatewayMock.mockClear();
  });

  it("sessions_spawn only allows same-agent by default", async () => {
    const tool = await getSessionsSpawnTool({
      agentSessionKey: "main",
      agentChannel: "whatsapp",
    });

    const result = await tool.execute("call6", {
      task: "do thing",
      agentId: "beta",
    });
    expect(result.details).toMatchObject({
      status: "forbidden",
    });
    expect(callGatewayMock).not.toHaveBeenCalled();
  });

  it("sessions_spawn forbids cross-agent spawning when not allowed", async () => {
    setSessionsSpawnConfigOverride({
      session: {
        mainKey: "main",
        scope: "per-sender",
      },
      agents: {
        list: [
          {
            id: "main",
            subagents: {
              allowAgents: ["alpha"],
            },
          },
        ],
      },
    });

    const tool = await getSessionsSpawnTool({
      agentSessionKey: "main",
      agentChannel: "whatsapp",
    });

    const result = await tool.execute("call9", {
      task: "do thing",
      agentId: "beta",
    });
    expect(result.details).toMatchObject({
      status: "forbidden",
    });
    expect(callGatewayMock).not.toHaveBeenCalled();
  });

  it("sessions_spawn allows cross-agent spawning when configured", async () => {
    await expectAllowedSpawn({
      allowAgents: ["beta"],
      agentId: "beta",
      callId: "call7",
      acceptedAt: 5000,
    });
  });

  it("sessions_spawn allows any agent when allowlist is *", async () => {
    await expectAllowedSpawn({
      allowAgents: ["*"],
      agentId: "beta",
      callId: "call8",
      acceptedAt: 5100,
    });
  });

  it("sessions_spawn normalizes allowlisted agent ids", async () => {
    await expectAllowedSpawn({
      allowAgents: ["Research"],
      agentId: "research",
      callId: "call10",
      acceptedAt: 5200,
    });
  });

  it("sessions_spawn inherits allowAgents from agents.defaults.subagents", async () => {
    setSessionsSpawnConfigOverride({
      session: {
        mainKey: "main",
        scope: "per-sender",
      },
      agents: {
        defaults: {
          subagents: {
            allowAgents: ["coder", "researcher"],
          },
        },
        list: [{ id: "main" }],
      },
    });
    const getChildSessionKey = mockAcceptedSpawn(5300);

    const result = await executeSpawn("call-defaults-1", "coder");

    expect(result.details).toMatchObject({ status: "accepted" });
    expect(getChildSessionKey()?.startsWith("agent:coder:subagent:")).toBe(true);
  });

  it("sessions_spawn merges defaults allowAgents with per-agent allowAgents", async () => {
    setSessionsSpawnConfigOverride({
      session: {
        mainKey: "main",
        scope: "per-sender",
      },
      agents: {
        defaults: {
          subagents: {
            allowAgents: ["coder"],
          },
        },
        list: [
          {
            id: "main",
            subagents: {
              allowAgents: ["researcher"],
            },
          },
        ],
      },
    });
    const getChildSessionKey1 = mockAcceptedSpawn(5400);

    const result1 = await executeSpawn("call-merge-1", "coder");
    expect(result1.details).toMatchObject({ status: "accepted" });
    expect(getChildSessionKey1()?.startsWith("agent:coder:subagent:")).toBe(true);

    const getChildSessionKey2 = mockAcceptedSpawn(5500);
    const result2 = await executeSpawn("call-merge-2", "researcher");
    expect(result2.details).toMatchObject({ status: "accepted" });
    expect(getChildSessionKey2()?.startsWith("agent:researcher:subagent:")).toBe(true);
  });

  it("sessions_spawn rejects agents not in either defaults or per-agent allowAgents", async () => {
    setSessionsSpawnConfigOverride({
      session: {
        mainKey: "main",
        scope: "per-sender",
      },
      agents: {
        defaults: {
          subagents: {
            allowAgents: ["coder"],
          },
        },
        list: [
          {
            id: "main",
            subagents: {
              allowAgents: ["researcher"],
            },
          },
        ],
      },
    });

    const result = await executeSpawn("call-merge-reject", "unknown-agent");
    expect(result.details).toMatchObject({ status: "forbidden" });
    expect(callGatewayMock).not.toHaveBeenCalled();
  });

  it("sessions_spawn defaults allowAgents wildcard applies to all agents", async () => {
    setSessionsSpawnConfigOverride({
      session: {
        mainKey: "main",
        scope: "per-sender",
      },
      agents: {
        defaults: {
          subagents: {
            allowAgents: ["*"],
          },
        },
        list: [{ id: "main" }],
      },
    });
    const getChildSessionKey = mockAcceptedSpawn(5600);

    const result = await executeSpawn("call-defaults-wildcard", "any-agent");
    expect(result.details).toMatchObject({ status: "accepted" });
    expect(getChildSessionKey()?.startsWith("agent:any-agent:subagent:")).toBe(true);
  });

  it("forbids sandboxed cross-agent spawns that would unsandbox the child", async () => {
    setSessionsSpawnConfigOverride({
      session: {
        mainKey: "main",
        scope: "per-sender",
      },
      agents: {
        defaults: {
          sandbox: {
            mode: "all",
          },
        },
        list: [
          {
            id: "main",
            subagents: {
              allowAgents: ["research"],
            },
          },
          {
            id: "research",
            sandbox: {
              mode: "off",
            },
          },
        ],
      },
    });

    const result = await executeSpawn("call11", "research");
    const details = result.details as { status?: string; error?: string };

    expect(details.status).toBe("forbidden");
    expect(details.error).toContain("Sandboxed sessions cannot spawn unsandboxed subagents.");
    expect(callGatewayMock).not.toHaveBeenCalled();
  });

  it('forbids sandbox="require" when target runtime is unsandboxed', async () => {
    setSessionsSpawnConfigOverride({
      session: {
        mainKey: "main",
        scope: "per-sender",
      },
      agents: {
        list: [
          {
            id: "main",
            subagents: {
              allowAgents: ["research"],
            },
          },
          {
            id: "research",
            sandbox: {
              mode: "off",
            },
          },
        ],
      },
    });

    const result = await executeSpawn("call12", "research", "require");
    const details = result.details as { status?: string; error?: string };

    expect(details.status).toBe("forbidden");
    expect(details.error).toContain('sandbox="require"');
    expect(callGatewayMock).not.toHaveBeenCalled();
  });
});
