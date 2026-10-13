/**
 * Outcomes of the server-side capacity reservation RPC
 * (`reserve_room_seat` in supabase/migrations/0002_rooms.sql) mapped to
 * honest, user-facing messages. Pure module — shared by server actions and
 * unit tests.
 */

export const JOIN_STATUSES = [
  "ok",
  "room_not_found",
  "room_closed",
  "room_full",
  "invite_required",
  "invalid_invite",
  "not_configured",
  "unknown",
] as const;

export type JoinStatus = (typeof JOIN_STATUSES)[number];

/** Server-returned strings (mirrors the SQL function's return values). */
export const JOIN_STATUS_MESSAGES: Record<JoinStatus, string> = {
  ok: "Seat reserved.",
  room_not_found: "That room no longer exists.",
  room_closed: "This room is closed — the host ended the session.",
  room_full: "This room is full right now. Try again in a moment.",
  invite_required: "This is a private room — a valid invite link is required.",
  invalid_invite:
    "That invite link is no longer valid. Ask the host for a fresh one.",
  not_configured: "Supabase is not configured. Add keys to .env.local first.",
  unknown: "Could not join the room. Please try again.",
};

/** Narrow an arbitrary RPC string into a known status (unknown -> 'unknown'). */
export function toJoinStatus(raw: unknown): JoinStatus {
  return (JOIN_STATUSES as readonly string[]).includes(raw as string)
    ? (raw as JoinStatus)
    : "unknown";
}

export function joinStatusMessage(status: JoinStatus): string {
  return JOIN_STATUS_MESSAGES[status];
}

/**
 * Invite-link verdicts from the `get_room_invite` RPC (the `reason` column)
 * mapped to honest copy for the invite landing page.
 */
export const INVITE_REASON_MESSAGES: Record<string, string> = {
  ok: "This invite link is valid.",
  invalid: JOIN_STATUS_MESSAGES.invalid_invite,
  revoked: "This invite link was revoked by the host. Ask for a fresh one.",
  expired: "This invite link has expired. Ask the host for a new one.",
  closed: JOIN_STATUS_MESSAGES.room_closed,
};

export function inviteReasonMessage(reason: string): string {
  return INVITE_REASON_MESSAGES[reason] ?? JOIN_STATUS_MESSAGES.unknown;
}
