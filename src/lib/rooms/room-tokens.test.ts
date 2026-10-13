import { describe, expect, it } from "vitest";
import {
  generateInviteToken,
  hashInviteToken,
  isValidInviteTokenShape,
} from "@/lib/rooms/room-tokens";

describe("generateInviteToken", () => {
  it("mints 43-char base64url tokens (32 bytes of entropy)", () => {
    const token = generateInviteToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("never repeats across calls", () => {
    const tokens = new Set(
      Array.from({ length: 50 }, () => generateInviteToken()),
    );
    expect(tokens.size).toBe(50);
  });
});

describe("hashInviteToken", () => {
  it("produces a 64-char lowercase hex digest", () => {
    expect(hashInviteToken("whatever")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic", () => {
    expect(hashInviteToken("abc")).toBe(hashInviteToken("abc"));
  });

  it("matches the published sha256 test vector", () => {
    expect(hashInviteToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("separates distinct tokens", () => {
    expect(hashInviteToken(generateInviteToken())).not.toBe(
      hashInviteToken(generateInviteToken()),
    );
  });
});

describe("isValidInviteTokenShape", () => {
  it("accepts freshly minted tokens", () => {
    expect(isValidInviteTokenShape(generateInviteToken())).toBe(true);
  });

  it("rejects malformed input before any lookup", () => {
    expect(isValidInviteTokenShape("short")).toBe(false);
    expect(isValidInviteTokenShape("has spaces in it !!")).toBe(false);
    expect(isValidInviteTokenShape("plus+and/slash")).toBe(false);
    expect(isValidInviteTokenShape("x".repeat(121))).toBe(false);
    expect(isValidInviteTokenShape(42)).toBe(false);
    expect(isValidInviteTokenShape(null)).toBe(false);
    expect(isValidInviteTokenShape(undefined)).toBe(false);
  });
});
