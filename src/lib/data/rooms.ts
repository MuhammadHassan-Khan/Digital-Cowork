import "server-only";

import { isUuid } from "@/lib/data/profile-search";
import { hashInviteToken, isValidInviteTokenShape } from "@/lib/rooms/room-tokens";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  ROOM_COLUMNS,
  type Room,
  type RoomInvite,
  type RoomOccupant,
} from "@/types/database";

/**
 * Data Access Layer for rooms, invites and seats (Stage 2).
 * Everything runs on the server through the caller's own session — RLS is
 * the authorization layer; the service-role key is never used (ARCHITECTURE §4).
 */

export type LoadRoomResult =
  | { status: "ok"; room: Room }
  | { status: "not_found" }
  | { status: "error" };

/** Load a room through RLS: public rooms, the host, and current members. */
export async function loadRoom(id: string): Promise<LoadRoomResult> {
  if (!isUuid(id)) return { status: "not_found" };

  const supabase = await createServerSupabase();
  if (!supabase) return { status: "not_found" };

  const { data, error } = await supabase
    .from("rooms")
    .select(ROOM_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) return { status: "error" };
  if (!data) return { status: "not_found" };
  return { status: "ok", room: data as Room };
}

export interface PublicRoomsResult {
  rooms: Room[];
  /** roomId -> currently active (unexpired) seats. */
  occupancy: Map<string, number>;
  /** Host display names for the listed rooms (one extra query). */
  hostNames: Map<string, string>;
  failed: boolean;
}

/** List open public rooms with live occupancy for the rooms directory. */
export async function listPublicRooms(): Promise<PublicRoomsResult> {
  const empty: PublicRoomsResult = {
    rooms: [],
    occupancy: new Map(),
    hostNames: new Map(),
    failed: false,
  };

  const supabase = await createServerSupabase();
  if (!supabase) return empty;

  const { data: rooms, error } = await supabase
    .from("rooms")
    .select(ROOM_COLUMNS)
    .eq("visibility", "public")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(60);
  if (error || !rooms) return { ...empty, failed: true };

  const occupancy = new Map<string, number>();
  const hostNames = new Map<string, string>();
  if (rooms.length === 0) return { rooms, occupancy, hostNames, failed: false };

  // Active seats (RLS exposes seats of public rooms to signed-in members).
  const nowIso = new Date().toISOString();
  const [{ data: seats, error: seatError }, { data: hosts, error: hostError }] =
    await Promise.all([
      supabase
        .from("room_seats")
        .select("room_id, expires_at")
        .gt("expires_at", nowIso),
      supabase
        .from("profiles")
        .select("id, display_name")
        .in(
          "id",
          [...new Set(rooms.map((r) => (r as Room).host_user_id))],
        ),
    ]);

  if (seatError || hostError) {
    return { ...empty, failed: true };
  }

  for (const seat of seats ?? []) {
    occupancy.set(seat.room_id, (occupancy.get(seat.room_id) ?? 0) + 1);
  }
  for (const host of hosts ?? []) {
    hostNames.set(host.id, host.display_name);
  }

  return { rooms: rooms as Room[], occupancy, hostNames, failed: false };
}

/** The caller's active seat in a room, or null when not seated/expired. */
export async function getMySeat(
  roomId: string,
  userId: string,
): Promise<{ expires_at: string } | null> {
  if (!isUuid(roomId)) return null;
  const supabase = await createServerSupabase();
  if (!supabase) return null;

  const { data } = await supabase
    .from("room_seats")
    .select("expires_at")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  return (data as { expires_at: string } | null) ?? null;
}

/** Who currently holds a seat, with profiles embedded (host/members/public). */
export async function listRoomOccupants(
  roomId: string,
): Promise<{ occupants: RoomOccupant[]; failed: boolean }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { occupants: [], failed: false };

  const { data, error } = await supabase
    .from("room_seats")
    .select(
      "user_id, expires_at, profile:profiles(id, display_name, experience_level)",
    )
    .eq("room_id", roomId)
    .gt("expires_at", new Date().toISOString())
    .order("reserved_at", { ascending: true });

  if (error) return { occupants: [], failed: true };
  return { occupants: (data as unknown as RoomOccupant[]) ?? [], failed: false };
}

/** Public display name of a profile id (used for the host byline). */
export async function getProfileName(id: string): Promise<string | null> {
  if (!isUuid(id)) return null;
  const supabase = await createServerSupabase();
  if (!supabase) return null;

  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", id)
    .maybeSingle();

  return (data as { display_name: string } | null)?.display_name ?? null;
}

/** Invite metadata for a room — RLS restricts this to the host. */
export async function listRoomInvites(
  roomId: string,
): Promise<RoomInvite[] | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("room_invites")
    .select("id, room_id, created_by, expires_at, revoked_at, created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return null;
  return (data as RoomInvite[]) ?? [];
}

/**
 * Count still-usable invites for the per-room rate limit (PRD §7).
 * Returns null when the check itself fails (callers then refuse to create).
 */
export async function countActiveInvites(roomId: string): Promise<number | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("room_invites")
    .select("id, expires_at")
    .eq("room_id", roomId)
    .is("revoked_at", null);

  if (error) return null;
  const now = Date.now();
  return (data ?? []).filter(
    (row) => !row.expires_at || Date.parse(row.expires_at) > now,
  ).length;
}

export interface InviteResolution {
  roomId: string;
  title: string;
  description: string | null;
  focusTag: string | null;
  capacity: number;
  roomStatus: string;
  valid: boolean;
  reason: string;
}

/**
 * Resolve an invite link token to its room via the security-definer RPC
 * (hosts-only table, so guests cannot read room_invites directly).
 * Returns null for malformed or unknown tokens — no information leaks.
 */
export async function resolveInvite(
  token: string,
): Promise<InviteResolution | null> {
  if (!isValidInviteTokenShape(token)) return null;

  const supabase = await createServerSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("get_room_invite", {
    p_token_hash: hashInviteToken(token),
  });
  if (error || !Array.isArray(data) || data.length === 0) return null;

  const row = data[0] as {
    room_id: string;
    room_title: string;
    room_description: string | null;
    room_focus_tag: string | null;
    room_capacity: number;
    room_status: string;
    valid: boolean;
    reason: string;
  };

  return {
    roomId: row.room_id,
    title: row.room_title,
    description: row.room_description,
    focusTag: row.room_focus_tag,
    capacity: row.room_capacity,
    roomStatus: row.room_status,
    valid: row.valid,
    reason: row.reason,
  };
}

/** True when the room's host row is visible and belongs to `userId`. */
export async function isRoomHost(
  roomId: string,
  userId: string,
): Promise<boolean> {
  const room = await loadRoom(roomId);
  return room.status === "ok" && room.room.host_user_id === userId;
}
