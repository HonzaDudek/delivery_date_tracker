import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit } from "./rate-limiter";

describe("checkRateLimit", () => {
  // Use unique keys per test to avoid cross-test state
  let keyCounter = 0;
  function uniqueKey() {
    return `test-shop-${++keyCounter}-${Date.now()}`;
  }

  it("allows requests under the limit", () => {
    const key = uniqueKey();
    const result = checkRateLimit(key, 5);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.retryAfterMs).toBe(0);
  });

  it("tracks remaining requests correctly", () => {
    const key = uniqueKey();
    checkRateLimit(key, 3);
    checkRateLimit(key, 3);
    const result = checkRateLimit(key, 3);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("blocks requests over the limit", () => {
    const key = uniqueKey();
    checkRateLimit(key, 2);
    checkRateLimit(key, 2);
    const result = checkRateLimit(key, 2);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("uses separate limits per key", () => {
    const key1 = uniqueKey();
    const key2 = uniqueKey();
    checkRateLimit(key1, 1);
    // key1 is exhausted
    expect(checkRateLimit(key1, 1).allowed).toBe(false);
    // key2 should still be allowed
    expect(checkRateLimit(key2, 1).allowed).toBe(true);
  });
});
