import { createTypingKeepaliveLoop } from "./typing-lifecycle.js";

export type TypingCallbacks = {
  onReplyStart: () => Promise<void>;
  onIdle?: () => void;
  /** Called when the typing controller is cleaned up (e.g., on NO_REPLY). */
  onCleanup?: () => void;
};

const MAX_CONSECUTIVE_ERRORS = 3;

export function createTypingCallbacks(params: {
  start: () => Promise<void>;
  stop?: () => Promise<void>;
  onStartError: (err: unknown) => void;
  onStopError?: (err: unknown) => void;
  keepaliveIntervalMs?: number;
  maxConsecutiveErrors?: number;
}): TypingCallbacks {
  const stop = params.stop;
  const keepaliveIntervalMs = params.keepaliveIntervalMs ?? 3_000;
  const maxErrors = params.maxConsecutiveErrors ?? MAX_CONSECUTIVE_ERRORS;
  let stopSent = false;
  let closed = false;
  let consecutiveErrors = 0;

  const fireStart = async () => {
    if (closed) {
      return;
    }
    try {
      await params.start();
      consecutiveErrors = 0;
    } catch (err) {
      consecutiveErrors++;
      params.onStartError(err);
      if (consecutiveErrors >= maxErrors) {
        closed = true;
        keepaliveLoop.stop();
      }
    }
  };

  const keepaliveLoop = createTypingKeepaliveLoop({
    intervalMs: keepaliveIntervalMs,
    onTick: fireStart,
  });

  const onReplyStart = async () => {
    if (closed) {
      return;
    }
    stopSent = false;
    keepaliveLoop.stop();
    await fireStart();
    keepaliveLoop.start();
  };

  const fireStop = () => {
    closed = true;
    keepaliveLoop.stop();
    if (!stop || stopSent) {
      return;
    }
    stopSent = true;
    void stop().catch((err) => (params.onStopError ?? params.onStartError)(err));
  };

  return { onReplyStart, onIdle: fireStop, onCleanup: fireStop };
}
