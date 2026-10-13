import "server-only";

import {
  isUuid,
  sanitizeSearchTerm,
  skillMatchToken,
  toIlikePattern,
} from "@/lib/data/profile-search";
import { createServerSupabase } from "@/lib/supabase/server";
import { PROFILE_PUBLIC_COLUMNS, type Profile } from "@/types/database";
import type { ExperienceLevel } from "@/lib/validation/profile";

/**
 * Data Access Layer for profiles. All access runs on the server through the
 * user's own session (RLS applies); the service-role key is never used here.
 */

export type LoadProfileResult =
  | { status: "ok"; profile: Profile }
  | { status: "not_found" }
  | { status: "error" };

/** The signed-in user's profile, or null when signed out/unconfigured/missing. */
export async function getMyProfile(): Promise<Profile | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_PUBLIC_COLUMNS)
    .eq("id", user.id)
    .maybeSingle();

  if (error) return null;
  return (data as Profile | null) ?? null;
}

/** Load one public profile by id; distinguishes 404 from backend failure. */
export async function loadProfile(id: string): Promise<LoadProfileResult> {
  if (!isUuid(id)) return { status: "not_found" };

  const supabase = await createServerSupabase();
  if (!supabase) return { status: "not_found" };

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_PUBLIC_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) return { status: "error" };
  if (!data) return { status: "not_found" };
  return { status: "ok", profile: data as Profile };
}

export interface ProfileSearchInput {
  q?: string | null;
  level?: ExperienceLevel | null;
  /** Exclude the caller's own profile from discovery results. */
  excludeId?: string | null;
  limit?: number;
}

export interface ProfileSearchResult {
  profiles: Profile[];
  /** True when the query itself failed (UI must say so — no silent fakes). */
  failed: boolean;
}

/**
 * Discover public profiles by name/bio/skill with optional experience filter.
 * The search term is sanitized before entering the PostgREST `or=` filter.
 */
export async function searchProfiles({
  q,
  level,
  excludeId,
  limit = 48,
}: ProfileSearchInput): Promise<ProfileSearchResult> {
  const supabase = await createServerSupabase();
  if (!supabase) return { profiles: [], failed: false };

  let query = supabase
    .from("profiles")
    .select(PROFILE_PUBLIC_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));

  if (excludeId) query = query.neq("id", excludeId);
  if (level) query = query.eq("experience_level", level);

  const term = sanitizeSearchTerm(q);
  if (term) {
    const parts = [
      `display_name.ilike.${toIlikePattern(term)}`,
      `bio.ilike.${toIlikePattern(term)}`,
    ];
    const skill = skillMatchToken(term);
    if (skill) parts.push(`skills.cs.{${skill}}`);
    query = query.or(parts.join(","));
  }

  const { data, error } = await query;
  if (error) return { profiles: [], failed: true };
  return { profiles: (data as Profile[]) ?? [], failed: false };
}
