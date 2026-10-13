"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseSkillsInput, profileSchema } from "@/lib/validation/profile";

/**
 * Create/Update the caller's own profile.
 *
 * Server-side trust boundary: the session is re-verified here, validation
 * runs again on the server, and the row id is taken from the verified user —
 * never from the client (ARCHITECTURE §4, PRD §7).
 */

export interface ProfileFormState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

function fieldErrorsOf(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

const DB_MISSING_CODES = new Set(["PGRST205", "42P01"]);

export async function saveProfileAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/onboarding")}`);
  }

  const parsed = profileSchema.safeParse({
    displayName: formData.get("displayName"),
    bio: formData.get("bio") ?? "",
    skills: parseSkillsInput(String(formData.get("skills") ?? "")),
    experienceLevel: formData.get("experienceLevel"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const supabase = await createServerSupabase();
  if (!supabase) {
    return { error: "Supabase is not configured. Add keys to .env.local first." };
  }

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      display_name: parsed.data.displayName,
      bio: parsed.data.bio?.trim() || null,
      skills: parsed.data.skills,
      experience_level: parsed.data.experienceLevel,
    },
    { onConflict: "id" },
  );

  if (error) {
    if (DB_MISSING_CODES.has(error.code ?? "")) {
      return {
        error:
          "Database tables are missing. Apply supabase/migrations/0001_profiles.sql in the Supabase SQL editor, then try again.",
      };
    }
    if (error.code === "42501") {
      return { error: "You do not have permission to save this profile." };
    }
    return { error: `Could not save the profile: ${error.message}` };
  }

  revalidatePath("/discover");
  revalidatePath("/profile/edit");
  revalidatePath("/onboarding");

  return { ok: true };
}
