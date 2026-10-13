import { describe, expect, it } from "vitest";
import {
  capacitySchema,
  focusTagSchema,
  inviteExpirySchema,
  MAX_CAPACITY,
  MIN_CAPACITY,
  normalizeFocusTag,
  roomSchema,
  roomVisibilitySchema,
} from "@/lib/validation/room";

describe("roomSchema", () => {
  const valid = {
    title: "Deep work — frontend sprint",
    description: "Quiet focus, 50/10 rhythm.",
    focusTag: "react",
    visibility: "public",
    capacity: 4,
  };

  it("accepts a fully valid room", () => {
    const result = roomSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.capacity).toBe(4);
  });

  it("defaults description and focusTag to empty strings", () => {
    const result = roomSchema.safeParse({
      title: "Solo coding",
      visibility: "private",
      capacity: 2,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe("");
      expect(result.data.focusTag).toBe("");
    }
  });

  it("rejects an empty title", () => {
    const result = roomSchema.safeParse({ ...valid, title: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects titles over 80 characters", () => {
    const result = roomSchema.safeParse({ ...valid, title: "x".repeat(81) });
    expect(result.success).toBe(false);
  });

  it("accepts titles of exactly 80 characters", () => {
    const result = roomSchema.safeParse({ ...valid, title: "x".repeat(80) });
    expect(result.success).toBe(true);
  });

  it("rejects descriptions over 500 characters", () => {
    const result = roomSchema.safeParse({
      ...valid,
      description: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid visibility", () => {
    expect(roomSchema.safeParse({ ...valid, visibility: "secret" }).success).toBe(
      false,
    );
    expect(roomVisibilitySchema.safeParse("public").success).toBe(true);
    expect(roomVisibilitySchema.safeParse("private").success).toBe(true);
  });
});

describe("capacitySchema", () => {
  it("coerces form strings to integers", () => {
    expect(capacitySchema.safeParse("4").success).toBe(true);
    expect(capacitySchema.parse("4")).toBe(4);
  });

  it("accepts the exact bounds", () => {
    expect(capacitySchema.safeParse(MIN_CAPACITY).success).toBe(true);
    expect(capacitySchema.safeParse(MAX_CAPACITY).success).toBe(true);
  });

  it("rejects below-minimum, above-maximum and non-integer values", () => {
    expect(capacitySchema.safeParse(1).success).toBe(false);
    expect(capacitySchema.safeParse(11).success).toBe(false);
    expect(capacitySchema.safeParse(2.5).success).toBe(false);
    expect(capacitySchema.safeParse("abc").success).toBe(false);
    expect(capacitySchema.safeParse(null).success).toBe(false);
  });

  it("mirrors the database window 2..10", () => {
    expect(MIN_CAPACITY).toBe(2);
    expect(MAX_CAPACITY).toBe(10);
  });
});

describe("focusTagSchema", () => {
  it("accepts empty and short tags", () => {
    expect(focusTagSchema.safeParse("").success).toBe(true);
    expect(focusTagSchema.safeParse("thesis writing").success).toBe(true);
  });

  it("rejects tags over 30 characters", () => {
    expect(focusTagSchema.safeParse("x".repeat(31)).success).toBe(false);
  });

  it("normalizes whitespace and case like skills do", () => {
    expect(normalizeFocusTag("  React   JS  ")).toBe("react js");
    expect(normalizeFocusTag(null)).toBe("");
    expect(normalizeFocusTag(undefined)).toBe("");
  });
});

describe("inviteExpirySchema", () => {
  it("accepts the offered options", () => {
    for (const option of ["never", "24h", "7d"]) {
      expect(inviteExpirySchema.safeParse(option).success).toBe(true);
    }
  });

  it("rejects anything else", () => {
    expect(inviteExpirySchema.safeParse("30d").success).toBe(false);
    expect(inviteExpirySchema.safeParse("").success).toBe(false);
  });
});
