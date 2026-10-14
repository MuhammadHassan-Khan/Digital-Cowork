/**
 * Authorization matrix for the media-token endpoint
 * (POST /api/rooms/[id]/token). Pure and unit-tested (ARCHITECTURE §4:
 * "Issue short-lived LiveKit token only after server-side authorization").
 *
 * Order matters: configuration is checked first (truthful state before
 * anything else), then identity, then rate, then room facts. Every failure
 * returns an honest, specific message — never a generic "error".
 */

export interface TokenAuthInput {
  /** URL + API key + secret all present and well-formed. */
  configured: boolean;
  /** Verified Supabase session (getUser() succeeded). */
  authed: boolean;
  /** This user tripped the per-user rate limit for token requests. */
  rateLimited: boolean;
  /** Room exists AND is visible to this user (RLS). */
  roomFound: boolean;
  /** Caller holds an active seat (capacity reservation). */
  hasSeat: boolean;
  /** Room status is 'open'. */
  roomOpen: boolean;
}

export type TokenDecision =
  | { ok: true }
  | { ok: false; status: 401 | 403 | 404 | 409 | 429 | 503; error: string };

export const TOKEN_AUTH_MESSAGES = {
  notConfigured:
    "Media service is not configured. Add NEXT_PUBLIC_LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET to .env.local (see README).",
  unauthenticated: "Sign in to join the live session.",
  rateLimited: "Too many join attempts — wait a moment and try again.",
  noRoom: "That room no longer exists.",
  noSeat:
    "Take a seat in the room before entering the live session.",
  closed: "This room is closed — the host ended the session.",
} as const;

export function authorizeTokenRequest(input: TokenAuthInput): TokenDecision {
  if (!input.configured) {
    return { ok: false, status: 503, error: TOKEN_AUTH_MESSAGES.notConfigured };
  }
  if (!input.authed) {
    return { ok: false, status: 401, error: TOKEN_AUTH_MESSAGES.unauthenticated };
  }
  if (input.rateLimited) {
    return { ok: false, status: 429, error: TOKEN_AUTH_MESSAGES.rateLimited };
  }
  if (!input.roomFound) {
    return { ok: false, status: 404, error: TOKEN_AUTH_MESSAGES.noRoom };
  }
  if (!input.hasSeat) {
    return { ok: false, status: 403, error: TOKEN_AUTH_MESSAGES.noSeat };
  }
  if (!input.roomOpen) {
    return { ok: false, status: 409, error: TOKEN_AUTH_MESSAGES.closed };
  }
  return { ok: true };
}
