import type { StreamFn } from "@mariozechner/pi-agent-core";
import { streamSimple } from "@mariozechner/pi-ai";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { safeJsonStringify } from "../utils/safe-json.js";

const log = createSubsystemLogger("agent/model-api");

const APPROX_CHARS_PER_TOKEN = 4;

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function estimateTokens(bytes: number): number {
  return Math.round(bytes / APPROX_CHARS_PER_TOKEN);
}

export type ModelApiLoggingParams = {
  modelId?: string;
  provider?: string;
  sessionId?: string;
};

function wrapStreamWithTiming(
  stream: ReturnType<typeof streamSimple>,
  startMs: number,
  requestSizeBytes: number,
  params: ModelApiLoggingParams,
): ReturnType<typeof streamSimple> {
  let firstEventLogged = false;
  let totalResponseChars = 0;

  const modelTag = params.modelId ?? "unknown";

  const originalAsyncIterator = stream[Symbol.asyncIterator].bind(stream);
  (stream as { [Symbol.asyncIterator]: typeof originalAsyncIterator })[Symbol.asyncIterator] =
    function () {
      const iterator = originalAsyncIterator();
      return {
        async next() {
          const result = await iterator.next();
          if (!result.done && result.value && typeof result.value === "object") {
            const event = result.value as { type?: string; delta?: string; content?: string };

            if (!firstEventLogged && event.type === "start") {
              const ttfbMs = Date.now() - startMs;
              log.info(
                `← model first byte: ${ttfbMs}ms, model=${modelTag}`,
                { ttfbMs, model: modelTag, provider: params.provider },
              );
              firstEventLogged = true;
            }

            if (event.type === "text_delta" && typeof event.delta === "string") {
              totalResponseChars += event.delta.length;
            }

            if (event.type === "done" || event.type === "error") {
              const totalMs = Date.now() - startMs;
              const responseSizeBytes = totalResponseChars;
              log.info(
                `← model response: ${formatBytes(responseSizeBytes)}, ` +
                  `latency=${(totalMs / 1000).toFixed(2)}s, model=${modelTag}`,
                {
                  responseSizeBytes,
                  latencyMs: totalMs,
                  model: modelTag,
                  provider: params.provider,
                  requestSizeBytes,
                  status: event.type,
                },
              );
            }
          }
          return result;
        },
        async return(value?: unknown) {
          return iterator.return?.(value) ?? { done: true as const, value: undefined };
        },
        async throw(error?: unknown) {
          return iterator.throw?.(error) ?? { done: true as const, value: undefined };
        },
      };
    };

  return stream;
}

export function wrapStreamFnWithModelApiLogging(
  baseFn: StreamFn,
  params: ModelApiLoggingParams,
): StreamFn {
  const modelTag = params.modelId ?? "unknown";

  return (model, context, options) => {
    let requestSizeBytes = 0;
    const startMs = Date.now();

    const nextOnPayload = (payload: unknown) => {
      const serialized = safeJsonStringify(payload);
      if (serialized) {
        requestSizeBytes = serialized.length;
        const estTokens = estimateTokens(requestSizeBytes);
        log.info(
          `→ model request: ${formatBytes(requestSizeBytes)} (~${estTokens} tokens), model=${modelTag}`,
          {
            requestSizeBytes,
            estimatedTokens: estTokens,
            model: modelTag,
            provider: params.provider,
          },
        );
      }
      options?.onPayload?.(payload);
    };

    const maybeStream = baseFn(model, context, {
      ...options,
      onPayload: nextOnPayload,
    });

    if (maybeStream && typeof maybeStream === "object" && "then" in maybeStream) {
      return Promise.resolve(maybeStream).then((stream) =>
        wrapStreamWithTiming(stream, startMs, requestSizeBytes, params),
      );
    }

    return wrapStreamWithTiming(maybeStream, startMs, requestSizeBytes, params);
  };
}
