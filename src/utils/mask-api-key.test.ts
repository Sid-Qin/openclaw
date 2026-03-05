import { describe, expect, it } from "vitest";
import { maskApiKey } from "./mask-api-key.js";

describe("maskApiKey", () => {
  it("returns missing for empty values", () => {
    expect(maskApiKey("")).toBe("missing");
    expect(maskApiKey("   ")).toBe("missing");
  });

  it("masks short and medium values without returning raw secrets", () => {
    expect(maskApiKey(" abcdefghijklmnop ")).toBe("ab...op");
    expect(maskApiKey(" short ")).toBe("s...t");
    expect(maskApiKey(" a ")).toBe("a...a");
    expect(maskApiKey(" ab ")).toBe("a...b");
  });

  it("masks long values with first and last 4 chars only", () => {
    expect(maskApiKey("1234567890abcdefghijklmnop")).toBe("1234...mnop");
  });

  it("exposes at most 8 characters for any key", () => {
    const key = "sk-ant-api03-very-long-key-1234567890abcdef";
    const masked = maskApiKey(key);
    const visibleChars = masked.replace("...", "").length;
    expect(visibleChars).toBeLessThanOrEqual(8);
  });
});
