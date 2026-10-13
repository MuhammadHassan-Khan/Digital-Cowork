import "server-only";

import { redirect } from "next/navigation";
import { getMyProfile } from "@/lib/data/profiles";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";
import type { User } from "@supabase/supabase-js";

/**
 * Data Access Layer: central place where the server resolves the caller.
 * Every server component/action that needs identity goes through these
 * helpers — never trust a client-supplied user id (ARCHITECTURE §4).
 */

/** Returns the authenticated user, or null when signed out / unconfigured. */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Require a signed-in user or redirect to login (remembering origin). */
export async function requireUser(nextPath?: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    const next = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    redirect(`/login${next}`);
  }
  return user;
}

export interface AuthedContext {
  user: User;
  profile: Profile;
}

/**
 * Require a signed-in user WITH a completed profile.
 * - No session  -> /login
 * - No profile  -> /onboarding
 * Used by the protected (app) layout so every page under it is guaranteed
 * a valid { user, profile } pair.
 */
export async function requireUserWithProfile(): Promise<AuthedContext> {
  const user = await requireUser();
  const profile = await getMyProfile();
  if (!profile) redirect("/onboarding");
  return { user, profile };
}
