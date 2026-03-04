import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolveFeishuAccountMock = vi.hoisted(() => vi.fn());
const getFeishuRuntimeMock = vi.hoisted(() => vi.fn());
const sendMessageFeishuMock = vi.hoisted(() => vi.fn());
const sendMarkdownCardFeishuMock = vi.hoisted(() => vi.fn());
const sendMediaFeishuMock = vi.hoisted(() => vi.fn());
const createFeishuClientMock = vi.hoisted(() => vi.fn());
const resolveReceiveIdTypeMock = vi.hoisted(() => vi.fn());
const createReplyDispatcherWithTypingMock = vi.hoisted(() => vi.fn());
const addTypingIndicatorMock = vi.hoisted(() => vi.fn(async () => ({ messageId: "om_msg" })));
const removeTypingIndicatorMock = vi.hoisted(() => vi.fn(async () => {}));
const streamingInstances = vi.hoisted(() => [] as any[]);

vi.mock("./accounts.js", () => ({ resolveFeishuAccount: resolveFeishuAccountMock }));
vi.mock("./runtime.js", () => ({ getFeishuRuntime: getFeishuRuntimeMock }));
vi.mock("./send.js", () => ({
  sendMessageFeishu: sendMessageFeishuMock,
  sendMarkdownCardFeishu: sendMarkdownCardFeishuMock,
}));
vi.mock("./media.js", () => ({ sendMediaFeishu: sendMediaFeishuMock }));
vi.mock("./client.js", () => ({ createFeishuClient: createFeishuClientMock }));
vi.mock("./targets.js", () => ({ resolveReceiveIdType: resolveReceiveIdTypeMock }));
vi.mock("./typing.js", () => ({
  addTypingIndicator: addTypingIndicatorMock,
  removeTypingIndicator: removeTypingIndicatorMock,
}));
vi.mock("./streaming-card.js", () => ({
  FeishuStreamingSession: class {
    active = false;
    start = vi.fn(async () => {
      this.active = true;
    });
    update = vi.fn(async () => {});
    close = vi.fn(async () => {
      this.active = false;
    });
    isActive = vi.fn(() => this.active);

    constructor() {
      streamingInstances.push(this);
    }
  },
}));

import { createFeishuReplyDispatcher } from "./reply-dispatcher.js";

function setupCardStreaming() {
  resolveFeishuAccountMock.mockReturnValue({
    accountId: "main",
    appId: "app_id",
    appSecret: "app_secret",
    domain: "feishu",
    config: { renderMode: "card", streaming: true },
  });
  resolveReceiveIdTypeMock.mockReturnValue("chat_id");
  createFeishuClientMock.mockReturnValue({});
  sendMediaFeishuMock.mockResolvedValue(undefined);
  createReplyDispatcherWithTypingMock.mockImplementation((opts: Record<string, unknown>) => ({
    dispatcher: {},
    replyOptions: {},
    markDispatchIdle: vi.fn(),
    _opts: opts,
  }));
  getFeishuRuntimeMock.mockReturnValue({
    channel: {
      text: {
        resolveTextChunkLimit: vi.fn(() => 4000),
        resolveChunkMode: vi.fn(() => "line"),
        resolveMarkdownTableMode: vi.fn(() => "preserve"),
        convertMarkdownTables: vi.fn((text: string) => text),
        chunkTextWithMode: vi.fn((text: string) => [text]),
      },
      reply: {
        createReplyDispatcherWithTyping: createReplyDispatcherWithTypingMock,
        resolveHumanDelayConfig: vi.fn(() => undefined),
      },
    },
  });
}

describe("block streaming debounce (#33883)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    streamingInstances.length = 0;
    setupCardStreaming();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces block updates — multiple rapid blocks produce fewer streaming.update calls", async () => {
    createFeishuReplyDispatcher({
      cfg: {} as never,
      agentId: "agent",
      runtime: { log: vi.fn(), error: vi.fn() } as never,
      chatId: "oc_chat",
    });

    const opts = createReplyDispatcherWithTypingMock.mock.calls[0]?.[0];

    await opts.deliver({ text: "Block 1\n" }, { kind: "block" });
    await opts.deliver({ text: "Block 2\n" }, { kind: "block" });
    await opts.deliver({ text: "Block 3\n" }, { kind: "block" });

    expect(streamingInstances).toHaveLength(1);
    expect(streamingInstances[0].update).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);

    expect(streamingInstances[0].update).toHaveBeenCalledTimes(1);
    expect(streamingInstances[0].update).toHaveBeenCalledWith("Block 1\nBlock 2\nBlock 3\n");
  });

  it("final delivery flushes pending block update before closing", async () => {
    createFeishuReplyDispatcher({
      cfg: {} as never,
      agentId: "agent",
      runtime: { log: vi.fn(), error: vi.fn() } as never,
      chatId: "oc_chat",
    });

    const opts = createReplyDispatcherWithTypingMock.mock.calls[0]?.[0];

    await opts.deliver({ text: "Block A\n" }, { kind: "block" });
    await opts.deliver({ text: "Block B\n" }, { kind: "block" });

    expect(streamingInstances[0].update).not.toHaveBeenCalled();

    await opts.deliver({ text: "Final complete text." }, { kind: "final" });

    expect(streamingInstances[0].update).toHaveBeenCalledTimes(1);
    expect(streamingInstances[0].close).toHaveBeenCalledTimes(1);
    expect(streamingInstances[0].close).toHaveBeenCalledWith("Final complete text.");
  });

  it("onIdle flushes pending block update", async () => {
    createFeishuReplyDispatcher({
      cfg: {} as never,
      agentId: "agent",
      runtime: { log: vi.fn(), error: vi.fn() } as never,
      chatId: "oc_chat",
    });

    const opts = createReplyDispatcherWithTypingMock.mock.calls[0]?.[0];

    await opts.deliver({ text: "Orphan block" }, { kind: "block" });

    expect(streamingInstances[0].update).not.toHaveBeenCalled();

    await opts.onIdle?.();

    expect(streamingInstances[0].update).toHaveBeenCalledTimes(1);
    expect(streamingInstances[0].close).toHaveBeenCalledTimes(1);
    expect(streamingInstances[0].close).toHaveBeenCalledWith("Orphan block");
  });

  it("no duplicate messages created when blocks arrive rapidly", async () => {
    createFeishuReplyDispatcher({
      cfg: {} as never,
      agentId: "agent",
      runtime: { log: vi.fn(), error: vi.fn() } as never,
      chatId: "oc_chat",
    });

    const opts = createReplyDispatcherWithTypingMock.mock.calls[0]?.[0];

    for (let i = 0; i < 30; i++) {
      await opts.deliver({ text: `Block ${i}\n` }, { kind: "block" });
    }

    await opts.deliver({ text: "All 30 blocks summarized." }, { kind: "final" });

    expect(sendMarkdownCardFeishuMock).not.toHaveBeenCalled();
    expect(sendMessageFeishuMock).not.toHaveBeenCalled();
    expect(streamingInstances).toHaveLength(1);
    expect(streamingInstances[0].close).toHaveBeenCalledTimes(1);
  });
});
