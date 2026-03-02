import { describe, expect, it, vi } from "vitest";
import { ExecApprovalManager } from "./exec-approval-manager.js";
import type { ExecApprovalRequestPayload } from "./exec-approval-manager.js";

const TIMEOUT_MS = 60_000;

function dummyRequest(): ExecApprovalRequestPayload {
  return {
    command: "echo hello",
    sessionKey: "agent:main:main",
    agentId: "main",
  } as ExecApprovalRequestPayload;
}

describe("ExecApprovalManager", () => {
  it("resolves by full UUID", () => {
    const mgr = new ExecApprovalManager();
    const record = mgr.create(dummyRequest(), TIMEOUT_MS);
    void mgr.register(record, TIMEOUT_MS);

    const ok = mgr.resolve(record.id, "allow-once");
    expect(ok).toBe(true);
  });

  it("resolves by 8-char slug prefix", async () => {
    vi.useFakeTimers();
    const mgr = new ExecApprovalManager();
    const record = mgr.create(dummyRequest(), TIMEOUT_MS);
    const promise = mgr.register(record, TIMEOUT_MS);

    const slug = record.id.slice(0, 8);
    const ok = mgr.resolve(slug, "allow-once");
    expect(ok).toBe(true);

    const decision = await promise;
    expect(decision).toBe("allow-once");
    vi.useRealTimers();
  });

  it("getSnapshot works with slug prefix", () => {
    const mgr = new ExecApprovalManager();
    const record = mgr.create(dummyRequest(), TIMEOUT_MS);
    void mgr.register(record, TIMEOUT_MS);

    const slug = record.id.slice(0, 8);
    const snapshot = mgr.getSnapshot(slug);
    expect(snapshot).not.toBeNull();
    expect(snapshot?.id).toBe(record.id);
  });

  it("returns false when slug matches multiple pending approvals", () => {
    const mgr = new ExecApprovalManager();
    const r1 = mgr.create(dummyRequest(), TIMEOUT_MS, "aabb1111-0000-0000-0000-000000000001");
    const r2 = mgr.create(dummyRequest(), TIMEOUT_MS, "aabb1111-0000-0000-0000-000000000002");
    void mgr.register(r1, TIMEOUT_MS);
    void mgr.register(r2, TIMEOUT_MS);

    const ok = mgr.resolve("aabb1111", "allow-once");
    expect(ok).toBe(false);
  });

  it("returns null snapshot when slug is ambiguous", () => {
    const mgr = new ExecApprovalManager();
    const r1 = mgr.create(dummyRequest(), TIMEOUT_MS, "ccdd2222-0000-0000-0000-000000000001");
    const r2 = mgr.create(dummyRequest(), TIMEOUT_MS, "ccdd2222-0000-0000-0000-000000000002");
    void mgr.register(r1, TIMEOUT_MS);
    void mgr.register(r2, TIMEOUT_MS);

    expect(mgr.getSnapshot("ccdd2222")).toBeNull();
  });

  it("consumeAllowOnce works with slug prefix", async () => {
    vi.useFakeTimers();
    const mgr = new ExecApprovalManager();
    const record = mgr.create(dummyRequest(), TIMEOUT_MS);
    void mgr.register(record, TIMEOUT_MS);

    const slug = record.id.slice(0, 8);
    mgr.resolve(slug, "allow-once");

    const consumed = mgr.consumeAllowOnce(slug);
    expect(consumed).toBe(true);

    const secondConsume = mgr.consumeAllowOnce(slug);
    expect(secondConsume).toBe(false);
    vi.useRealTimers();
  });
});
