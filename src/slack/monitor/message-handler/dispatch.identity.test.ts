import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveAgentOutboundIdentityMock = vi.hoisted(() =>
  vi.fn(() => ({
    name: "Agent Lobster",
    avatarUrl: "https://example.com/avatar.png",
    emoji: ":lobster:",
  })),
);

const deliverRepliesMock = vi.hoisted(() => vi.fn(async () => {}));
const createSlackReplyDeliveryPlanMock = vi.hoisted(() =>
  vi.fn(() => ({
    nextThreadTs: () => undefined,
    markSent: () => {},
  })),
);
const createSlackDraftStreamMock = vi.hoisted(() =>
  vi.fn(() => ({
    update: () => {},
    flush: async () => {},
    stop: () => {},
    clear: async () => {},
    forceNewMessage: () => {},
    messageId: () => undefined,
    channelId: () => undefined,
  })),
);
const createReplyDispatcherWithTypingMock = vi.hoisted(() =>
  vi.fn((opts: { deliver: (payload: unknown, info: { kind: "tool" | "block" | "final" }) => Promise<void> }) => {
    const pending: Promise<void>[] = [];
    const enqueue = (payload: unknown, kind: "tool" | "block" | "final") => {
      pending.push(Promise.resolve(opts.deliver(payload, { kind })));
      return true;
    };
    return {
      dispatcher: {
        sendToolResult: (payload: unknown) => enqueue(payload, "tool"),
        sendBlockReply: (payload: unknown) => enqueue(payload, "block"),
        sendFinalReply: (payload: unknown) => enqueue(payload, "final"),
        waitForIdle: async () => {
          await Promise.all(pending);
        },
        getQueuedCounts: () => ({ tool: 0, block: 0, final: 0 }),
        markComplete: () => {},
      },
      replyOptions: {},
      markDispatchIdle: () => {},
    };
  }),
);
const dispatchInboundMessageMock = vi.hoisted(() =>
  vi.fn(
    async (params: {
      dispatcher: {
        sendFinalReply: (payload: unknown) => boolean;
        waitForIdle: () => Promise<void>;
      };
    }) => {
      params.dispatcher.sendFinalReply({ text: "hello from final reply" });
      await params.dispatcher.waitForIdle();
      return {
        queuedFinal: false,
        counts: { tool: 0, block: 0, final: 1 },
      };
    },
  ),
);

vi.mock("../../../infra/outbound/identity.js", () => ({
  resolveAgentOutboundIdentity: resolveAgentOutboundIdentityMock,
}));

vi.mock("../../../auto-reply/dispatch.js", () => ({
  dispatchInboundMessage: dispatchInboundMessageMock,
}));

vi.mock("../../../auto-reply/reply/history.js", () => ({
  clearHistoryEntriesIfEnabled: vi.fn(),
}));

vi.mock("../../../auto-reply/reply/reply-dispatcher.js", () => ({
  createReplyDispatcherWithTyping: createReplyDispatcherWithTypingMock,
}));

vi.mock("../../../channels/ack-reactions.js", () => ({
  removeAckReactionAfterReply: vi.fn(),
}));

vi.mock("../../../channels/logging.js", () => ({
  logAckFailure: vi.fn(),
  logTypingFailure: vi.fn(),
}));

vi.mock("../../../channels/reply-prefix.js", () => ({
  createReplyPrefixOptions: vi.fn(() => ({ onModelSelected: undefined })),
}));

vi.mock("../../../channels/typing.js", () => ({
  createTypingCallbacks: vi.fn(() => ({ onIdle: undefined })),
}));

vi.mock("../../../config/sessions.js", () => ({
  resolveStorePath: vi.fn(() => "/tmp/sessions.json"),
  updateLastRoute: vi.fn(async () => {}),
}));

vi.mock("../../../globals.js", () => ({
  danger: (message: string) => message,
  logVerbose: vi.fn(),
  shouldLogVerbose: vi.fn(() => false),
}));

vi.mock("../../actions.js", () => ({
  removeSlackReaction: vi.fn(async () => {}),
}));

vi.mock("../../draft-stream.js", () => ({
  createSlackDraftStream: createSlackDraftStreamMock,
}));

vi.mock("../../stream-mode.js", () => ({
  applyAppendOnlyStreamUpdate: vi.fn(),
  buildStatusFinalPreviewText: vi.fn(() => "status"),
  resolveSlackStreamingConfig: vi.fn(() => ({
    mode: "off",
    nativeStreaming: false,
    draftMode: "append",
  })),
}));

vi.mock("../../streaming.js", () => ({
  appendSlackStream: vi.fn(async () => {}),
  startSlackStream: vi.fn(async () => ({
    threadTs: "1700000000.000001",
    stopped: false,
  })),
  stopSlackStream: vi.fn(async () => {}),
}));

vi.mock("../../threading.js", () => ({
  resolveSlackThreadTargets: vi.fn(() => ({
    statusThreadTs: undefined,
    isThreadReply: false,
  })),
}));

vi.mock("../replies.js", () => ({
  createSlackReplyDeliveryPlan: createSlackReplyDeliveryPlanMock,
  deliverReplies: deliverRepliesMock,
  resolveSlackThreadTs: vi.fn(() => undefined),
}));

vi.mock("../../../agents/identity.js", () => ({
  resolveHumanDelayConfig: vi.fn(() => undefined),
}));

import { dispatchPreparedSlackMessage } from "./dispatch.js";

describe("dispatchPreparedSlackMessage identity wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves outbound identity and passes it into deliverReplies", async () => {
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn(),
    };

    const prepared = {
      ctx: {
        cfg: {
          channels: {
            slack: {
              enabled: true,
            },
          },
        },
        runtime,
        replyToMode: "all",
        setSlackThreadStatus: vi.fn(async () => {}),
        botToken: "xoxb-test",
        textLimit: 4000,
        app: { client: {} },
        teamId: "T123",
        channelHistories: new Map<string, unknown[]>(),
        historyLimit: 20,
        removeAckAfterReply: false,
      },
      account: {
        accountId: "default",
        config: {
          streaming: undefined,
          streamMode: "append",
          nativeStreaming: false,
        },
      },
      message: {
        channel: "C123",
        user: "U123",
        ts: "1700000000.000000",
        event_ts: "1700000000.000000",
      },
      route: {
        agentId: "agent-lobster",
        accountId: "default",
        mainSessionKey: "main",
      },
      channelConfig: null,
      replyTarget: "channel:C123",
      ctxPayload: {},
      isDirectMessage: false,
      isRoomish: false,
      historyKey: "slack:history:C123",
      preview: "hello",
      ackReactionMessageTs: undefined,
      ackReactionValue: "hourglass",
      ackReactionPromise: null,
    };

    await dispatchPreparedSlackMessage(
      prepared as Parameters<typeof dispatchPreparedSlackMessage>[0],
    );

    expect(resolveAgentOutboundIdentityMock).toHaveBeenCalledWith(
      prepared.ctx.cfg,
      "agent-lobster",
    );
    expect(deliverRepliesMock).toHaveBeenCalled();
    expect(deliverRepliesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        identity: {
          name: "Agent Lobster",
          avatarUrl: "https://example.com/avatar.png",
          emoji: ":lobster:",
        },
      }),
    );
  });
});
