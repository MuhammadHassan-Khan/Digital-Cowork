import type { ExperienceLevel } from "@/lib/validation/profile";

/**
 * Hand-written row types for Stage 1 (profiles only).
 *
 * When Supabase credentials are available, generated types can replace these:
 *   npx supabase gen types typescript --project-id <id> > src/types/database.ts
 * (rooms/invites row types are added in Stage 2.)
 */
export interface Profile {
  id: string;
  display_name: string;
  bio: string | null;
  skills: string[];
  experience_level: ExperienceLevel;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

/** Columns safe to expose in discovery (the whole table is public-by-design;
 * emails are NEVER stored here — they live only in auth.users). */
export const PROFILE_PUBLIC_COLUMNS =
  "id, display_name, bio, skills, experience_level, avatar_url, created_at, updated_at" as const;

// ---------------------------------------------------------------------------
// Stage 2 — rooms, invites, seat reservations (supabase/migrations/0002_rooms.sql)
// ---------------------------------------------------------------------------

export interface Room {
  id: string;
  host_user_id: string;
  title: string;
  description: string | null;
  focus_tag: string | null;
  visibility: "public" | "private";
  capacity: number;
  status: "open" | "closed";
  created_at: string;
  updated_at: string;
}

/** Metadata about an invite — the raw token exists ONLY in the link handed
 *  to the host once; the database keeps its sha256 hash. */
export interface RoomInvite {
  id: string;
  room_id: string;
  created_by: string;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface RoomSeat {
  room_id: string;
  user_id: string;
  reserved_at: string;
  expires_at: string;
}

/** A seat with its holder's public profile embedded (single PostgREST query). */
export interface RoomOccupant {
  user_id: string;
  expires_at: string;
  profile: Pick<Profile, "id" | "display_name" | "experience_level"> | null;
}

export const ROOM_COLUMNS =
  "id, host_user_id, title, description, focus_tag, visibility, capacity, status, created_at, updated_at" as const;
