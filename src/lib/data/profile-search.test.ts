import { describe, expect, it } from "vitest";
import {
  isUuid,
  sanitizeSearchTerm,
  skillMatchToken,
  toIlikePattern,
} from "@/lib/data/profile-search";

describe("isUuid", () => {
  it("accepts real uuid shapes", () => {
    expect(isUuid("f16647c8-872b-4a8a-b8dd-8c152cdddf7e")).toBe(true);
  });

  it("rejects other strings", () => {
    expect(isUuid("abc")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid("f16647c8872b4a8ab8dd8c152cdddf7e")).toBe(false);
  });
});

describe("sanitizeSearchTerm", () => {
  it("strips PostgREST/LIKE metacharacters", () => {
    // `_` is deliberately kept (valid search text); toIlikePattern escapes
    // it for LIKE matching downstream.
    expect(sanitizeSearchTerm("re,act(disj{}ba\\c'\"%_")).toBe(
      "re act disj ba c _",
    );
  });

  it("collapses whitespace and caps length", () => {
    expect(sanitizeSearchTerm(`  ${"a ".repeat(100)}`).length).toBeLessThanOrEqual(60);
    expect(sanitizeSearchTerm("a \n\t b")).toBe("a b");
  });

  it("handles empty input", () => {
    expect(sanitizeSearchTerm(null)).toBe("");
    expect(sanitizeSearchTerm(undefined)).toBe("");
    expect(sanitizeSearchTerm("")).toBe("");
  });
});

describe("toIlikePattern", () => {
  it("wraps in wildcards and escapes LIKE specials", () => {
    expect(toIlikePattern("100%")).toBe("%100\\%%");
    expect(toIlikePattern("a_b")).toBe("%a\\_b%");
    expect(toIlikePattern("react")).toBe("%react%");
  });
});

describe("skillMatchToken", () => {
  it("lowercases single tokens", () => {
    expect(skillMatchToken("React")).toBe("react");
  });

  it("refuses multi-word or metacharacter terms", () => {
    expect(skillMatchToken("machine learning")).toBeNull();
    expect(skillMatchToken("re,act")).toBeNull();
    expect(skillMatchToken("")).toBeNull();
  });
});
