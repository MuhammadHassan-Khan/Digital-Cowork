import { describe, expect, it } from "vitest";
import {
  SlidingWindowLimiter,
  TOKEN_RATE_LIMIT,
} from "@/lib/livekit/rate-limit";

describe("SlidingWindowLimiter", () => {
  it("allows up to the limit within a window, then blocks", () => {
    const limiter = new SlidingWindowLimiter(3, 1_000);
    expect(limiter.allow("u", 0)).toBe(true);
    expect(limiter.allow("u", 10)).toBe(true);
    expect(limiter.allow("u", 20)).toBe(true);
    expect(limiter.allow("u", 30)).toBe(false);
    expect(limiter.allow("u", 900)).toBe(false);
  });

  it("slides: allows again once old hits leave the window", () => {
    const limiter = new SlidingWindowLimiter(2, 1_000);
    expect(limiter.allow("u", 0)).toBe(true);
    expect(limiter.allow("u", 500)).toBe(true);
    expect(limiter.allow("u", 600)).toBe(false); // both hits still recent
    expect(limiter.allow("u", 1_001)).toBe(true); // hit at 0 fell out
    expect(limiter.allow("u", 1_400)).toBe(false); // hits at 500 + 1001 recent
    expect(limiter.allow("u", 1_501)).toBe(true); // hit at 500 fell out
  });

  it("keeps keys independent (one abuser cannot lock everyone out)", () => {
    const limiter = new SlidingWindowLimiter(1, 1_000);
    expect(limiter.allow("a", 0)).toBe(true);
    expect(limiter.allow("a", 1)).toBe(false);
    expect(limiter.allow("b", 1)).toBe(true);
  });

  it("blocked attempts do not extend the abuser's window", () => {
    const limiter = new SlidingWindowLimiter(1, 1_000);
    expect(limiter.allow("u", 0)).toBe(true);
    for (let now = 1; now < 1_000; now += 50) {
      expect(limiter.allow("u", now)).toBe(false);
    }
    // Window is measured from the last ALLOWED hit, not the last attempt.
    expect(limiter.allow("u", 1_001)).toBe(true);
  });

  it("exposes sane token limits", () => {
    expect(TOKEN_RATE_LIMIT.limit).toBeGreaterThan(0);
    expect(TOKEN_RATE_LIMIT.windowMs).toBeGreaterThan(0);
  });
});
