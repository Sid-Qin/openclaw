import { describe, expect, it } from "vitest";
import { buildPayloads, expectSingleToolErrorPayload } from "./payloads.test-helpers.js";

describe("buildEmbeddedRunPayloads tool-error warnings", () => {
  it("suppresses exec tool errors when verbose mode is off", () => {
    const payloads = buildPayloads({
      lastToolError: { toolName: "exec", error: "command failed" },
      verboseLevel: "off",
    });

    expect(payloads).toHaveLength(0);
  });

  it("shows exec tool errors when verbose mode is on", () => {
    const payloads = buildPayloads({
      lastToolError: { toolName: "exec", error: "command failed" },
      verboseLevel: "on",
    });

    expectSingleToolErrorPayload(payloads, {
      title: "Exec",
      detail: "command failed",
    });
  });

  it("keeps non-exec mutating tool failures visible", () => {
    const payloads = buildPayloads({
      lastToolError: { toolName: "write", error: "permission denied" },
      verboseLevel: "off",
    });

    expectSingleToolErrorPayload(payloads, {
      title: "Write",
      absentDetail: "permission denied",
    });
  });

  it.each([
    {
      name: "includes details for mutating tool failures when verbose is on",
      verboseLevel: "on" as const,
      detail: "permission denied",
      absentDetail: undefined,
    },
    {
      name: "includes details for mutating tool failures when verbose is full",
      verboseLevel: "full" as const,
      detail: "permission denied",
      absentDetail: undefined,
    },
  ])("$name", ({ verboseLevel, detail, absentDetail }) => {
    const payloads = buildPayloads({
      lastToolError: { toolName: "write", error: "permission denied" },
      verboseLevel,
    });

    expectSingleToolErrorPayload(payloads, {
      title: "Write",
      detail,
      absentDetail,
    });
  });

  it("suppresses sessions_send errors to avoid leaking transient relay failures", () => {
    const payloads = buildPayloads({
      lastToolError: { toolName: "sessions_send", error: "delivery timeout" },
      verboseLevel: "on",
    });

    expect(payloads).toHaveLength(0);
  });

  it("suppresses sessions_send errors even when marked mutating", () => {
    const payloads = buildPayloads({
      lastToolError: {
        toolName: "sessions_send",
        error: "delivery timeout",
        mutatingAction: true,
      },
      verboseLevel: "on",
    });

    expect(payloads).toHaveLength(0);
  });

  it("suppresses mutating tool warning when same tool+meta succeeded later in turn", () => {
    const payloads = buildPayloads({
      lastToolError: {
        toolName: "edit",
        meta: "src/app.ts",
        error: "Found 2 occurrences, must be unique",
        mutatingAction: true,
      },
      toolMetas: [
        { toolName: "read", meta: "src/app.ts" },
        { toolName: "edit", meta: "src/app.ts" },
      ],
    });

    expect(payloads).toHaveLength(0);
  });

  it("still shows mutating tool warning when no matching success in turn", () => {
    const payloads = buildPayloads({
      lastToolError: {
        toolName: "edit",
        meta: "src/app.ts",
        error: "permission denied",
        mutatingAction: true,
      },
      toolMetas: [
        { toolName: "read", meta: "src/app.ts" },
        { toolName: "edit", meta: "src/other.ts" },
      ],
    });

    expectSingleToolErrorPayload(payloads, {
      title: "Edit",
      absentDetail: "permission denied",
    });
  });
});
