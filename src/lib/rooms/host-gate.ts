/**
 * Host-only action gate (Step 6: "Validate server-side role checks for
 * host actions"). Pure and unit-tested.
 *
 * Server actions call this BEFORE any mutation so every host-only action
 * answers with one consistent, honest message. It is a UX + audit layer —
 * RLS remains the actual enforcement boundary: even if this check were
 * removed, the database would still refuse the write (documented in the
 * README security review).
 */

export interface HostActionInput {
  /** Verified caller id (from the session, never from the request body). */
  callerId: string;
  /** Whether the room was found and is visible to the caller (RLS). */
  roomFound: boolean;
  /** The room's host, or null when the room was not found. */
  roomHostId: string | null;
  action: keyof typeof HOST_GATE_MESSAGES;
}

export const HOST_GATE_MESSAGES = {
  close: "Only the host can close this room.",
  remove: "Only the host can remove participants.",
  invite: "Only the host can create invite links.",
  revoke: "Only the host can revoke invite links.",
} as const;

export type HostActionDecision =
  | { ok: true }
  | { ok: false; error: string };

export function authorizeHostAction(
  input: HostActionInput,
): HostActionDecision {
  if (!input.roomFound || input.roomHostId === null) {
    return { ok: false, error: "That room no longer exists." };
  }
  if (input.roomHostId !== input.callerId) {
    return { ok: false, error: HOST_GATE_MESSAGES[input.action] };
  }
  return { ok: true };
}
