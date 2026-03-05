function isAllowedWebhookProtocol(protocol: string) {
  return protocol === "http:" || protocol === "https:";
}

export type WebhookUrlValidation =
  | { url: string; reason?: undefined }
  | { url: null; reason: string };

export function validateHttpWebhookUrl(value: unknown): WebhookUrlValidation {
  if (typeof value !== "string") {
    return { url: null, reason: "not_a_string" };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { url: null, reason: "empty" };
  }
  try {
    const parsed = new URL(trimmed);
    if (!isAllowedWebhookProtocol(parsed.protocol)) {
      return { url: null, reason: `blocked_scheme:${parsed.protocol.replace(/:$/, "")}` };
    }
    return { url: trimmed };
  } catch {
    return { url: null, reason: "malformed_url" };
  }
}

export function normalizeHttpWebhookUrl(value: unknown): string | null {
  return validateHttpWebhookUrl(value).url;
}
