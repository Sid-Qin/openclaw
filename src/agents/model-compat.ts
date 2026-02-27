import type { Api, Model } from "@mariozechner/pi-ai";

function isOpenAiCompletionsModel(model: Model<Api>): model is Model<"openai-completions"> {
  return model.api === "openai-completions";
}

function isDashScopeCompatibleEndpoint(baseUrl: string): boolean {
  return (
    baseUrl.includes("dashscope.aliyuncs.com") ||
    baseUrl.includes("dashscope-intl.aliyuncs.com") ||
    baseUrl.includes("dashscope-us.aliyuncs.com")
  );
}

function isAnthropicMessagesModel(model: Model<Api>): model is Model<"anthropic-messages"> {
  return model.api === "anthropic-messages";
}

const NVIDIA_MINIMAX_MODEL_PREFIX = "minimaxai/";

function isNvidiaMinimaxModel(model: Model<"openai-completions">): boolean {
  return (
    model.provider === "nvidia" &&
    model.id.trim().toLowerCase().startsWith(NVIDIA_MINIMAX_MODEL_PREFIX)
  );
}

function normalizeNvidiaMinimaxCompat(
  model: Model<"openai-completions">,
): Model<"openai-completions"> {
  if (!isNvidiaMinimaxModel(model)) {
    return model;
  }

  const compat = model.compat ?? {};
  const nextCompat = {
    ...compat,
    supportsStore: compat.supportsStore ?? false,
    supportsDeveloperRole: compat.supportsDeveloperRole ?? false,
    supportsReasoningEffort: compat.supportsReasoningEffort ?? false,
    supportsUsageInStreaming: compat.supportsUsageInStreaming ?? false,
    maxTokensField: compat.maxTokensField ?? "max_tokens",
  };
  const changed =
    compat.supportsStore !== nextCompat.supportsStore ||
    compat.supportsDeveloperRole !== nextCompat.supportsDeveloperRole ||
    compat.supportsReasoningEffort !== nextCompat.supportsReasoningEffort ||
    compat.supportsUsageInStreaming !== nextCompat.supportsUsageInStreaming ||
    compat.maxTokensField !== nextCompat.maxTokensField;
  if (!changed) {
    return model;
  }
  return { ...model, compat: nextCompat };
}

/**
 * pi-ai constructs the Anthropic API endpoint as `${baseUrl}/v1/messages`.
 * If a user configures `baseUrl` with a trailing `/v1` (e.g. the previously
 * recommended format "https://api.anthropic.com/v1"), the resulting URL
 * becomes "…/v1/v1/messages" which the Anthropic API rejects with a 404.
 *
 * Strip a single trailing `/v1` (with optional trailing slash) from the
 * baseUrl for anthropic-messages models so users with either format work.
 */
function normalizeAnthropicBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/v1\/?$/, "");
}
export function normalizeModelCompat(model: Model<Api>): Model<Api> {
  const baseUrl = model.baseUrl ?? "";

  // Normalise anthropic-messages baseUrl: strip trailing /v1 that users may
  // have included in their config. pi-ai appends /v1/messages itself.
  if (isAnthropicMessagesModel(model) && baseUrl) {
    const normalised = normalizeAnthropicBaseUrl(baseUrl);
    if (normalised !== baseUrl) {
      return { ...model, baseUrl: normalised } as Model<"anthropic-messages">;
    }
  }

  if (!isOpenAiCompletionsModel(model)) {
    return model;
  }

  const openaiModel = normalizeNvidiaMinimaxCompat(model);
  const openaiBaseUrl = openaiModel.baseUrl ?? "";
  const isZai = openaiModel.provider === "zai" || openaiBaseUrl.includes("api.z.ai");
  const isMoonshot =
    openaiModel.provider === "moonshot" ||
    openaiBaseUrl.includes("moonshot.ai") ||
    openaiBaseUrl.includes("moonshot.cn");
  const isDashScope =
    openaiModel.provider === "dashscope" || isDashScopeCompatibleEndpoint(openaiBaseUrl);
  if (!isZai && !isMoonshot && !isDashScope) {
    return openaiModel;
  }

  const compat = openaiModel.compat ?? undefined;
  if (compat?.supportsDeveloperRole === false) {
    return openaiModel;
  }

  return {
    ...openaiModel,
    compat: compat ? { ...compat, supportsDeveloperRole: false } : { supportsDeveloperRole: false },
  };
}
