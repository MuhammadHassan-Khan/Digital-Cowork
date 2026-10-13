import { describe, expect, it } from "vitest";
import {
  MAX_BIO_LENGTH,
  MAX_SKILLS,
  MAX_SKILL_LENGTH,
  parseSkillsInput,
  profileSchema,
} from "@/lib/validation/profile";

describe("parseSkillsInput", () => {
  it("splits on commas and newlines, trims and lowercases", () => {
    expect(parseSkillsInput("React, TypeScript\n FIGMA ,")).toEqual([
      "react",
      "typescript",
      "figma",
    ]);
  });

  it("deduplicates case-insensitively", () => {
    expect(parseSkillsInput("React, react, REACT")).toEqual(["react"]);
  });

  it("collapses inner whitespace", () => {
    expect(parseSkillsInput("machine   learning")).toEqual(["machine learning"]);
  });

  it("handles empty input", () => {
    expect(parseSkillsInput("")).toEqual([]);
    expect(parseSkillsInput(null)).toEqual([]);
    expect(parseSkillsInput(undefined)).toEqual([]);
    expect(parseSkillsInput(" , , ")).toEqual([]);
  });
});

describe("profileSchema", () => {
  const valid = {
    displayName: "Ada Lovelace",
    bio: "Building things.",
    skills: ["react", "typescript"],
    experienceLevel: "advanced",
  };

  it("accepts a valid profile", () => {
    expect(profileSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects empty display name", () => {
    expect(
      profileSchema.safeParse({ ...valid, displayName: "   " }).success,
    ).toBe(false);
  });

  it("rejects display names over 50 chars", () => {
    expect(
      profileSchema.safeParse({ ...valid, displayName: "a".repeat(51) }).success,
    ).toBe(false);
  });

  it("rejects bios over the limit", () => {
    expect(
      profileSchema.safeParse({ ...valid, bio: "x".repeat(MAX_BIO_LENGTH + 1) })
        .success,
    ).toBe(false);
  });

  it("rejects more than the skill cap", () => {
    const skills = Array.from({ length: MAX_SKILLS + 1 }, (_, i) => `s${i}`);
    expect(profileSchema.safeParse({ ...valid, skills }).success).toBe(false);
  });

  it("rejects overlong skill entries", () => {
    const skills = ["a".repeat(MAX_SKILL_LENGTH + 1)];
    expect(profileSchema.safeParse({ ...valid, skills }).success).toBe(false);
  });

  it("rejects unknown experience levels", () => {
    expect(
      profileSchema.safeParse({ ...valid, experienceLevel: "guru" }).success,
    ).toBe(false);
  });
});
