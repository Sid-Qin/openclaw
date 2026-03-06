import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import {
  clearFastTestEnv,
  loadRunCronIsolatedAgentTurn,
  makeCronSession,
  makeCronSessionEntry,
  resolveAgentConfigMock,
  resolveAllowedModelRefMock,
  resolveConfiguredModelRefMock,
  resolveCronSessionMock,
  resetRunCronIsolatedAgentTurnHarness,
  restoreFastTestEnv,
  runWithModelFallbackMock,
  updateSessionStoreMock,
} from "./run.test-harness.js";

const runCronIsolatedAgentTurn = await loadRunCronIsolatedAgentTurn();

function makeJob(overrides?: Record<string, unknown>) {
  return {
    id: "sandbox-job",
    name: "Sandbox test",
    schedule: { kind: "cron", expr: "0 9 * * *", tz: "UTC" },
    sessionTarget: "isolated",
    payload: { kind: "agentTurn", message: "run" },
    ...overrides,
  } as never;
}

describe("runCronIsolatedAgentTurn — sandbox shallow-merge guard (#38067)", () => {
  let previousFastTestEnv: string | undefined;

  beforeEach(() => {
    previousFastTestEnv = clearFastTestEnv();
    resetRunCronIsolatedAgentTurnHarness();
  });

  afterEach(() => {
    restoreFastTestEnv(previousFastTestEnv);
  });

  it("preserves defaults.sandbox when agent config has its own sandbox", async () => {
    const cfg: Partial<OpenClawConfig> = {
      agents: {
        defaults: {
          sandbox: {
            docker: {
              dangerouslyAllowExternalBindSources: true,
              network: "host",
            },
          } as never,
        },
      },
    };

    resolveAgentConfigMock.mockReturnValue({
      sandbox: {
        docker: {
          binds: ["/data/shared:/mnt/shared"],
        },
      },
    });

    resolveCronSessionMock.mockReturnValue(
      makeCronSession({ sessionEntry: makeCronSessionEntry() }),
    );
    resolveConfiguredModelRefMock.mockReturnValue({ provider: "openai", model: "gpt-4" });
    resolveAllowedModelRefMock.mockReturnValue({ ref: { provider: "openai", model: "gpt-4" } });
    updateSessionStoreMock.mockResolvedValue(undefined);
    runWithModelFallbackMock.mockResolvedValue({
      result: {
        payloads: [{ text: "done" }],
        meta: { agentMeta: { usage: { input: 10, output: 20 } } },
      },
      provider: "openai",
      model: "gpt-4",
    });

    await runCronIsolatedAgentTurn({
      cfg: cfg as OpenClawConfig,
      deps: {} as never,
      job: makeJob({ agentId: "kotik" }),
      message: "run",
    } as never);

    const fallbackCall = runWithModelFallbackMock.mock.calls[0];
    expect(fallbackCall).toBeDefined();

    const runCallback = fallbackCall[0].run;
    expect(runCallback).toBeInstanceOf(Function);

    const mergedCfg = fallbackCall[0].cfg as OpenClawConfig;
    const mergedSandbox = mergedCfg.agents?.defaults?.sandbox as Record<string, unknown>;

    expect(mergedSandbox?.docker).toEqual(
      expect.objectContaining({
        dangerouslyAllowExternalBindSources: true,
        network: "host",
      }),
    );
  });

  it("does not lose defaults.sandbox when agent has no sandbox override", async () => {
    const cfg: Partial<OpenClawConfig> = {
      agents: {
        defaults: {
          sandbox: {
            docker: {
              dangerouslyAllowExternalBindSources: true,
            },
          } as never,
        },
      },
    };

    resolveAgentConfigMock.mockReturnValue({ model: "anthropic/claude-sonnet-4-6" });

    resolveCronSessionMock.mockReturnValue(
      makeCronSession({ sessionEntry: makeCronSessionEntry() }),
    );
    resolveConfiguredModelRefMock.mockReturnValue({ provider: "openai", model: "gpt-4" });
    resolveAllowedModelRefMock.mockReturnValue({ ref: { provider: "openai", model: "gpt-4" } });
    updateSessionStoreMock.mockResolvedValue(undefined);
    runWithModelFallbackMock.mockResolvedValue({
      result: {
        payloads: [{ text: "done" }],
        meta: { agentMeta: { usage: { input: 10, output: 20 } } },
      },
      provider: "openai",
      model: "gpt-4",
    });

    await runCronIsolatedAgentTurn({
      cfg: cfg as OpenClawConfig,
      deps: {} as never,
      job: makeJob({ agentId: "other" }),
      message: "run",
    } as never);

    const mergedCfg = runWithModelFallbackMock.mock.calls[0][0].cfg as OpenClawConfig;
    const mergedSandbox = mergedCfg.agents?.defaults?.sandbox as Record<string, unknown>;

    expect(mergedSandbox?.docker).toEqual(
      expect.objectContaining({ dangerouslyAllowExternalBindSources: true }),
    );
  });
});
