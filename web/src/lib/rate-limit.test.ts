import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getClientIp, rateLimit, resetRateLimits } from "@/lib/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    resetRateLimits();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to the limit then blocks with a retry hint", () => {
    for (let i = 0; i < 3; i += 1) {
      expect(rateLimit("k", 3, 1000).allowed).toBe(true);
    }
    const blocked = rateLimit("k", 3, 1000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks keys independently", () => {
    rateLimit("a", 1, 1000);
    expect(rateLimit("a", 1, 1000).allowed).toBe(false);
    expect(rateLimit("b", 1, 1000).allowed).toBe(true);
  });

  it("resets after the window passes", () => {
    rateLimit("k", 1, 1000);
    expect(rateLimit("k", 1, 1000).allowed).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(rateLimit("k", 1, 1000).allowed).toBe(true);
  });
});

describe("getClientIp", () => {
  it("uses first x-forwarded-for entry, then x-real-ip, then unknown", () => {
    expect(getClientIp(new Headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }))).toBe("1.1.1.1");
    expect(getClientIp(new Headers({ "x-real-ip": "3.3.3.3" }))).toBe("3.3.3.3");
    expect(getClientIp(new Headers())).toBe("unknown");
  });
});
