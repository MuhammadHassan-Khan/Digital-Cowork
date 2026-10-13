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
