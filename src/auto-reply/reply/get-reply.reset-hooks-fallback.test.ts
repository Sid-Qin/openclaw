import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MsgContext } from "../templating.js";

const mocks = vi.hoisted(() => ({
  resolveReplyDirectives: vi.fn(),
  handleInlineActions: vi.fn(),
  emitResetCommandHooks: vi.fn(),
  initSessionState: vi.fn(),
}));

vi.mock("../../agents/agent-scope.js", () => ({
  resolveAgentDir: vi.fn(() => "/tmp/agent"),
  resolveAgentWorkspaceDir: vi.fn(() => "/tmp/workspace"),
  resolveSessionAgentId: vi.fn(() => "main"),
  resolveAgentSkillsFilter: vi.fn(() => undefined),
}));
vi.mock("../../agents/model-selection.js", () => ({
  resolveModelRefFromString: vi.fn(() => null),
}));
vi.mock("../../agents/timeout.js", () => ({
  resolveAgentTimeoutMs: vi.fn(() => 60000),
}));
vi.mock("../../agents/workspace.js", () => ({
  DEFAULT_AGENT_WORKSPACE_DIR: "/tmp/workspace",
  ensureAgentWorkspace: vi.fn(async () => ({ dir: "/tmp/workspace" })),
}));
vi.mock("../../channels/model-overrides.js", () => ({
  resolveChannelModelOverride: vi.fn(() => undefined),
}));
vi.mock("../../config/config.js", () => ({
  loadConfig: vi.fn(() => ({})),
}));
vi.mock("../../link-understanding/apply.js", () => ({
  applyLinkUnderstanding: vi.fn(async () => undefined),
}));
vi.mock("../../media-understanding/apply.js", () => ({
  applyMediaUnderstanding: vi.fn(async () => undefined),
}));
vi.mock("../../runtime.js", () => ({
  defaultRuntime: { log: vi.fn() },
}));
vi.mock("../command-auth.js", () => ({
  resolveCommandAuthorization: vi.fn(() => ({ isAuthorizedSender: true })),
}));
vi.mock("./commands-core.js", () => ({
  emitResetCommandHooks: (...args: unknown[]) => mocks.emitResetCommandHooks(...args),
}));
vi.mock("./directive-handling.js", () => ({
  resolveDefaultModel: vi.fn(() => ({
    defaultProvider: "openai",
    defaultModel: "gpt-4o-mini",
    aliasIndex: new Map(),
  })),
}));
vi.mock("./get-reply-directives.js", () => ({
  resolveReplyDirectives: (...args: unknown[]) => mocks.resolveReplyDirectives(...args),
}));
vi.mock("./get-reply-inline-actions.js", () => ({
  handleInlineActions: (...args: unknown[]) => mocks.handleInlineActions(...args),
}));
vi.mock("./get-reply-run.js", () => ({
  runPreparedReply: vi.fn(async () => undefined),
}));
vi.mock("./inbound-context.js", () => ({
  finalizeInboundContext: vi.fn((ctx: unknown) => ctx),
}));
vi.mock("./session-reset-model.js", () => ({
  applyResetModelOverride: vi.fn(async () => undefined),
}));
vi.mock("./session.js", () => ({
  initSessionState: (...args: unknown[]) => mocks.initSessionState(...args),
}));
vi.mock("./stage-sandbox-media.js", () => ({
  stageSandboxMedia: vi.fn(async () => undefined),
}));
vi.mock("./typing.js", () => ({
  createTypingController: vi.fn(() => ({
    onReplyStart: async () => undefined,
    startTypingLoop: async () => undefined,
    startTypingOnText: async () => undefined,
    refreshTypingTtl: () => undefined,
    isActive: () => false,
    markRunComplete: () => undefined,
    markDispatchIdle: () => undefined,
    cleanup: () => undefined,
  })),
}));

const { getReplyFromConfig } = await import("./get-reply.js");

function buildNativeResetContext(): MsgContext {
  return {
    Provider: "telegram",
    Surface: "telegram",
    ChatType: "direct",
    Body: "/new",
    RawBody: "/new",
    CommandBody: "/new",
    CommandSource: "native",
    CommandAuthorized: true,
    SessionKey: "telegram:slash:123",
    CommandTargetSessionKey: "agent:main:telegram:direct:123",
    From: "telegram:123",
    To: "slash:123",
  };
}

function createContinueDirectivesResult(resetHookTriggered: boolean) {
  return {
    kind: "continue" as const,
    result: {
      commandSource: "/new",
      command: {
        surface: "telegram",
        channel: "telegram",
        channelId: "telegram",
        ownerList: [],
        senderIsOwner: true,
        isAuthorizedSender: true,
        senderId: "123",
        abortKey: "telegram:slash:123",
        rawBodyNormalized: "/new",
        commandBodyNormalized: "/new",
        from: "telegram:123",
        to: "slash:123",
        resetHookTriggered,
      },
      allowTextCommands: true,
      skillCommands: [],
      directives: {},
      cleanedBody: "/new",
      elevatedEnabled: false,
      elevatedAllowed: false,
      elevatedFailures: [],
      defaultActivation: "always",
      resolvedThinkLevel: undefined,
      resolvedVerboseLevel: "off",
      resolvedReasoningLevel: "off",
      resolvedElevatedLevel: "off",
      execOverrides: undefined,
      blockStreamingEnabled: false,
      blockReplyChunking: undefined,
      resolvedBlockStreamingBreak: undefined,
      provider: "openai",
      model: "gpt-4o-mini",
      modelState: {
        resolveDefaultThinkingLevel: async () => undefined,
      },
      contextTokens: 0,
      inlineStatusRequested: false,
      directiveAck: undefined,
      perMessageQueueMode: undefined,
      perMessageQueueOptions: undefined,
    },
  };
}

describe("getReplyFromConfig reset-hook fallback", () => {
  beforeEach(() => {
    mocks.resolveReplyDirectives.mockReset();
    mocks.handleInlineActions.mockReset();
    mocks.emitResetCommandHooks.mockReset();
    mocks.initSessionState.mockReset();

    mocks.initSessionState.mockResolvedValue({
      sessionCtx: buildNativeResetContext(),
      sessionEntry: {},
      previousSessionEntry: {},
      sessionStore: {},
      sessionKey: "agent:main:telegram:direct:123",
      sessionId: "session-1",
      isNewSession: true,
      resetTriggered: true,
      systemSent: false,
      abortedLastRun: false,
      storePath: "/tmp/sessions.json",
      sessionScope: "per-sender",
      groupResolution: undefined,
      isGroup: false,
      triggerBodyNormalized: "/new",
      bodyStripped: "",
    });

    mocks.resolveReplyDirectives.mockResolvedValue(createContinueDirectivesResult(false));
  });

  it("emits reset hooks when inline actions return early without marking resetHookTriggered", async () => {
    mocks.handleInlineActions.mockResolvedValue({ kind: "reply", reply: undefined });

    await getReplyFromConfig(buildNativeResetContext(), undefined, {});

    expect(mocks.emitResetCommandHooks).toHaveBeenCalledTimes(1);
    expect(mocks.emitResetCommandHooks).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "new",
        sessionKey: "agent:main:telegram:direct:123",
      }),
    );
  });

  it("does not emit fallback hooks when resetHookTriggered is already set", async () => {
    mocks.handleInlineActions.mockResolvedValue({ kind: "reply", reply: undefined });
    mocks.resolveReplyDirectives.mockResolvedValue(createContinueDirectivesResult(true));

    await getReplyFromConfig(buildNativeResetContext(), undefined, {});

    expect(mocks.emitResetCommandHooks).not.toHaveBeenCalled();
  });

  it("emits reset hooks on auto-reset (idle/daily rollover) even without explicit /new command", async () => {
    const ctx: MsgContext = {
      Provider: "telegram",
      Surface: "telegram",
      ChatType: "direct",
      Body: "hello",
      RawBody: "hello",
      From: "telegram:456",
      To: "bot:1",
      SessionKey: "agent:main:telegram:direct:456",
    };

    mocks.initSessionState.mockResolvedValue({
      sessionCtx: ctx,
      sessionEntry: { sessionId: "new-session" },
      previousSessionEntry: { sessionId: "old-session", sessionFile: "/tmp/old.jsonl" },
      sessionStore: {},
      sessionKey: "agent:main:telegram:direct:456",
      sessionId: "new-session",
      isNewSession: true,
      resetTriggered: false,
      systemSent: false,
      abortedLastRun: false,
      storePath: "/tmp/sessions.json",
      sessionScope: "per-sender" as const,
      groupResolution: undefined,
      isGroup: false,
      triggerBodyNormalized: "hello",
      bodyStripped: "hello",
    });

    const autoResetDirectives = {
      kind: "continue" as const,
      result: {
        ...createContinueDirectivesResult(false).result,
        commandSource: "hello",
        command: {
          ...createContinueDirectivesResult(false).result.command,
          rawBodyNormalized: "hello",
          commandBodyNormalized: "hello",
          senderId: "456",
          from: "telegram:456",
          to: "bot:1",
          resetHookTriggered: false,
        },
        cleanedBody: "hello",
      },
    };
    mocks.resolveReplyDirectives.mockResolvedValue(autoResetDirectives);
    mocks.handleInlineActions.mockResolvedValue({ kind: "reply", reply: undefined });

    await getReplyFromConfig(ctx, undefined, {});

    expect(mocks.emitResetCommandHooks).toHaveBeenCalledTimes(1);
    expect(mocks.emitResetCommandHooks).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "new",
        sessionKey: "agent:main:telegram:direct:456",
        previousSessionEntry: expect.objectContaining({ sessionId: "old-session" }),
      }),
    );
  });

  it("does not emit auto-reset hooks when session is not new", async () => {
    const ctx: MsgContext = {
      Provider: "telegram",
      Surface: "telegram",
      ChatType: "direct",
      Body: "hello",
      RawBody: "hello",
      From: "telegram:456",
      To: "bot:1",
      SessionKey: "agent:main:telegram:direct:456",
    };

    mocks.initSessionState.mockResolvedValue({
      sessionCtx: ctx,
      sessionEntry: { sessionId: "existing-session" },
      previousSessionEntry: undefined,
      sessionStore: {},
      sessionKey: "agent:main:telegram:direct:456",
      sessionId: "existing-session",
      isNewSession: false,
      resetTriggered: false,
      systemSent: false,
      abortedLastRun: false,
      storePath: "/tmp/sessions.json",
      sessionScope: "per-sender" as const,
      groupResolution: undefined,
      isGroup: false,
      triggerBodyNormalized: "hello",
      bodyStripped: "hello",
    });

    const directives = {
      kind: "continue" as const,
      result: {
        ...createContinueDirectivesResult(false).result,
        commandSource: "hello",
        command: {
          ...createContinueDirectivesResult(false).result.command,
          rawBodyNormalized: "hello",
          commandBodyNormalized: "hello",
          resetHookTriggered: false,
        },
        cleanedBody: "hello",
      },
    };
    mocks.resolveReplyDirectives.mockResolvedValue(directives);
    mocks.handleInlineActions.mockResolvedValue({ kind: "reply", reply: undefined });

    await getReplyFromConfig(ctx, undefined, {});

    expect(mocks.emitResetCommandHooks).not.toHaveBeenCalled();
  });
});
