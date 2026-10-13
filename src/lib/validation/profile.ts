import { z } from "zod";

/**
 * Profile validation — must mirror the CHECK constraints in
 * supabase/migrations/0001_profiles.sql so client feedback and
 * database enforcement always agree.
 */

export const EXPERIENCE_LEVELS = [
  "beginner",
  "intermediate",
  "advanced",
  "expert",
] as const;

export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
};

export const MAX_DISPLAY_NAME_LENGTH = 50;
export const MAX_BIO_LENGTH = 500;
export const MAX_SKILLS = 12;
export const MAX_SKILL_LENGTH = 30;

export const experienceLevelSchema = z.enum(EXPERIENCE_LEVELS, {
  message: "Choose an experience level.",
});

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a display name.")
  .max(
    MAX_DISPLAY_NAME_LENGTH,
    `Display names are limited to ${MAX_DISPLAY_NAME_LENGTH} characters.`,
  );

export const bioSchema = z
  .string()
  .trim()
  .max(MAX_BIO_LENGTH, `Bio is limited to ${MAX_BIO_LENGTH} characters.`);

export const skillsSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1)
      .max(
        MAX_SKILL_LENGTH,
        `Skills are limited to ${MAX_SKILL_LENGTH} characters.`,
      ),
  )
  .max(MAX_SKILLS, `Add up to ${MAX_SKILLS} skills.`);

export const profileSchema = z.object({
  displayName: displayNameSchema,
  bio: bioSchema.optional().default(""),
  skills: skillsSchema,
  experienceLevel: experienceLevelSchema,
});

export type ProfileInput = z.infer<typeof profileSchema>;

/**
 * Parse a comma/newline separated skills string from the form into a clean,
 * lowercase, deduplicated array. Lowercase storage keeps skill search
 * (Postgres array `@>`) case-insensitive and predictable.
 */
export function parseSkillsInput(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const skills: string[] = [];
  for (const piece of raw.split(/[,\n]/)) {
    const skill = piece.trim().replace(/\s+/g, " ").toLowerCase();
    if (!skill) continue;
    if (seen.has(skill)) continue;
    seen.add(skill);
    skills.push(skill);
  }
  return skills;
}
