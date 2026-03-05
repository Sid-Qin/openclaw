import { describe, expect, it } from "vitest";
import {
  hasUnbackedReminderCommitment,
  appendUnscheduledReminderNote,
  UNSCHEDULED_REMINDER_NOTE,
} from "./agent-runner-reminder-guard.js";

describe("hasUnbackedReminderCommitment", () => {
  describe("English — original patterns", () => {
    it.each([
      "I'll remind you about this later",
      "I will follow up on this tomorrow",
      "I'll check back in 30 minutes",
      "I will circle back with the results",
      "I'll make sure to remind you",
      "I'll set a reminder for you",
      "I will create a reminder",
      "I will schedule a reminder for 3pm",
    ])("matches: %s", (text) => {
      expect(hasUnbackedReminderCommitment(text)).toBe(true);
    });
  });

  describe("English — new expanded patterns", () => {
    it.each([
      "I'll let you know when it's done",
      "I will update you with the results",
      "I'll get back to you shortly",
      "I will notify you when the task completes",
      "I'll message you later today",
      "I'll ping you when it's ready",
      "I will reach out after the meeting",
      "I'll touch base with you tomorrow",
      "I'll keep you posted on progress",
      "I will keep you updated",
      "I'll keep you informed",
    ])("matches: %s", (text) => {
      expect(hasUnbackedReminderCommitment(text)).toBe(true);
    });
  });

  describe("Chinese patterns", () => {
    it.each([
      "稍后提醒你",
      "之后通知你结果",
      "待会儿告诉你",
      "回头同步一下进度",
      "晚点更新你",
      "等下反馈给你",
      "到时候告诉你",
      "到时通知你",
      "完成后通知你",
      "做完之后告诉你",
      "搞定以后同步一下",
      "我会提醒你的",
      "我来通知你",
      "我会告诉你结果",
      "我会同步进度",
      "我会给你反馈",
      "我会给你回馈",
      "过会儿提醒你",
      "到时候给你反馈",
    ])("matches: %s", (text) => {
      expect(hasUnbackedReminderCommitment(text)).toBe(true);
    });
  });

  describe("negative cases — should NOT trigger", () => {
    it.each([
      "Here is the information you requested.",
      "The task is complete.",
      "I've finished the analysis.",
      "Let me know if you need anything else.",
      "Sure, I can help with that.",
      "这是你要的信息。",
      "任务已完成。",
      "需要其他帮助吗？",
      "",
      "   ",
    ])("does not match: %s", (text) => {
      expect(hasUnbackedReminderCommitment(text)).toBe(false);
    });
  });

  it("does not match when the unscheduled note is already present", () => {
    const text = `I'll remind you later.\n\n${UNSCHEDULED_REMINDER_NOTE}`;
    expect(hasUnbackedReminderCommitment(text)).toBe(false);
  });
});

describe("appendUnscheduledReminderNote", () => {
  it("appends note to first matching payload", () => {
    const payloads = [{ text: "I'll let you know when done." }];
    const result = appendUnscheduledReminderNote(payloads);
    expect(result[0].text).toContain(UNSCHEDULED_REMINDER_NOTE);
  });

  it("does not append to error payloads", () => {
    const payloads = [{ text: "I'll remind you later.", isError: true }];
    const result = appendUnscheduledReminderNote(payloads);
    expect(result[0].text).not.toContain(UNSCHEDULED_REMINDER_NOTE);
  });

  it("appends only once across multiple payloads", () => {
    const payloads = [
      { text: "I'll remind you about task A." },
      { text: "I'll remind you about task B." },
    ];
    const result = appendUnscheduledReminderNote(payloads);
    expect(result[0].text).toContain(UNSCHEDULED_REMINDER_NOTE);
    expect(result[1].text).not.toContain(UNSCHEDULED_REMINDER_NOTE);
  });

  it("works with Chinese follow-up promise text", () => {
    const payloads = [{ text: "好的，完成后通知你。" }];
    const result = appendUnscheduledReminderNote(payloads);
    expect(result[0].text).toContain(UNSCHEDULED_REMINDER_NOTE);
  });

  it("leaves non-matching payloads unchanged", () => {
    const payloads = [{ text: "Here is your answer." }];
    const result = appendUnscheduledReminderNote(payloads);
    expect(result[0].text).toBe("Here is your answer.");
  });
});
