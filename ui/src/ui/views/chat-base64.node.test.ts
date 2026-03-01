import { describe, expect, it } from "vitest";
import { uint8ArrayToBase64 } from "./chat.ts";

describe("uint8ArrayToBase64", () => {
  it("encodes small payloads correctly", () => {
    const input = new TextEncoder().encode("Hello, world!");
    const result = uint8ArrayToBase64(input);
    expect(result).toBe(Buffer.from("Hello, world!").toString("base64"));
  });

  it("handles empty input", () => {
    expect(uint8ArrayToBase64(new Uint8Array(0))).toBe("");
  });

  it("encodes a payload larger than the 8 KB chunk boundary", () => {
    const size = 0x2000 * 3 + 42; // 3 full chunks + partial
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i++) bytes[i] = i & 0xff;

    const result = uint8ArrayToBase64(bytes);
    expect(result).toBe(Buffer.from(bytes).toString("base64"));
  });

  it("handles a 5 MB payload without stack overflow", () => {
    const size = 5 * 1024 * 1024;
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i++) bytes[i] = i & 0xff;

    const result = uint8ArrayToBase64(bytes);
    expect(result.length).toBeGreaterThan(0);
    expect(result).toBe(Buffer.from(bytes).toString("base64"));
  });
});
