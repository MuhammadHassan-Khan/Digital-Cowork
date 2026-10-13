import { z } from "zod";

/**
 * Room validation — must mirror the CHECK constraints in
 * supabase/migrations/0002_rooms.sql so form feedback and database
 * enforcement always agree (same contract as validation/profile.ts).
 */

export const ROOM_VISIBILITIES = ["public", "private"] as const;
export type RoomVisibility = (typeof ROOM_VISIBILITIES)[number];

export const ROOM_STATUSES = ["open", "closed"] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

export const MIN_CAPACITY = 2;
/** PRD: rooms support at most 10 concurrent participants. */
export const MAX_CAPACITY = 10;
export const MAX_TITLE_LENGTH = 80;
export const MAX_ROOM_DESCRIPTION_LENGTH = 500;
export const MAX_FOCUS_TAG_LENGTH = 30;

/** Active invites a host may hold open per room (PRD §7 basic rate limit). */
export const MAX_ACTIVE_INVITES_PER_ROOM = 5;

export const roomVisibilitySchema = z.enum(ROOM_VISIBILITIES, {
  message: "Choose whether the room is public or private.",
});

export const roomTitleSchema = z
  .string()
  .trim()
  .min(1, "Enter a room title.")
  .max(MAX_TITLE_LENGTH, `Titles are limited to ${MAX_TITLE_LENGTH} characters.`);

export const roomDescriptionSchema = z
  .string()
  .trim()
  .max(
    MAX_ROOM_DESCRIPTION_LENGTH,
    `Descriptions are limited to ${MAX_ROOM_DESCRIPTION_LENGTH} characters.`,
  );

export const focusTagSchema = z
  .string()
  .trim()
  .max(
    MAX_FOCUS_TAG_LENGTH,
    `Focus tags are limited to ${MAX_FOCUS_TAG_LENGTH} characters.`,
  );

/**
 * Capacity arrives from a form field, so coerce the string and demand an
 * integer inside the database's [2, 10] window.
 */
export const capacitySchema = z
  .coerce
  .number({ error: "Capacity must be a whole number between 2 and 10." })
  .int("Capacity must be a whole number between 2 and 10.")
  .min(MIN_CAPACITY, `Rooms need at least ${MIN_CAPACITY} seats.`)
  .max(MAX_CAPACITY, `Rooms support at most ${MAX_CAPACITY} seats.`);

export const roomSchema = z.object({
  title: roomTitleSchema,
  description: roomDescriptionSchema.optional().default(""),
  focusTag: focusTagSchema.optional().default(""),
  visibility: roomVisibilitySchema,
  capacity: capacitySchema,
});

export type RoomInput = z.infer<typeof roomSchema>;

/** Invite link lifetimes offered by the host UI. */
export const INVITE_EXPIRY_OPTIONS = ["never", "24h", "7d"] as const;
export type InviteExpiry = (typeof INVITE_EXPIRY_OPTIONS)[number];

export const inviteExpirySchema = z.enum(INVITE_EXPIRY_OPTIONS, {
  message: "Choose how long the invite link stays valid.",
});

/**
 * Normalize a focus tag the same way skills are normalized (lowercase,
 * collapsed whitespace) so room filtering behaves predictably.
 */
export function normalizeFocusTag(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}
