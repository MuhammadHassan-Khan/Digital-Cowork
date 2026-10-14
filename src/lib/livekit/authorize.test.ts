import { describe, expect, it } from "vitest";
import {
  authorizeTokenRequest,
  TOKEN_AUTH_MESSAGES,
  type TokenAuthInput,
} from "@/lib/livekit/authorize";

const allGood: TokenAuthInput = {
  configured: true,
  authed: true,
  rateLimited: false,
  roomFound: true,
  hasSeat: true,
  roomOpen: true,
};

describe("authorizeTokenRequest", () => {
  it("issues a token only when every check passes", () => {
    expect(authorizeTokenRequest(allGood)).toEqual({ ok: true });
  });

  it("answers 503 with a truthful configuration message when unconfigured", () => {
    const decision = authorizeTokenRequest({ ...allGood, configured: false });
    expect(decision).toMatchObject({ ok: false, status: 503 });
    if (!decision.ok) expect(decision.error).toBe(TOKEN_AUTH_MESSAGES.notConfigured);
  });

  it("checks configuration before anything else", () => {
    const decision = authorizeTokenRequest({
      ...allGood,
      configured: false,
      authed: false,
      roomFound: false,
    });
    expect(decision).toMatchObject({ ok: false, status: 503 });
  });

  it("answers 401 for a missing session", () => {
    const decision = authorizeTokenRequest({ ...allGood, authed: false });
    expect(decision).toMatchObject({ ok: false, status: 401 });
    if (!decision.ok) expect(decision.error).toBe(TOKEN_AUTH_MESSAGES.unauthenticated);
  });

  it("answers 429 when the per-user rate limit tripped", () => {
    const decision = authorizeTokenRequest({ ...allGood, rateLimited: true });
    expect(decision).toMatchObject({ ok: false, status: 429 });
  });

  it("answers 404 for missing or RLS-invisible rooms", () => {
    const decision = authorizeTokenRequest({ ...allGood, roomFound: false });
    expect(decision).toMatchObject({ ok: false, status: 404 });
    if (!decision.ok) expect(decision.error).toBe(TOKEN_AUTH_MESSAGES.noRoom);
  });

  it("answers 403 when the caller holds no seat (capacity gate)", () => {
    const decision = authorizeTokenRequest({ ...allGood, hasSeat: false });
    expect(decision).toMatchObject({ ok: false, status: 403 });
    if (!decision.ok) expect(decision.error).toBe(TOKEN_AUTH_MESSAGES.noSeat);
  });

  it("answers 409 when the room is closed", () => {
    const decision = authorizeTokenRequest({ ...allGood, roomOpen: false });
    expect(decision).toMatchObject({ ok: false, status: 409 });
    if (!decision.ok) expect(decision.error).toBe(TOKEN_AUTH_MESSAGES.closed);
  });

  it("never returns an empty error message", () => {
    const flips: (keyof TokenAuthInput)[] = [
      "configured",
      "authed",
      "roomFound",
      "hasSeat",
      "roomOpen",
    ];
    for (const key of flips) {
      const decision = authorizeTokenRequest({ ...allGood, [key]: false });
      if (!decision.ok) expect(decision.error.length).toBeGreaterThan(0);
    }
  });
});
