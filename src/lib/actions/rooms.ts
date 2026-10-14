"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isUuid } from "@/lib/data/profile-search";
import {
  countActiveInvites,
  isRoomHost,
  loadRoom,
  resolveInvite,
} from "@/lib/data/rooms";
import {
  inviteReasonMessage,
  joinStatusMessage,
  toJoinStatus,
} from "@/lib/rooms/join-status";
import { SEAT_TTL_MS } from "@/lib/rooms/constants";
import {
  generateInviteToken,
  hashInviteToken,
  isValidInviteTokenShape,
} from "@/lib/rooms/room-tokens";
import {
  endLivekitRoom,
  getLivekitConfig,
  kickParticipant,
} from "@/lib/livekit/server";
import { inviteRequestLimiter } from "@/lib/livekit/rate-limit";
import {
  authorizeHostAction,
  HOST_GATE_MESSAGES,
} from "@/lib/rooms/host-gate";
import { createServerSupabase } from "@/lib/supabase/server";
import { fieldErrorsOf } from "@/lib/validation/form-errors";
import {
  inviteExpirySchema,
  MAX_ACTIVE_INVITES_PER_ROOM,
  normalizeFocusTag,
  roomSchema,
} from "@/lib/validation/room";

/**
 * Room server actions (Stage 2 / Step 3).
 *
 * Trust boundary (ARCHITECTURE §4, PRD §7):
 *  - session re-verified in every action; ids come from the verified user,
 *    never from hidden form fields;
 *  - capacity + invite checks live ONLY in the `reserve_room_seat` RPC
 *    (advisory-locked, race-safe) — the UI merely calls it;
 *  - host-only mutations are enforced twice: action-level checks for clear
 *    messages, RLS as the actual boundary.
 */

export interface RoomActionState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  /** Set by createRoomAction for the client-side redirect. */
  roomId?: string;
  /** Raw invite token — shown to the host exactly once, never re-derivable. */
  inviteToken?: string;
}

const DB_MISSING_CODES = new Set(["PGRST205", "42P01", "PGRST202"]);

function dbErrorMessage(error: {
  code?: string | null;
  message: string;
}): string {
  if (DB_MISSING_CODES.has(error.code ?? "")) {
    return "Database tables or functions are missing. Apply supabase/migrations/0001_profiles.sql and 0002_rooms.sql in the Supabase SQL editor, then try again.";
  }
  if (error.code === "42501") {
    return "You do not have permission to do that.";
  }
  return `Database error: ${error.message}`;
}

const NOT_CONFIGURED =
  "Supabase is not configured. Add keys to .env.local first.";

const INVITE_NOT_CONFIGURED = NOT_CONFIGURED;

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

export async function createRoomAction(
  _prev: RoomActionState,
  formData: FormData,
): Promise<RoomActionState> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/rooms/create")}`);

  const parsed = roomSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    focusTag: normalizeFocusTag(String(formData.get("focusTag") ?? "")),
    visibility: formData.get("visibility"),
    capacity: formData.get("capacity"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const supabase = await createServerSupabase();
  if (!supabase) return { error: NOT_CONFIGURED };

  const { data, error } = await supabase
    .from("rooms")
    .insert({
      host_user_id: user.id,
      title: parsed.data.title,
      description: parsed.data.description || null,
      focus_tag: parsed.data.focusTag || null,
      visibility: parsed.data.visibility,
      capacity: parsed.data.capacity,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error ? dbErrorMessage(error) : "Could not create the room." };
  }

  revalidatePath("/rooms");
  return { ok: true, roomId: data.id as string };
}

/** Reserve a seat via the capacity RPC; on success, land on the room page. */
export async function joinRoomAction(
  _prev: RoomActionState,
  formData: FormData,
): Promise<RoomActionState> {
  const rawRoomId = String(formData.get("roomId") ?? "");
  const user = await getCurrentUser();
  if (!user) {
    const next = isUuid(rawRoomId) ? `/rooms/${rawRoomId}` : "/rooms";
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  if (!isUuid(rawRoomId)) return { error: "Unknown room." };

  const supabase = await createServerSupabase();
  if (!supabase) return { error: NOT_CONFIGURED };

  const { data, error } = await supabase.rpc("reserve_room_seat", {
    p_room_id: rawRoomId,
    p_invite_hash: null,
  });
  if (error) return { error: dbErrorMessage(error) };

  const status = toJoinStatus(data);
  if (status === "ok") {
    revalidatePath(`/rooms/${rawRoomId}`);
    redirect(`/rooms/${rawRoomId}`);
  }
  return { error: joinStatusMessage(status) };
}

export async function leaveRoomAction(
  _prev: RoomActionState,
  formData: FormData,
): Promise<RoomActionState> {
  const rawRoomId = String(formData.get("roomId") ?? "");
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/rooms")}`);
  if (!isUuid(rawRoomId)) return { error: "Unknown room." };

  const supabase = await createServerSupabase();
  if (!supabase) return { error: NOT_CONFIGURED };

  const { error } = await supabase
    .from("room_seats")
    .delete()
    .eq("room_id", rawRoomId)
    .eq("user_id", user.id);
  if (error) return { error: dbErrorMessage(error) };

  revalidatePath(`/rooms/${rawRoomId}`);
  revalidatePath("/rooms");
  redirect(`/rooms/${rawRoomId}`);
}

/** Host closes the room: status flips to 'closed', joiners are refused. */
export async function closeRoomAction(
  _prev: RoomActionState,
  formData: FormData,
): Promise<RoomActionState> {
  const rawRoomId = String(formData.get("roomId") ?? "");
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/rooms")}`);
  if (!isUuid(rawRoomId)) return { error: "Unknown room." };

  const supabase = await createServerSupabase();
  if (!supabase) return { error: NOT_CONFIGURED };

  // RLS limits this update to the host; zero affected rows => not the host.
  const { data, error } = await supabase
    .from("rooms")
    .update({ status: "closed" })
    .eq("id", rawRoomId)
    .select("id");

  if (error) return { error: dbErrorMessage(error) };
  if (!data || data.length === 0) {
    return { error: HOST_GATE_MESSAGES.close };
  }

  // Best-effort: disconnect everyone from the live session immediately.
  // If LiveKit is unconfigured/unreachable, members' heartbeats fail and
  // their clients refresh/disconnect on their own (fallback still safe).
  const livekit = getLivekitConfig();
  if (livekit) await endLivekitRoom(livekit, rawRoomId);

  revalidatePath(`/rooms/${rawRoomId}`);
  revalidatePath("/rooms");
  return { ok: true };
}

/** Host removes another member's seat (server verifies host explicitly). */
export async function removeParticipantAction(
  _prev: RoomActionState,
  formData: FormData,
): Promise<RoomActionState> {
  const rawRoomId = String(formData.get("roomId") ?? "");
  const targetId = String(formData.get("targetUserId") ?? "");
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/rooms")}`);
  if (!isUuid(rawRoomId) || !isUuid(targetId)) {
    return { error: "Unknown room or member." };
  }
  if (targetId === user.id) {
    return { error: "Use “Leave room” to give up your own seat." };
  }

  const room = await loadRoom(rawRoomId);
  const gate = authorizeHostAction({
    callerId: user.id,
    roomFound: room.status === "ok",
    roomHostId: room.status === "ok" ? room.room.host_user_id : null,
    action: "remove",
  });
  if (!gate.ok) return { error: gate.error };

  const supabase = await createServerSupabase();
  if (!supabase) return { error: NOT_CONFIGURED };

  const { error } = await supabase
    .from("room_seats")
    .delete()
    .eq("room_id", rawRoomId)
    .eq("user_id", targetId);
  if (error) return { error: dbErrorMessage(error) };

  // Best-effort: pull the removed member out of the live session too, so a
  // removed seat cannot keep talking. Heartbeat fallback if this fails.
  const livekit = getLivekitConfig();
  if (livekit) await kickParticipant(livekit, rawRoomId, targetId);

  revalidatePath(`/rooms/${rawRoomId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

function inviteExpiryDate(choice: string): string | null {
  const now = Date.now();
  if (choice === "24h") return new Date(now + 24 * 60 * 60_000).toISOString();
  if (choice === "7d") return new Date(now + 7 * 24 * 60 * 60_000).toISOString();
  return null; // "never"
}

export async function createInviteAction(
  _prev: RoomActionState,
  formData: FormData,
): Promise<RoomActionState> {
  const rawRoomId = String(formData.get("roomId") ?? "");
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/rooms")}`);
  if (!isUuid(rawRoomId)) return { error: "Unknown room." };

  // PRD §7 rate limit: invite creation (per user, in-memory per process).
  if (!inviteRequestLimiter.allow(`invite:${user.id}`)) {
    return {
      error:
        "Too many invite links created in the last minute — wait a moment and try again.",
    };
  }

  const expiry = inviteExpirySchema.safeParse(formData.get("expiry"));
  const expiryChoice = expiry.success ? expiry.data : "never";

  // Host-only: RLS enforces this too, but an explicit check gives a clear
  // message and avoids a pointless insert attempt.
  if (!(await isRoomHost(rawRoomId, user.id))) {
    return { error: HOST_GATE_MESSAGES.invite };
  }

  const active = await countActiveInvites(rawRoomId);
  if (active === null) {
    return { error: "Could not verify the invite limit — try again." };
  }
  if (active >= MAX_ACTIVE_INVITES_PER_ROOM) {
    return {
      error: `This room already has ${MAX_ACTIVE_INVITES_PER_ROOM} active invite links. Revoke one before creating another.`,
    };
  }

  const token = generateInviteToken();
  const supabase = await createServerSupabase();
  if (!supabase) return { error: INVITE_NOT_CONFIGURED };

  const { error } = await supabase.from("room_invites").insert({
    room_id: rawRoomId,
    created_by: user.id,
    token_hash: hashInviteToken(token),
    expires_at: inviteExpiryDate(expiryChoice),
  });
  if (error) return { error: dbErrorMessage(error) };

  revalidatePath(`/rooms/${rawRoomId}`);
  // The raw token is returned ONCE; only its hash was persisted.
  return { ok: true, inviteToken: token };
}

export async function revokeInviteAction(
  _prev: RoomActionState,
  formData: FormData,
): Promise<RoomActionState> {
  const rawInviteId = String(formData.get("inviteId") ?? "");
  const rawRoomId = String(formData.get("roomId") ?? "");
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/rooms")}`);
  if (!isUuid(rawInviteId)) return { error: "Unknown invite." };

  const supabase = await createServerSupabase();
  if (!supabase) return { error: NOT_CONFIGURED };

  // RLS limits updates to the host of the invite's room; zero rows => denied.
  const { data, error } = await supabase
    .from("room_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", rawInviteId)
    .is("revoked_at", null)
    .select("id");

  if (error) return { error: dbErrorMessage(error) };
  if (!data || data.length === 0) {
    return { error: HOST_GATE_MESSAGES.revoke };
  }

  if (isUuid(rawRoomId)) revalidatePath(`/rooms/${rawRoomId}`);
  return { ok: true };
}

/** Invite landing page: validate the raw link, then reserve through RPC. */
export async function joinViaInviteAction(
  _prev: RoomActionState,
  formData: FormData,
): Promise<RoomActionState> {
  const token = String(formData.get("token") ?? "");
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  }
  if (!isValidInviteTokenShape(token)) {
    return { error: joinStatusMessage("invalid_invite") };
  }

  const invite = await resolveInvite(token);
  if (!invite) return { error: joinStatusMessage("invalid_invite") };
  if (!invite.valid) {
    return { error: inviteReasonMessage(invite.reason) };
  }

  const supabase = await createServerSupabase();
  if (!supabase) return { error: NOT_CONFIGURED };

  const { data, error } = await supabase.rpc("reserve_room_seat", {
    p_room_id: invite.roomId,
    p_invite_hash: hashInviteToken(token),
  });
  if (error) return { error: dbErrorMessage(error) };

  const status = toJoinStatus(data);
  if (status === "ok") {
    revalidatePath(`/rooms/${invite.roomId}`);
    redirect(`/rooms/${invite.roomId}`);
  }
  return { error: joinStatusMessage(status) };
}

// ---------------------------------------------------------------------------
// Seat heartbeat (Stage 2 stand-in for LiveKit presence — Stage 3 replaces it)
// ---------------------------------------------------------------------------

/**
 * Renew the caller's EXISTING seat while the room page stays open.
 * Can never create a seat (no join without the capacity RPC), so a stale
 * page cannot sneak anyone into a room. Answers `ok: false` when the room
 * has been closed — the client refreshes, ending any live session truthfully
 * (this is how host-close propagates to seated members, within one beat).
 */
export async function renewSeatAction(
  roomId: string,
): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || !isUuid(roomId)) return { ok: false };

  const room = await loadRoom(roomId);
  if (room.status !== "ok" || room.room.status !== "open") return { ok: false };

  const supabase = await createServerSupabase();
  if (!supabase) return { ok: false };

  const { data, error } = await supabase
    .from("room_seats")
    .update({
      expires_at: new Date(Date.now() + SEAT_TTL_MS).toISOString(),
    })
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .gt("expires_at", new Date().toISOString())
    .select("room_id");

  if (error) return { ok: false };
  return { ok: (data ?? []).length > 0 };
}
