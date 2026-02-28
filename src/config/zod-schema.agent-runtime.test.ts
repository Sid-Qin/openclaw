import { describe, expect, it } from "vitest";
import { AgentEntrySchema } from "./zod-schema.agent-runtime.js";

describe("AgentEntrySchema params", () => {
  it("accepts per-agent params overrides", () => {
    expect(() =>
      AgentEntrySchema.parse({
        id: "main",
        params: {
          cacheRetention: "short",
          temperature: 0.2,
        },
      }),
    ).not.toThrow();
  });

  it("rejects non-object params values", () => {
    expect(() => AgentEntrySchema.parse({ id: "main", params: "invalid" })).toThrow();
  });
});
