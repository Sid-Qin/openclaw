import { describe, expect, it } from "vitest";
import {
  makeIsolatedAgentTurnParams,
  setupRunCronIsolatedAgentTurnSuite,
} from "./run.suite-helpers.js";
import {
  loadRunCronIsolatedAgentTurn,
  runEmbeddedPiAgentMock,
  runWithModelFallbackMock,
} from "./run.test-harness.js";

const runCronIsolatedAgentTurn = await loadRunCronIsolatedAgentTurn();

describe("runCronIsolatedAgentTurn — per-attempt abort signal", () => {
  setupRunCronIsolatedAgentTurnSuite();

  it("passes a per-attempt abort signal to runEmbeddedPiAgent, not the outer signal", async () => {
    const outerController = new AbortController();

    runWithModelFallbackMock.mockImplementation(async (params: { run: Function }) => {
      const result = await params.run("openai", "gpt-4", {});
      return { result, provider: "openai", model: "gpt-4" };
    });

    runEmbeddedPiAgentMock.mockResolvedValue({
      payloads: [{ text: "output" }],
      meta: { agentMeta: { usage: { input: 10, output: 20 } } },
    });

    await runCronIsolatedAgentTurn(
      makeIsolatedAgentTurnParams({ abortSignal: outerController.signal }),
    );

    expect(runEmbeddedPiAgentMock).toHaveBeenCalledTimes(1);
    const callArgs = runEmbeddedPiAgentMock.mock.calls[0][0];
    expect(callArgs.abortSignal).toBeDefined();
    expect(callArgs.abortSignal).not.toBe(outerController.signal);
    expect(callArgs.abortSignal.aborted).toBe(false);
  });

  it("forwards outer abort to the per-attempt signal", async () => {
    const outerController = new AbortController();

    runWithModelFallbackMock.mockImplementation(async (params: { run: Function }) => {
      const result = await params.run("openai", "gpt-4", {});
      return { result, provider: "openai", model: "gpt-4" };
    });

    runEmbeddedPiAgentMock.mockImplementation(async () => {
      outerController.abort("timeout");
      return {
        payloads: [{ text: "output" }],
        meta: { agentMeta: { usage: { input: 10, output: 20 } } },
      };
    });

    await runCronIsolatedAgentTurn(
      makeIsolatedAgentTurnParams({ abortSignal: outerController.signal }),
    );

    const callArgs = runEmbeddedPiAgentMock.mock.calls[0][0];
    expect(callArgs.abortSignal).toBeDefined();
    expect(callArgs.abortSignal.aborted).toBe(true);
  });
});
