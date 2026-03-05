import { loadCronStore, resolveCronStorePath } from "../../cron/store.js";
import type { ReplyPayload } from "../types.js";

export const UNSCHEDULED_REMINDER_NOTE =
  "Note: I did not schedule a reminder in this turn, so this will not trigger automatically.";

const REMINDER_COMMITMENT_PATTERNS: RegExp[] = [
  /\b(?:i\s*['\u2018\u2019]?ll|i will)\s+(?:make sure to\s+)?(?:remember|remind|ping|follow up|follow-up|check back|circle back)\b/i,
  /\b(?:i\s*['\u2018\u2019]?ll|i will)\s+(?:set|create|schedule)\s+(?:a\s+)?reminder\b/i,
  /\b(?:i\s*['\u2018\u2019]?ll|i will)\s+(?:let you know|update you|get back to you|notify you|message you)\b/i,
  /\b(?:i\s*['\u2018\u2019]?ll|i will)\s+(?:ping|poke|nudge|buzz)\s+you\b/i,
  /\b(?:i\s*['\u2018\u2019]?ll|i will)\s+(?:reach out|touch base|keep you (?:posted|updated|informed))\b/i,
  /(?:稍后|之后|待会儿?|回头|晚[点些]|过[会一]儿?|等下|到时候?)\s*(?:提醒|通知|告[诉知]|同步|反馈|回复|更新|汇报)/,
  /(?:完成|做完|搞定|结束|好了)\s*(?:后|之后|以后)\s*(?:提醒|通知|告[诉知]|同步|更新|汇报)/,
  /(?:我[会来])\s*(?:提醒你|通知你|告诉你|同步进度|更新你|给你[回反]馈)/,
  /(?:到时候?)\s*(?:告诉你|通知你|提醒你|给你[回反]馈|同步)/,
];

export function hasUnbackedReminderCommitment(text: string): boolean {
  const normalized = text.toLowerCase();
  if (!normalized.trim()) {
    return false;
  }
  if (normalized.includes(UNSCHEDULED_REMINDER_NOTE.toLowerCase())) {
    return false;
  }
  return REMINDER_COMMITMENT_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Returns true when the cron store has at least one enabled job that shares the
 * current session key. Used to suppress the "no reminder scheduled" guard note
 * when an existing cron (created in a prior turn) already covers the commitment.
 */
export async function hasSessionRelatedCronJobs(params: {
  cronStorePath?: string;
  sessionKey?: string;
}): Promise<boolean> {
  try {
    const storePath = resolveCronStorePath(params.cronStorePath);
    const store = await loadCronStore(storePath);
    if (store.jobs.length === 0) {
      return false;
    }
    if (params.sessionKey) {
      return store.jobs.some((job) => job.enabled && job.sessionKey === params.sessionKey);
    }
    return false;
  } catch {
    // If we cannot read the cron store, do not suppress the note.
    return false;
  }
}

export function appendUnscheduledReminderNote(payloads: ReplyPayload[]): ReplyPayload[] {
  let appended = false;
  return payloads.map((payload) => {
    if (appended || payload.isError || typeof payload.text !== "string") {
      return payload;
    }
    if (!hasUnbackedReminderCommitment(payload.text)) {
      return payload;
    }
    appended = true;
    const trimmed = payload.text.trimEnd();
    return {
      ...payload,
      text: `${trimmed}\n\n${UNSCHEDULED_REMINDER_NOTE}`,
    };
  });
}
