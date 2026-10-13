import { createHash, randomBytes } from "node:crypto";

/**
 * Invite-link token minting and hashing (PRD §7).
 *
 * The raw token exists only in the link handed to the host ONCE; the
 * database stores its sha256 hash. Possession of the link = capability to
 * join, so tokens are 32 bytes of CSPRNG entropy (non-guessable).
 *
 * Pure module — no server-only import so unit tests can verify it.
 */

export const INVITE_TOKEN_BYTES = 32;

/** base64url charset used by our links: [A-Za-z0-9_-] */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,120}$/;

/** Mint a fresh, non-guessable invite secret (43 chars base64url). */
export function generateInviteToken(): string {
  return randomBytes(INVITE_TOKEN_BYTES).toString("base64url");
}

/** sha256 hex digest (64 chars) — the form stored in room_invites.token_hash. */
export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Cheap shape check before any lookup: rejects malformed input early so
 * garbage can never reach the database (also keeps garbage out of logs).
 */
export function isValidInviteTokenShape(token: unknown): token is string {
  return typeof token === "string" && TOKEN_PATTERN.test(token);
}
