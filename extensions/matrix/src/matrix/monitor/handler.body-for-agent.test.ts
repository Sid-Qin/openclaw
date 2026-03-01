import type { MatrixClient } from "@vector-im/matrix-bot-sdk";
import type { PluginRuntime, RuntimeEnv, RuntimeLogger } from "openclaw/plugin-sdk";
import { describe, expect, it, vi } from "vitest";
import { setMatrixRuntime } from "../../runtime.js";
import { createMatrixRoomMessageHandler } from "./handler.js";
import { EventType, type MatrixRawEvent } from "./types.js";

describe("createMatrixRoomMessageHandler BodyForAgent sender label", () => {
  it("stores sender-labeled BodyForAgent for group thread messages", async () => {
    const recordInboundSession = vi.fn().mockResolvedValue(undefined);
    const formatInboundEnvelope = vi
      .fn()
      .mockImplementation((params: { senderLabel?: string; body: string }) => params.body);
    const finalizeInboundContext = vi
      .fn()
      .mockImplementation((ctx: Record<string, unknown>) => ctx);

    const core = {
      channel: {
        pairing: {
          readAllowFromStore: vi.fn().mockResolvedValue([]),
        },
        routing: {
          resolveAgentRoute: vi.fn().mockReturnValue({
            agentId: "main",
            accountId: undefined,
            sessionKey: "agent:main:matrix:channel:!room:example.org",
            mainSessionKey: "agent:main:main",
          }),
        },
        session: {
          resolveStorePath: vi.fn().mockReturnValue("/tmp/openclaw-test-session.json"),
          readSessionUpdatedAt: vi.fn().mockReturnValue(123),
          recordInboundSession,
        },
        reply: {
          resolveEnvelopeFormatOptions: vi.fn().mockReturnValue({}),
          formatInboundEnvelope,
          formatAgentEnvelope: vi
            .fn()
            .mockImplementation((params: { body: string }) => params.body),
          finalizeInboundContext,
          resolveHumanDelayConfig: vi.fn().mockReturnValue(undefined),
          createReplyDispatcherWithTyping: vi.fn().mockReturnValue({
            dispatcher: {},
            replyOptions: {},
            markDispatchIdle: vi.fn(),
          }),
          withReplyDispatcher: vi
            .fn()
            .mockResolvedValue({ queuedFinal: false, counts: { final: 0, partial: 0, tool: 0 } }),
        },
        commands: {
          shouldHandleTextCommands: vi.fn().mockReturnValue(true),
        },
        mentions: {
          matchesMentionPatterns: vi.fn().mockReturnValue(false),
        },
        text: {
          hasControlCommand: vi.fn().mockReturnValue(false),
          resolveMarkdownTableMode: vi.fn().mockReturnValue("code"),
        },
      },
      system: {
        enqueueSystemEvent: vi.fn(),
      },
    } as unknown as PluginRuntime;
    setMatrixRuntime(core);

    const runtime = {
      error: vi.fn(),
    } as unknown as RuntimeEnv;
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
    } as unknown as RuntimeLogger;
    const logVerboseMessage = vi.fn();

    const client = {
      getUserId: vi.fn().mockResolvedValue("@bot:matrix.example.org"),
    } as unknown as MatrixClient;

    const handler = createMatrixRoomMessageHandler({
      client,
      core,
      cfg: {},
      runtime,
      logger,
      logVerboseMessage,
      allowFrom: [],
      roomsConfig: undefined,
      mentionRegexes: [],
      groupPolicy: "open",
      replyToMode: "first",
      threadReplies: "inbound",
      dmEnabled: true,
      dmPolicy: "open",
      textLimit: 4000,
      mediaMaxBytes: 5 * 1024 * 1024,
      startupMs: Date.now(),
      startupGraceMs: 60_000,
      directTracker: {
        isDirectMessage: vi.fn().mockResolvedValue(false),
      },
      getRoomInfo: vi.fn().mockResolvedValue({
        name: "Dev Room",
        canonicalAlias: "#dev:matrix.example.org",
        altAliases: [],
      }),
      getMemberDisplayName: vi.fn().mockResolvedValue("Bu"),
      accountId: undefined,
    });

    const event = {
      type: EventType.RoomMessage,
      event_id: "$event1",
      sender: "@bu:matrix.example.org",
      origin_server_ts: Date.now(),
      content: {
        msgtype: "m.text",
        body: "show me my commits",
        "m.mentions": { user_ids: ["@bot:matrix.example.org"] },
        "m.relates_to": {
          rel_type: "m.thread",
          event_id: "$thread-root",
        },
      },
    } as unknown as MatrixRawEvent;

    await handler("!room:example.org", event);

    expect(formatInboundEnvelope).toHaveBeenCalledWith(
      expect.objectContaining({
        chatType: "channel",
        senderLabel: "Bu (bu)",
      }),
    );
    expect(recordInboundSession).toHaveBeenCalledWith(
      expect.objectContaining({
        ctx: expect.objectContaining({
          ChatType: "thread",
          BodyForAgent: "Bu (bu): show me my commits",
        }),
      }),
    );
  });
});

describe("createMatrixRoomMessageHandler mention context buffering", () => {
  it("prepends buffered non-mentioned room context when mention arrives, then clears it", async () => {
    const recordInboundSession = vi.fn().mockResolvedValue(undefined);
    const core = {
      channel: {
        pairing: {
          readAllowFromStore: vi.fn().mockResolvedValue([]),
        },
        routing: {
          resolveAgentRoute: vi.fn().mockReturnValue({
            agentId: "main",
            accountId: undefined,
            sessionKey: "agent:main:matrix:channel:!room:example.org",
            mainSessionKey: "agent:main:main",
          }),
        },
        session: {
          resolveStorePath: vi.fn().mockReturnValue("/tmp/openclaw-test-session.json"),
          readSessionUpdatedAt: vi.fn().mockReturnValue(123),
          recordInboundSession,
        },
        reply: {
          resolveEnvelopeFormatOptions: vi.fn().mockReturnValue({}),
          formatInboundEnvelope: vi
            .fn()
            .mockImplementation((input: { body: string }) => input.body),
          formatAgentEnvelope: vi.fn().mockImplementation((input: { body: string }) => input.body),
          finalizeInboundContext: vi.fn().mockImplementation((ctx: Record<string, unknown>) => ctx),
          resolveHumanDelayConfig: vi.fn().mockReturnValue(undefined),
          createReplyDispatcherWithTyping: vi.fn().mockReturnValue({
            dispatcher: {},
            replyOptions: {},
            markDispatchIdle: vi.fn(),
          }),
          withReplyDispatcher: vi
            .fn()
            .mockResolvedValue({ queuedFinal: false, counts: { final: 0, partial: 0, tool: 0 } }),
        },
        commands: {
          shouldHandleTextCommands: vi.fn().mockReturnValue(true),
        },
        mentions: {
          matchesMentionPatterns: vi.fn().mockReturnValue(false),
        },
        text: {
          hasControlCommand: vi.fn().mockReturnValue(false),
          resolveMarkdownTableMode: vi.fn().mockReturnValue("code"),
        },
      },
      system: {
        enqueueSystemEvent: vi.fn(),
      },
    } as unknown as PluginRuntime;
    setMatrixRuntime(core);
    const runtime = {
      error: vi.fn(),
    } as unknown as RuntimeEnv;
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
    } as unknown as RuntimeLogger;
    const client = {
      getUserId: vi.fn().mockResolvedValue("@bot:matrix.example.org"),
    } as unknown as MatrixClient;
    const handler = createMatrixRoomMessageHandler({
      client,
      core,
      cfg: {},
      runtime,
      logger,
      logVerboseMessage: vi.fn(),
      allowFrom: [],
      roomsConfig: undefined,
      mentionRegexes: [],
      groupPolicy: "open",
      replyToMode: "first",
      threadReplies: "inbound",
      dmEnabled: true,
      dmPolicy: "open",
      textLimit: 4000,
      mentionContextBufferLimit: 5,
      mediaMaxBytes: 5 * 1024 * 1024,
      startupMs: Date.now(),
      startupGraceMs: 60_000,
      directTracker: {
        isDirectMessage: vi.fn().mockResolvedValue(false),
      },
      getRoomInfo: vi.fn().mockResolvedValue({
        name: "Dev Room",
        canonicalAlias: "#dev:matrix.example.org",
        altAliases: [],
      }),
      getMemberDisplayName: vi.fn().mockResolvedValue("Bu"),
      accountId: undefined,
    });

    await handler("!room:example.org", {
      type: EventType.RoomMessage,
      event_id: "$buffered",
      sender: "@bu:matrix.example.org",
      origin_server_ts: Date.now(),
      content: {
        msgtype: "m.text",
        body: "we deployed v2 and error rates are rising",
      },
    } as unknown as MatrixRawEvent);
    expect(runtime.error).not.toHaveBeenCalled();
    expect(recordInboundSession).not.toHaveBeenCalled();

    await handler("!room:example.org", {
      type: EventType.RoomMessage,
      event_id: "$mention1",
      sender: "@bu:matrix.example.org",
      origin_server_ts: Date.now(),
      content: {
        msgtype: "m.text",
        body: "please summarize and suggest mitigation",
        "m.mentions": { user_ids: ["@bot:matrix.example.org"] },
      },
    } as unknown as MatrixRawEvent);
    expect(recordInboundSession).toHaveBeenCalledTimes(1);
    expect(recordInboundSession.mock.calls[0]?.[0]?.ctx?.BodyForAgent).toBe(
      "Bu (bu): we deployed v2 and error rates are rising\nBu (bu): please summarize and suggest mitigation",
    );

    await handler("!room:example.org", {
      type: EventType.RoomMessage,
      event_id: "$mention2",
      sender: "@bu:matrix.example.org",
      origin_server_ts: Date.now(),
      content: {
        msgtype: "m.text",
        body: "status now?",
        "m.mentions": { user_ids: ["@bot:matrix.example.org"] },
      },
    } as unknown as MatrixRawEvent);
    expect(recordInboundSession).toHaveBeenCalledTimes(2);
    expect(recordInboundSession.mock.calls[1]?.[0]?.ctx?.BodyForAgent).toBe("Bu (bu): status now?");
  });
});
