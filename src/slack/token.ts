import { normalizeResolvedSecretInputString } from "../config/types.secrets.js";

function safeNormalize(value: unknown, path: string): string | undefined {
  try {
    return normalizeResolvedSecretInputString({ value, path });
  } catch {
    return undefined;
  }
}

export function normalizeSlackToken(raw?: unknown): string | undefined {
  return safeNormalize(raw, "channels.slack.*.token");
}

export function resolveSlackBotToken(
  raw?: unknown,
  path = "channels.slack.botToken",
): string | undefined {
  return safeNormalize(raw, path);
}

export function resolveSlackAppToken(
  raw?: unknown,
  path = "channels.slack.appToken",
): string | undefined {
  return safeNormalize(raw, path);
}

export function resolveSlackUserToken(
  raw?: unknown,
  path = "channels.slack.userToken",
): string | undefined {
  return safeNormalize(raw, path);
}
