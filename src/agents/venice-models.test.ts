import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildVeniceModelDefinition,
  discoverVeniceModels,
  VENICE_MODEL_CATALOG,
  __testing,
} from "./venice-models.js";

const { resolveApiMaxCompletionTokens, VENICE_DEFAULT_MAX_TOKENS } = __testing;

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_VITEST = process.env.VITEST;

function restoreDiscoveryEnv(): void {
  if (ORIGINAL_NODE_ENV === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  }

  if (ORIGINAL_VITEST === undefined) {
    delete process.env.VITEST;
  } else {
    process.env.VITEST = ORIGINAL_VITEST;
  }
}

async function runWithDiscoveryEnabled<T>(operation: () => Promise<T>): Promise<T> {
  process.env.NODE_ENV = "development";
  delete process.env.VITEST;
  try {
    return await operation();
  } finally {
    restoreDiscoveryEnv();
  }
}

function makeModelsResponse(id: string, opts?: { maxCompletionTokens?: number }): Response {
  return new Response(
    JSON.stringify({
      data: [
        {
          id,
          model_spec: {
            name: id,
            privacy: "private",
            availableContextTokens: 131072,
            ...(opts?.maxCompletionTokens !== undefined && {
              maxCompletionTokens: opts.maxCompletionTokens,
            }),
            capabilities: {
              supportsReasoning: false,
              supportsVision: false,
              supportsFunctionCalling: true,
            },
          },
        },
      ],
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

describe("venice-models", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    restoreDiscoveryEnv();
  });

  it("buildVeniceModelDefinition returns config with required fields", () => {
    const entry = VENICE_MODEL_CATALOG[0];
    const def = buildVeniceModelDefinition(entry);
    expect(def.id).toBe(entry.id);
    expect(def.name).toBe(entry.name);
    expect(def.reasoning).toBe(entry.reasoning);
    expect(def.input).toEqual(entry.input);
    expect(def.cost).toEqual({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
    expect(def.contextWindow).toBe(entry.contextWindow);
    expect(def.maxTokens).toBe(entry.maxTokens);
  });

  it("retries transient fetch failures before succeeding", async () => {
    let attempts = 0;
    const fetchMock = vi.fn(async () => {
      attempts += 1;
      if (attempts < 3) {
        throw Object.assign(new TypeError("fetch failed"), {
          cause: { code: "ECONNRESET", message: "socket hang up" },
        });
      }
      return makeModelsResponse("llama-3.3-70b");
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const models = await runWithDiscoveryEnabled(() => discoverVeniceModels());
    expect(attempts).toBe(3);
    expect(models.map((m) => m.id)).toContain("llama-3.3-70b");
  });

  it("uses API maxCompletionTokens for catalog models when present", async () => {
    const fetchMock = vi.fn(async () =>
      makeModelsResponse("llama-3.3-70b", { maxCompletionTokens: 4096 }),
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const models = await runWithDiscoveryEnabled(() => discoverVeniceModels());
    const llama = models.find((m) => m.id === "llama-3.3-70b");
    expect(llama).toBeDefined();
    expect(llama!.maxTokens).toBe(4096);
  });

  it("uses API maxCompletionTokens for non-catalog models", async () => {
    const fetchMock = vi.fn(async () =>
      makeModelsResponse("new-model-2026", { maxCompletionTokens: 2048 }),
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const models = await runWithDiscoveryEnabled(() => discoverVeniceModels());
    const newModel = models.find((m) => m.id === "new-model-2026");
    expect(newModel).toBeDefined();
    expect(newModel!.maxTokens).toBe(2048);
  });

  it("falls back to conservative default when API omits maxCompletionTokens for non-catalog models", async () => {
    const fetchMock = vi.fn(async () => makeModelsResponse("unknown-model"));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const models = await runWithDiscoveryEnabled(() => discoverVeniceModels());
    const unknownModel = models.find((m) => m.id === "unknown-model");
    expect(unknownModel).toBeDefined();
    expect(unknownModel!.maxTokens).toBe(VENICE_DEFAULT_MAX_TOKENS);
  });

  it("falls back to static catalog after retry budget is exhausted", async () => {
    const fetchMock = vi.fn(async () => {
      throw Object.assign(new TypeError("fetch failed"), {
        cause: { code: "ENOTFOUND", message: "getaddrinfo ENOTFOUND api.venice.ai" },
      });
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const models = await runWithDiscoveryEnabled(() => discoverVeniceModels());
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(models).toHaveLength(VENICE_MODEL_CATALOG.length);
    expect(models.map((m) => m.id)).toEqual(VENICE_MODEL_CATALOG.map((m) => m.id));
  });
});

describe("resolveApiMaxCompletionTokens", () => {
  const makeModel = (maxCompletionTokens?: number | null) =>
    ({
      id: "test",
      model_spec: {
        name: "test",
        privacy: "private" as const,
        availableContextTokens: 128000,
        ...(maxCompletionTokens !== null && { maxCompletionTokens }),
        capabilities: {
          supportsReasoning: false,
          supportsVision: false,
          supportsFunctionCalling: true,
        },
      },
    }) as Parameters<typeof resolveApiMaxCompletionTokens>[0];

  it("returns the value when present and valid", () => {
    expect(resolveApiMaxCompletionTokens(makeModel(4096))).toBe(4096);
  });

  it("returns undefined when missing", () => {
    expect(resolveApiMaxCompletionTokens(makeModel(null))).toBeUndefined();
  });

  it("returns undefined for non-finite values", () => {
    expect(resolveApiMaxCompletionTokens(makeModel(NaN))).toBeUndefined();
    expect(resolveApiMaxCompletionTokens(makeModel(Infinity))).toBeUndefined();
  });

  it("returns undefined for zero or negative", () => {
    expect(resolveApiMaxCompletionTokens(makeModel(0))).toBeUndefined();
    expect(resolveApiMaxCompletionTokens(makeModel(-1))).toBeUndefined();
  });
});
