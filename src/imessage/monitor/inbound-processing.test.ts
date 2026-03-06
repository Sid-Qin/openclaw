import { describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import {
  describeIMessageEchoDropLog,
  resolveIMessageInboundDecision,
} from "./inbound-processing.js";

describe("resolveIMessageInboundDecision echo detection", () => {
  const cfg = {} as OpenClawConfig;

  it("drops inbound messages when outbound message id matches echo cache", () => {
    const echoHas = vi.fn((_scope: string, lookup: { text?: string; messageId?: string }) => {
      return lookup.messageId === "42";
    });

    const decision = resolveIMessageInboundDecision({
      cfg,
      accountId: "default",
      message: {
        id: 42,
        sender: "+15555550123",
        text: "Reasoning:\n_step_",
        is_from_me: false,
        is_group: false,
      },
      opts: undefined,
      messageText: "Reasoning:\n_step_",
      bodyText: "Reasoning:\n_step_",
      allowFrom: [],
      groupAllowFrom: [],
      groupPolicy: "open",
      dmPolicy: "open",
      storeAllowFrom: [],
      historyLimit: 0,
      groupHistories: new Map(),
      echoCache: { has: echoHas },
      logVerbose: undefined,
    });

    expect(decision).toEqual({ kind: "drop", reason: "echo" });
    expect(echoHas).toHaveBeenCalledWith(
      "default:imessage:+15555550123",
      expect.objectContaining({
        text: "Reasoning:\n_step_",
        messageId: "42",
      }),
    );
  });
});

describe("resolveIMessageInboundDecision self-chat dedup (#32166)", () => {
  const cfg = {} as OpenClawConfig;

  it("records is_from_me text+messageId in echo cache so the DM duplicate is caught", () => {
    const echoRemember = vi.fn();
    const echoHas = vi.fn().mockReturnValue(false);

    const fromMeDecision = resolveIMessageInboundDecision({
      cfg,
      accountId: "default",
      message: {
        id: 100,
        sender: "+15555550123",
        text: "Hello from self-chat",
        is_from_me: true,
        is_group: false,
      },
      opts: undefined,
      messageText: "Hello from self-chat",
      bodyText: "Hello from self-chat",
      allowFrom: [],
      groupAllowFrom: [],
      groupPolicy: "open",
      dmPolicy: "open",
      storeAllowFrom: [],
      historyLimit: 0,
      groupHistories: new Map(),
      echoCache: { has: echoHas, remember: echoRemember },
      logVerbose: undefined,
    });

    expect(fromMeDecision).toEqual({ kind: "drop", reason: "from me" });
    expect(echoRemember).toHaveBeenCalledWith("default:imessage:+15555550123", {
      text: "Hello from self-chat",
      messageId: "100",
    });

    echoHas.mockImplementation((_scope: string, lookup: { text?: string }) => {
      return lookup.text === "Hello from self-chat";
    });

    const echoDecision = resolveIMessageInboundDecision({
      cfg,
      accountId: "default",
      message: {
        id: 101,
        sender: "+15555550123",
        text: "Hello from self-chat",
        is_from_me: false,
        is_group: false,
      },
      opts: undefined,
      messageText: "Hello from self-chat",
      bodyText: "Hello from self-chat",
      allowFrom: [],
      groupAllowFrom: [],
      groupPolicy: "open",
      dmPolicy: "open",
      storeAllowFrom: [],
      historyLimit: 0,
      groupHistories: new Map(),
      echoCache: { has: echoHas, remember: echoRemember },
      logVerbose: undefined,
    });

    expect(echoDecision).toEqual({ kind: "drop", reason: "echo" });
  });

  it("emits both DM and group scopes for DM self-chat with chat_id", () => {
    const echoRemember = vi.fn();
    const echoHas = vi.fn().mockReturnValue(false);

    resolveIMessageInboundDecision({
      cfg,
      accountId: "default",
      message: {
        id: 200,
        sender: "+15555550123",
        text: "Hi myself",
        is_from_me: true,
        is_group: false,
        chat_id: 42,
      },
      opts: undefined,
      messageText: "Hi myself",
      bodyText: "Hi myself",
      allowFrom: [],
      groupAllowFrom: [],
      groupPolicy: "open",
      dmPolicy: "open",
      storeAllowFrom: [],
      historyLimit: 0,
      groupHistories: new Map(),
      echoCache: { has: echoHas, remember: echoRemember },
      logVerbose: undefined,
    });

    expect(echoRemember).toHaveBeenCalledTimes(2);
    expect(echoRemember).toHaveBeenCalledWith("default:imessage:+15555550123", {
      text: "Hi myself",
      messageId: "200",
    });
    expect(echoRemember).toHaveBeenCalledWith("default:chat_id:42", {
      text: "Hi myself",
      messageId: "200",
    });
  });

  it("emits only group scope for group self-chat (no false-positive on DM)", () => {
    const echoRemember = vi.fn();
    const echoHas = vi.fn().mockReturnValue(false);

    resolveIMessageInboundDecision({
      cfg,
      accountId: "default",
      message: {
        id: 300,
        sender: "+15555550123",
        text: "Group hello",
        is_from_me: true,
        is_group: true,
        chat_id: 99,
      },
      opts: undefined,
      messageText: "Group hello",
      bodyText: "Group hello",
      allowFrom: [],
      groupAllowFrom: [],
      groupPolicy: "open",
      dmPolicy: "open",
      storeAllowFrom: [],
      historyLimit: 0,
      groupHistories: new Map(),
      echoCache: { has: echoHas, remember: echoRemember },
      logVerbose: undefined,
    });

    expect(echoRemember).toHaveBeenCalledTimes(1);
    expect(echoRemember).toHaveBeenCalledWith("default:chat_id:99", {
      text: "Group hello",
      messageId: "300",
    });
  });

  it("skips echo cache recording when remember is absent (backward compat)", () => {
    const echoHas = vi.fn().mockReturnValue(false);

    const decision = resolveIMessageInboundDecision({
      cfg,
      accountId: "default",
      message: {
        id: 400,
        sender: "+15555550123",
        text: "No remember",
        is_from_me: true,
        is_group: false,
      },
      opts: undefined,
      messageText: "No remember",
      bodyText: "No remember",
      allowFrom: [],
      groupAllowFrom: [],
      groupPolicy: "open",
      dmPolicy: "open",
      storeAllowFrom: [],
      historyLimit: 0,
      groupHistories: new Map(),
      echoCache: { has: echoHas },
      logVerbose: undefined,
    });

    expect(decision).toEqual({ kind: "drop", reason: "from me" });
  });
});

describe("describeIMessageEchoDropLog", () => {
  it("includes message id when available", () => {
    expect(
      describeIMessageEchoDropLog({
        messageText: "Reasoning:\n_step_",
        messageId: "abc-123",
      }),
    ).toContain("id=abc-123");
  });
});

describe("resolveIMessageInboundDecision command auth", () => {
  const cfg = {} as OpenClawConfig;
  const resolveDmCommandDecision = (params: { messageId: number; storeAllowFrom: string[] }) =>
    resolveIMessageInboundDecision({
      cfg,
      accountId: "default",
      message: {
        id: params.messageId,
        sender: "+15555550123",
        text: "/status",
        is_from_me: false,
        is_group: false,
      },
      opts: undefined,
      messageText: "/status",
      bodyText: "/status",
      allowFrom: [],
      groupAllowFrom: [],
      groupPolicy: "open",
      dmPolicy: "open",
      storeAllowFrom: params.storeAllowFrom,
      historyLimit: 0,
      groupHistories: new Map(),
      echoCache: undefined,
      logVerbose: undefined,
    });

  it("does not auto-authorize DM commands in open mode without allowlists", () => {
    const decision = resolveDmCommandDecision({
      messageId: 100,
      storeAllowFrom: [],
    });

    expect(decision.kind).toBe("dispatch");
    if (decision.kind !== "dispatch") {
      return;
    }
    expect(decision.commandAuthorized).toBe(false);
  });

  it("authorizes DM commands for senders in pairing-store allowlist", () => {
    const decision = resolveDmCommandDecision({
      messageId: 101,
      storeAllowFrom: ["+15555550123"],
    });

    expect(decision.kind).toBe("dispatch");
    if (decision.kind !== "dispatch") {
      return;
    }
    expect(decision.commandAuthorized).toBe(true);
  });
});
