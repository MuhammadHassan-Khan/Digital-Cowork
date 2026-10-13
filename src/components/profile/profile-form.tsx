"use client";

import { useRouter } from "next/navigation";
import { useEffect, useActionState, useState } from "react";
import { saveProfileAction } from "@/lib/actions/profile";
import { Button } from "@/components/ui/button";
import { FieldError, Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { Input, Textarea } from "@/components/ui/input";
import {
  EXPERIENCE_LEVELS,
  EXPERIENCE_LEVEL_LABELS,
  MAX_BIO_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_SKILLS,
  MAX_SKILL_LENGTH,
  parseSkillsInput,
  type ExperienceLevel,
} from "@/lib/validation/profile";

export interface ProfileFormInitial {
  displayName: string;
  bio: string;
  skills: string[]; // stored lowercase; joined for editing
  experienceLevel: ExperienceLevel;
}

interface ProfileFormProps {
  mode: "create" | "edit";
  initial?: ProfileFormInitial;
  /** Redirect here after a successful save (create mode -> /discover). */
  successRedirect?: string;
  /** Where "Cancel" goes in edit mode. */
  cancelHref?: string;
}

export function ProfileForm({
  mode,
  initial,
  successRedirect,
  cancelHref = "/discover",
}: ProfileFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(saveProfileAction, {});

  const [skillsText, setSkillsText] = useState(initial?.skills.join(", ") ?? "");
  const [bioLength, setBioLength] = useState(initial?.bio.length ?? 0);
  const [level, setLevel] = useState<ExperienceLevel>(
    initial?.experienceLevel ?? "beginner",
  );

  useEffect(() => {
    if (!state.ok) return;
    if (successRedirect) {
      router.replace(successRedirect);
    }
    router.refresh();
  }, [state.ok, successRedirect, router]);

  const chipSkills = parseSkillsInput(skillsText);

  return (
    <form action={formAction} noValidate className="space-y-5">
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.ok && !successRedirect && (
        <Notice tone="success" title="Profile saved">
          Your changes are live in discovery.
        </Notice>
      )}

      <div>
        <Label htmlFor="displayName">Display name</Label>
        <Input
          id="displayName"
          name="displayName"
          defaultValue={initial?.displayName}
          placeholder="How members will see you"
          maxLength={MAX_DISPLAY_NAME_LENGTH}
          aria-invalid={Boolean(state.fieldErrors?.displayName)}
          required
        />
        <FieldError message={state.fieldErrors?.displayName?.[0]} />
      </div>

      <fieldset>
        <legend className="mb-1.5 block text-sm font-medium text-foreground">
          Experience level
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {EXPERIENCE_LEVELS.map((value) => (
            <label
              key={value}
              className={`flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                level === value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              <input
                type="radio"
                name="experienceLevel"
                value={value}
                checked={level === value}
                onChange={() => setLevel(value)}
                className="sr-only"
              />
              {EXPERIENCE_LEVEL_LABELS[value]}
            </label>
          ))}
        </div>
        <FieldError message={state.fieldErrors?.experienceLevel?.[0]} />
      </fieldset>

      <div>
        <div className="flex items-baseline justify-between">
          <Label htmlFor="skills">Skills &amp; interests</Label>
          <span className="text-xs text-muted-foreground">
            {chipSkills.length}/{MAX_SKILLS}
          </span>
        </div>
        <Input
          id="skills"
          name="skills"
          value={skillsText}
          onChange={(event) => setSkillsText(event.target.value)}
          placeholder="react, typescript, figma, academic writing"
          autoComplete="off"
          aria-invalid={Boolean(state.fieldErrors?.skills)}
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Separate with commas — up to {MAX_SKILLS} skills, {MAX_SKILL_LENGTH}{" "}
          characters each. Members find you by these.
        </p>
        <FieldError message={state.fieldErrors?.skills?.[0]} />
        {chipSkills.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {chipSkills.map((skill) => (
              <li
                key={skill}
                className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
              >
                {skill}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <Label htmlFor="bio">Short bio</Label>
          <span
            className={`text-xs ${bioLength > MAX_BIO_LENGTH ? "text-danger" : "text-muted-foreground"}`}
          >
            {bioLength}/{MAX_BIO_LENGTH}
          </span>
        </div>
        <Textarea
          id="bio"
          name="bio"
          defaultValue={initial?.bio}
          onChange={(event) => setBioLength(event.target.value.length)}
          placeholder="What are you working on? What kind of focus sessions do you like?"
          maxLength={MAX_BIO_LENGTH + 50}
          aria-invalid={Boolean(state.fieldErrors?.bio)}
        />
        <FieldError message={state.fieldErrors?.bio?.[0]} />
      </div>

      <div className="flex gap-3">
        <Button type="submit" loading={pending}>
          {mode === "create" ? "Create profile" : "Save profile"}
        </Button>
        {mode === "edit" && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push(cancelHref)}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
