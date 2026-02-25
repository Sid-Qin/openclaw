export type TypingCallbacks = {
  onReplyStart: () => Promise<void>;
  onIdle?: () => void;
  /** Called when the typing controller is cleaned up (e.g., on NO_REPLY). */
  onCleanup?: () => void;
};

export function createTypingCallbacks(params: {
  start: () => Promise<void>;
  stop?: () => Promise<void>;
  onStartError: (err: unknown) => void;
  onStopError?: (err: unknown) => void;
  keepAliveIntervalSeconds?: number;
}): TypingCallbacks {
  const stop = params.stop;
  const keepAliveIntervalSeconds = params.keepAliveIntervalSeconds ?? 4;
  const keepAliveIntervalMs = Math.max(0, Math.floor(keepAliveIntervalSeconds * 1000));
  let keepAliveTimer: NodeJS.Timeout | undefined;

  const clearKeepAlive = () => {
    if (!keepAliveTimer) {
      return;
    }
    clearInterval(keepAliveTimer);
    keepAliveTimer = undefined;
  };

  const fireStart = async () => {
    try {
      await params.start();
    } catch (err) {
      params.onStartError(err);
    }
  };

  const ensureKeepAlive = () => {
    if (keepAliveIntervalMs <= 0 || keepAliveTimer) {
      return;
    }
    keepAliveTimer = setInterval(() => {
      void fireStart();
    }, keepAliveIntervalMs);
  };

  const onReplyStart = async () => {
    await fireStart();
    ensureKeepAlive();
  };

  const fireStop = stop
    ? () => {
        clearKeepAlive();
        void stop().catch((err) => (params.onStopError ?? params.onStartError)(err));
      }
    : clearKeepAlive;

  return { onReplyStart, onIdle: fireStop, onCleanup: fireStop };
}
