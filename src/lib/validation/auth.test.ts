import { describe, expect, it } from "vitest";
import { signInSchema, signUpSchema } from "@/lib/validation/auth";

describe("signInSchema", () => {
  it("accepts a valid email + password", () => {
    const result = signInSchema.safeParse({
      email: "user@example.com",
      password: "hunter2!!",
    });
    expect(result.success).toBe(true);
  });

  it("rejects malformed emails", () => {
    const result = signInSchema.safeParse({
      email: "not-an-email",
      password: "hunter2!!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = signInSchema.safeParse({ email: "a@b.co", password: "" });
    expect(result.success).toBe(false);
  });
});

describe("signUpSchema", () => {
  it("accepts matching strong passwords", () => {
    const result = signUpSchema.safeParse({
      email: "user@example.com",
      password: "longenough1",
      confirmPassword: "longenough1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects short passwords", () => {
    const result = signUpSchema.safeParse({
      email: "user@example.com",
      password: "short1",
      confirmPassword: "short1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects mismatched passwords", () => {
    const result = signUpSchema.safeParse({
      email: "user@example.com",
      password: "longenough1",
      confirmPassword: "longenough2",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["confirmPassword"]);
    }
  });
});
