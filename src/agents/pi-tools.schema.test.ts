import { describe, expect, it } from "vitest";
import { cleanSchemaForAnthropic, normalizeToolParameters } from "./pi-tools.schema.js";
import type { AnyAgentTool } from "./pi-tools.types.js";

function createTool(parameters: Record<string, unknown>): AnyAgentTool {
  return {
    name: "test_tool",
    description: "test",
    parameters,
    execute: async () => ({ content: [] }),
  } as unknown as AnyAgentTool;
}

describe("cleanSchemaForAnthropic", () => {
  it("replaces catch-all patternProperties with additionalProperties", () => {
    const cleaned = cleanSchemaForAnthropic({
      type: "object",
      properties: {
        fields: {
          type: "object",
          patternProperties: {
            "^(.*)$": {},
          },
        },
      },
    }) as {
      properties?: { fields?: { patternProperties?: unknown; additionalProperties?: unknown } };
    };

    expect(cleaned.properties?.fields?.patternProperties).toBeUndefined();
    expect(cleaned.properties?.fields?.additionalProperties).toBe(true);
  });

  it("preserves non-catch-all patternProperties when present", () => {
    const cleaned = cleanSchemaForAnthropic({
      type: "object",
      properties: {
        fields: {
          type: "object",
          additionalProperties: false,
          patternProperties: {
            "^x-": { type: "string" },
          },
        },
      },
    }) as {
      properties?: { fields?: { patternProperties?: unknown; additionalProperties?: unknown } };
    };

    expect(cleaned.properties?.fields?.patternProperties).toEqual({
      "^x-": { type: "string" },
    });
    expect(cleaned.properties?.fields?.additionalProperties).toBe(false);
  });
});

describe("normalizeToolParameters", () => {
  it("applies anthropic schema cleaning for tool parameters", () => {
    const tool = createTool({
      type: "object",
      properties: {
        fields: {
          type: "object",
          patternProperties: {
            "^(.*)$": {},
          },
        },
      },
    });

    const normalized = normalizeToolParameters(tool, { modelProvider: "anthropic" });
    const schema = normalized.parameters as {
      properties?: { fields?: { patternProperties?: unknown; additionalProperties?: unknown } };
    };

    expect(schema.properties?.fields?.patternProperties).toBeUndefined();
    expect(schema.properties?.fields?.additionalProperties).toBe(true);
  });

  it("cleans anthropic schemas even when they do not need structural normalization", () => {
    const tool = createTool({
      type: "object",
      patternProperties: {
        "^(.*)$": {},
      },
    });

    const normalized = normalizeToolParameters(tool, { modelProvider: "anthropic" });
    const schema = normalized.parameters as {
      patternProperties?: unknown;
      additionalProperties?: unknown;
    };

    expect(schema.patternProperties).toBeUndefined();
    expect(schema.additionalProperties).toBe(true);
  });

  it("does not clean patternProperties for non-anthropic providers", () => {
    const tool = createTool({
      type: "object",
      properties: {
        fields: {
          type: "object",
          patternProperties: {
            "^(.*)$": {},
          },
        },
      },
    });

    const normalized = normalizeToolParameters(tool, { modelProvider: "openai" });
    const schema = normalized.parameters as {
      properties?: { fields?: { patternProperties?: unknown; additionalProperties?: unknown } };
    };

    expect(schema.properties?.fields?.patternProperties).toEqual({
      "^(.*)$": {},
    });
    expect(schema.properties?.fields?.additionalProperties).toBeUndefined();
  });
});
