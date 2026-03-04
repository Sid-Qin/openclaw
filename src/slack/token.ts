import { normalizeSecretInputStringTolerant } from "../config/types.secrets.js";

export function normalizeSlackToken(raw?: unknown): string | undefined {
  return normalizeSecretInputStringTolerant({ value: raw });
}

export function resolveSlackBotToken(raw?: unknown, _path?: string): string | undefined {
  return normalizeSecretInputStringTolerant({ value: raw });
}

export function resolveSlackAppToken(raw?: unknown, _path?: string): string | undefined {
  return normalizeSecretInputStringTolerant({ value: raw });
}

export function resolveSlackUserToken(raw?: unknown, _path?: string): string | undefined {
  return normalizeSecretInputStringTolerant({ value: raw });
}
