import { describe, expect, it } from "vitest";
import { splitTelegramReasoningText } from "./reasoning-lane-coordinator.js";

describe("splitTelegramReasoningText", () => {
  it("splits real tagged reasoning and answer", () => {
    expect(splitTelegramReasoningText("<think>example</think>Done")).toEqual({
      reasoningText: "Reasoning:\n_example_",
      answerText: "Done",
    });
  });

  it("ignores literal think tags inside inline code", () => {
    const text = "Use `<think>example</think>` literally.";
    expect(splitTelegramReasoningText(text)).toEqual({
      answerText: text,
    });
  });

  it("ignores literal think tags inside fenced code", () => {
    const text = "```xml\n<think>example</think>\n```";
    expect(splitTelegramReasoningText(text)).toEqual({
      answerText: text,
    });
  });

  it("does not emit partial reasoning tag prefixes", () => {
    expect(splitTelegramReasoningText("  <thi")).toEqual({});
  });

  it("suppresses bare 'Reasoning:\\n' prefix chunk", () => {
    expect(splitTelegramReasoningText("Reasoning:\n")).toEqual({});
  });

  it("suppresses bare 'Reasoning:' without newline", () => {
    expect(splitTelegramReasoningText("Reasoning:")).toEqual({});
  });

  it("keeps full reasoning message with content after prefix", () => {
    const text = "Reasoning:\nThis is the reasoning content";
    expect(splitTelegramReasoningText(text)).toEqual({
      reasoningText: text,
    });
  });
});
